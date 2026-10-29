import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { PublicAvailabilitySlotResponse } from '../../../core/models/availability.models';
import { PublicAvailabilityApiService } from '../../../core/services/public-availability-api.service';
import { SlotPickerComponent } from './slot-picker.component';

describe('SlotPickerComponent', () => {
  let fixture: ComponentFixture<SlotPickerComponent>;
  let getSlots: ReturnType<typeof vi.fn>;
  let slots: PublicAvailabilitySlotResponse[];

  // Tomorrow (Oct 8, Bogotá) at 10:00 and 10:30 local = 15:00 / 15:30 UTC.
  const tomorrowSlots: PublicAvailabilitySlotResponse[] = [
    { startAtUtc: '2026-10-08T15:30:00Z', endAtUtc: '2026-10-08T16:00:00Z' },
    { startAtUtc: '2026-10-08T15:00:00Z', endAtUtc: '2026-10-08T15:30:00Z' },
  ];

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // Oct 7, 20:30 in Bogotá (already Oct 8 in UTC).
    vi.setSystemTime(new Date('2026-10-08T01:30:00Z'));

    slots = tomorrowSlots;
    getSlots = vi.fn((staffProfileId: string, from: string, to: string) =>
      of({ staffProfileId, from, to, slotDurationMinutes: 30, slots }),
    );

    await TestBed.configureTestingModule({
      imports: [SlotPickerComponent],
      providers: [{ provide: PublicAvailabilityApiService, useValue: { getSlots } }],
    }).compileComponents();

    fixture = TestBed.createComponent(SlotPickerComponent);
    fixture.componentRef.setInput('staffProfileId', 'staff-1');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Runs change detection, lets the (mocked) requests resolve, then renders the result. */
  async function render(): Promise<void> {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  it('loads two weeks starting today in Bogotá and jumps to the first day with free time', async () => {
    await render();

    expect(getSlots).toHaveBeenCalledWith('staff-1', '2026-10-07', '2026-10-20');

    const component = fixture.componentInstance;
    expect(component.days()[0]).toMatchObject({ date: '2026-10-07', topLabel: 'Hoy', slotCount: 0 });
    expect(component.days()[1]).toMatchObject({ date: '2026-10-08', topLabel: 'Mañana', slotCount: 2 });
    expect(component.selectedDate()).toBe('2026-10-08');

    const times = Array.from(
      fixture.nativeElement.querySelectorAll('.sp__slot') as NodeListOf<HTMLElement>,
    ).map((button) => button.textContent?.trim());
    expect(times).toEqual(['10:00', '10:30']);

    const todayButton = fixture.nativeElement.querySelector('[data-date="2026-10-07"]') as HTMLButtonElement;
    expect(todayButton.disabled).toBe(true);
  });

  it('keeps the requested initial day even when it has no free time', async () => {
    fixture.componentRef.setInput('initialDate', '2026-10-07');
    await render();

    expect(fixture.componentInstance.selectedDate()).toBe('2026-10-07');
    expect(fixture.nativeElement.textContent).toContain('No hay horarios libres este día');
  });

  it('loads a date beyond the two-week window on demand', async () => {
    await render();
    slots = [{ startAtUtc: '2026-11-02T14:00:00Z', endAtUtc: '2026-11-02T14:30:00Z' }];

    const input = fixture.nativeElement.querySelector('.sp__other-input') as HTMLInputElement;
    input.value = '2026-11-02';
    input.dispatchEvent(new Event('change'));
    await render();

    expect(getSlots).toHaveBeenLastCalledWith('staff-1', '2026-11-02', '2026-11-02');
    expect(fixture.componentInstance.selectedDate()).toBe('2026-11-02');
    expect(fixture.componentInstance.isOutsideWindow()).toBe(true);
  });

  it('emits the chosen slot', async () => {
    await render();
    const emitted: PublicAvailabilitySlotResponse[] = [];
    fixture.componentInstance.slotSelected.subscribe((slot) => emitted.push(slot));

    (fixture.nativeElement.querySelector('.sp__slot') as HTMLButtonElement).click();

    expect(emitted).toEqual([tomorrowSlots[1]]);
  });
});
