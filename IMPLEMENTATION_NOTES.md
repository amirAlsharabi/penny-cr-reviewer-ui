# Implementation Notes

## 1. What I changed

- **Task 1: Bug Fixes (Diff & Permissions)**
  - `src/components/diff.util.ts`: Fixed line-item modification detection in `computeDiff()`. Expanded the equality check beyond `unitPrice` to also compare `quantity` and `description` between baseline and proposed items sharing the same SKU.
  - `src/components/cr-detail/cr-detail.component.ts`: Enforced permission checks in `canApprove` and `canReject` getters by checking `canApprovePolicy(this.session.user)` in addition to the `PENDING_APPROVAL` status check.

- **Task 2: List Filtering**
  - `src/components/cr-list/cr-list.component.ts`: Implemented the `visibleRows` getter to filter the loaded change requests by `statusFilter`, returning all rows when `ALL` is selected. Added a DOM integration test in `cr-list.component.spec.ts` to assert that status filtering updates the rendered table rows.

- **Task 3 & 4: Detail View, Actions & Validation**
  - `src/components/cr-detail/cr-detail.component.ts`:
    - Updated `timeline` getter to sort audit entries chronologically (`oldest-first`) using timestamps, without mutating the original audit array.
    - Added a custom `nonWhitespaceValidator` and applied it alongside `Validators.required` on `rejectControl` to prevent empty or whitespace-only rejections.
    - Implemented `approve()` and `reject()` actions with double-submission protection (`submitting = true`), structured error handling via `try/catch/finally` setting `actionError`, and direct view-state updates using the response returned by the API.

- **Task 5: Extended Testing**
  - `src/components/cr-detail/cr-detail.component.spec.ts`: Added DOM integration tests verifying chronological timeline rendering, reject button enabled/disabled states based on form input, and the complete approval flow updating the status badge to `APPROVED`.

---

## 2. Component & state model

- **Components**:
  - `CrListComponent`: Renders summary rows of change requests. Manages `state: ViewState<CrSummary[]>` (`idle`, `loading`, `loaded`, `error`). Calls `api.listChangeRequests()` on init and exposes `visibleRows` based on the selected dropdown filter.
  - `CrDetailComponent`: Renders change request details, the diff table, audit history, and action controls. Exposes `state: ViewState<CrDetail>`.
- **Data Flow & Transitions**:
  - Components initialize with `idle()` and transition to `loading()` when fetching data.
  - Successful API responses transition the state to `loaded` with data; errors transition to `error` with a descriptive message.
  - State mutations (`approve`, `reject`) update `this.state` directly with the updated `CrDetail` object returned by the API call, keeping the UI and audit timeline synchronized without needing a full page reload.

---

## 3. Invariants I keep

| Invariant | How / where |
|---|---|
| Viewers cannot trigger approval or rejection | Enforced in `CrDetailComponent.canApprove` & `canReject` via `canApprovePolicy(this.session.user)` and template bindings `[disabled]="!canApprove \|\| submitting"`. |
| Actions are only executable on pending change requests | Evaluated in `canApprove` and `canReject` (`this.detail?.status === 'PENDING_APPROVAL'`). |
| Protection against duplicate submissions under latency | Guard checks (`if (this.submitting) return;`) and toggling `submitting = true` in `approve()` and `reject()`, reset in `finally`. |
| Rejection reason cannot be empty or whitespace | Enforced via `Validators.required` and `nonWhitespaceValidator` on `rejectControl`, bound to template `[disabled]="... \|\| rejectControl.invalid"`. |
| Timeline order is strictly chronological (oldest-first) | Enforced in `CrDetailComponent.timeline` by sorting entries on `new Date(a.at).getTime() - new Date(b.at).getTime()`. |
| Immutability of source state arrays | Used array spreading (`[...this.detail.audit].sort(...)`) to prevent in-place mutation of the underlying data. |

---

## 4. Testing strategy

- **Pure Algorithmic Unit Tests (`diff.spec.ts`)**:
  - Tested `computeDiff` in complete isolation to verify detection of price-only, quantity-only, and description changes, as well as additions and deletions.
- **Component & DOM Integration Tests (`TestBed` + `jsdom`)**:
  - `cr-list.component.spec.ts`: Tested that selecting a status filter correctly updates the DOM table rows.
  - `cr-detail.component.spec.ts`: Tested permission gating on buttons, chronological order of timeline elements in the DOM, reactive validation state changes on the reject textarea, and full approval state transitions.
- **Deliberately Skipped**:
  - Full end-to-end browser automation (Cypress/Playwright) was skipped to keep the test suite fast, focused, and fully self-contained within Jest and `TestBed`.

---

## 5. Assumptions

- **Audit Timestamps**: Assumed downstream backend services may return audit log entries out of order; handled sorting defensively on the client using timestamp comparisons.
- **Multi-Tenancy Scope**: Assumed organizational scoping (`org-alpha`) is pre-filtered by the session and mock API layer; the client-side list filter only needs to handle status categorization.
- **Inline Error Feedback**: Assumed network or transaction errors during action dispatch should be displayed inline via `actionError` without clearing the already loaded CR details.

---

## 6. Where I used AI

- Brainstorming edge cases for multi-field diff comparison (`unitPrice`, `quantity`, `description`).
- Structuring DOM-level async test fixtures for Angular reactive forms and Jest timers.

---

## 7. What I'd improve with more time

- **Optimistic UI Updates with Rollback**: Immediately update the UI state upon action click with a snapshot rollback in case of API failure, improving perceived performance on high-latency networks.
- **Confirmation Dialog**: Add a confirmation modal before submitting destructive actions (like rejection) to prevent accidental clicks.
- **Accessibility (a11y)**: Add `aria-live` attributes to dynamic error regions and ensure complete keyboard navigation for action workflows.