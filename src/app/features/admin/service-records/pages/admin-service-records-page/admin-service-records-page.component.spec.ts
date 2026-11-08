import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ServiceRecordsApiService } from '../../../../../core/services/service-records-api.service';
import { AdminServiceRecordsPageComponent } from './admin-service-records-page.component';

describe('AdminServiceRecordsPageComponent (history windows)', () => {
  let fixture: ComponentFixture<AdminServiceRecordsPageComponent>;
  let component: AdminServiceRecordsPageComponent;
  let list: ReturnType<typeof vi.fn>;

  async function render(): Promise<void> {
    await fixture.whenStable();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-06T15:00:00Z'));
    list = vi.fn(() => of({ items: [], page: 1, pageSize: 25, totalCount: 0 }));

    await TestBed.configureTestingModule({
      imports: [AdminServiceRecordsPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ServiceRecordsApiService,
          useValue: { list, options: () => of({ services: [], generalServices: [], staff: [] }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminServiceRecordsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await render();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists every pending record without dates, so an old one is never hidden', () => {
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'Pending', from: null, to: null, page: 1, pageSize: 25 }),
    );
    expect(component.rangeError()).toBeNull();
  });

  it('shows the confirmed history for the last 30 days by default and older periods on request', async () => {
    component.selectTab('Approved');
    await render();
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'Approved', from: '2026-10-08', to: '2026-11-06', page: 1 }),
    );

    component.onFromChange('2025-06-01');
    await render();
    expect(TestBed.inject(Router).url).toBe('/?status=Approved&from=2025-06-01&to=2025-06-30');
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'Approved', from: '2025-06-01', to: '2025-06-30' }));
  });

  it('explains a range longer than 30 days instead of asking the API, in the queue and in the history', async () => {
    const calls = list.mock.calls.length;
    await TestBed.inject(Router).navigateByUrl('/?from=2026-01-01&to=2026-01-31');
    await render();
    expect(list.mock.calls.length).toBe(calls);
    expect(component.rangeError()).toContain('30 días');

    await TestBed.inject(Router).navigateByUrl('/?status=Rejected&from=2026-01-01&to=2026-01-30');
    await render();
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'Rejected', from: '2026-01-01', to: '2026-01-30' }));
    expect(component.rangeError()).toBeNull();
  });
});
