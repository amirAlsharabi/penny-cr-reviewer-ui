import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CrDetailComponent } from './cr-detail.component';
import { SessionService } from '../../session/session.service';
import { users } from '../../api/fixtures';
import { ReqUser } from '../../models/cr.models';

const flush = () => new Promise((r) => setTimeout(r, 0));

async function render(user: ReqUser, id: string): Promise<ComponentFixture<CrDetailComponent>> {
	TestBed.configureTestingModule({
		imports: [CrDetailComponent],
		providers: [{ provide: SessionService, useValue: { user } }],
	});
	await TestBed.compileComponents();
	const fixture = TestBed.createComponent(CrDetailComponent);
	fixture.componentInstance.id = id;
	fixture.detectChanges(); // ngOnInit -> load()
	await flush(); // let the mock API resolve
	fixture.detectChanges(); // render the loaded state
	return fixture;
}

describe('CrDetailComponent', () => {
	it('loads and renders the change request title', async () => {
		const fixture = await render(users.approver, 'CR-1');
		expect(fixture.nativeElement.querySelector('.cr-detail__header h2').textContent).toContain('Add 1 unit of SKU-A');
	});

	it('disables Approve for a read-only viewer on a pending CR', async () => {
		const fixture = await render(users.viewer, 'CR-1'); // viewer: cr_r_o only; CR-1 is PENDING_APPROVAL
		const approveBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__approve');
		expect(approveBtn.disabled).toBe(true);
	});

	it('renders timeline entries in chronological order (oldest first)', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const entries = fixture.nativeElement.querySelectorAll('.cr-timeline__action');
		expect(entries.length).toBe(3);
		expect(entries[0].textContent).toContain('CREATE');
		expect(entries[1].textContent).toContain('SUBMIT');
		expect(entries[2].textContent).toContain('SEND_FOR_APPROVAL');
	});

	it('requires a non-empty rejection reason before enabling Reject', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const rejectBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__reject-btn');
		const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('.cr-actions__reason');

		expect(rejectBtn.disabled).toBe(true);

		textarea.value = '    ';
		textarea.dispatchEvent(new Event('input'));
		fixture.detectChanges();
		expect(rejectBtn.disabled).toBe(true);

		textarea.value = 'Budget exceeded';
		textarea.dispatchEvent(new Event('input'));
		fixture.detectChanges();
		expect(rejectBtn.disabled).toBe(false);
	});

	it('approves a pending CR and updates the view status to APPROVED', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const approveBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__approve');

		approveBtn.click();
		fixture.detectChanges(); // submitting becomes true
		await flush(); // wait for mock API approve transition
		fixture.detectChanges(); // re-render loaded state

		const statusBadge = fixture.nativeElement.querySelector('.cr-status');
		expect(statusBadge.textContent).toContain('APPROVED');
	});
});
