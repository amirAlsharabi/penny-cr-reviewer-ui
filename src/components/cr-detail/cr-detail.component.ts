import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormControl, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { CrApiService } from '../../api/cr-api.service';
import { SessionService } from '../../session/session.service';
import { CrDetail, TimelineEntry } from '../../models/cr.models';
import { idle, loading, ViewState } from '../../common/view-state';
import { computeDiff, DiffRow } from '../diff.util';
import { formatMoney } from '../../common/money.util';
import { canApprovePolicy } from '../../common/permissions';

/**
 * Change Request DETAIL page: loads a CR and renders the diff/preview, the approval timeline, and
 * permission-aware Approve/Reject actions. `load`, the diff binding, and the template skeleton are
 * provided; the timeline ordering, permission gating, actions, and reject validation are yours.
 */
function nonWhitespaceValidator(control: AbstractControl): ValidationErrors | null {
	const isValid = (control.value || '').trim().length > 0;
	return isValid ? null : { whitespace: true };
}
@Component({
	selector: 'app-cr-detail',
	standalone: true,
	imports: [CommonModule, ReactiveFormsModule],
	templateUrl: './cr-detail.component.html',
})
export class CrDetailComponent implements OnInit {
	@Input() id!: string;

	state: ViewState<CrDetail> = idle();
	submitting = false;
	actionError?: string;
	// TODO: add validation so the form is invalid until a reason is entered.
	rejectControl = new FormControl('', {
		nonNullable: true,
		validators: [Validators.required, nonWhitespaceValidator],
	});
	constructor(private readonly api: CrApiService, private readonly session: SessionService) {}

	ngOnInit(): void {
		void this.load();
	}

	async load(): Promise<void> {
		this.state = loading();
		this.actionError = undefined;
		try {
			const detail = await this.api.getChangeRequest(this.session.user, this.id);
			this.state = { status: 'loaded', data: detail };
		} catch (err) {
			this.state = { status: 'error', data: null, error: (err as Error).message };
		}
	}

	get detail(): CrDetail | null {
		return this.state.data;
	}

	get diff(): DiffRow[] {
		return this.detail ? computeDiff(this.detail.baselineLineItems, this.detail.proposedLineItems) : [];
	}

	/** Approval timeline, oldest-first. */
	get timeline(): TimelineEntry[] {
		if (!this.detail?.audit) return [];
		// TODO: return the audit entries ordered chronologically (oldest first).
		return [...this.detail.audit].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
	}

	/** Whether the current user may approve the loaded CR. */
	get canApprove(): boolean {
		// NOTE: this only looks at the CR status. The UI must also respect the user's permissions.
		return this.detail?.status === 'PENDING_APPROVAL' && canApprovePolicy(this.session.user);
	}

	get canReject(): boolean {
		return this.detail?.status === 'PENDING_APPROVAL' && canApprovePolicy(this.session.user);
	}

	fmt(amount: number): string {
		return this.detail ? formatMoney(amount, this.detail.currency) : String(amount);
	}

	async approve(): Promise<void> {
		if (!this.canApprove || this.submitting || !this.detail) return;
		this.submitting = true;
		this.actionError = undefined;
		try {
			const now = new Date().toISOString();
			const updated = await this.api.approve(this.session.user, this.detail.id, now);
			this.state = { status: 'loaded', data: updated };
		} catch (err) {
			this.actionError = (err as Error).message || 'Failed to approve';
		} finally {
			this.submitting = false;
		}
	}

	async reject(): Promise<void> {
		this.rejectControl.markAsTouched();
		if (!this.canReject || this.submitting || this.rejectControl.invalid || !this.detail) return;

		this.submitting = true;
		this.actionError = undefined;
		try {
			const now = new Date().toISOString();
			const reason = this.rejectControl.value.trim();
			const updated = await this.api.reject(this.session.user, this.detail.id, now, reason);
			this.state = { status: 'loaded', data: updated };
			this.rejectControl.reset();
		} catch (err) {
			this.actionError = (err as Error).message || 'Failed to reject';
		} finally {
			this.submitting = false;
		}
	}
}
