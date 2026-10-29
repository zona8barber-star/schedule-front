import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { PublicAvailabilitySlotResponse } from '../../../core/models/availability.models';
import { PublicAvailabilityApiService } from '../../../core/services/public-availability-api.service';
import {
  BOGOTA_TIME_ZONE,
  addDaysToDateKey,
  bogotaDateKey,
  bogotaToday,
  dateKeyToUtcNoon,
  isDateKey,
} from '../../../core/utils/bogota-date.utils';

/** Days shown as quick buttons (today included). Further dates go through "Otra fecha". */
export const SLOT_PICKER_WINDOW_DAYS = 14;

export interface SlotPickerDay {
  date: string;
  topLabel: string;
  bottomLabel: string;
  /** null while unknown (still loading or the load failed). */
  slotCount: number | null;
}

const weekdayFormatter = new Intl.DateTimeFormat('es-CO', { weekday: 'short', timeZone: 'UTC' });
const dayMonthFormatter = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const longDateFormatter = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const timeFormatter = new Intl.DateTimeFormat('es-CO', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: BOGOTA_TIME_ZONE,
});

/**
 * Day + time picker for one barber: the next two weeks as buttons (days without free
 * time are disabled), a native date input for anything further, and the free times
 * of the selected day.
 */
@Component({
  selector: 'app-slot-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './slot-picker.component.html',
  styleUrl: './slot-picker.component.scss',
})
export class SlotPickerComponent implements OnInit {
  private readonly availabilityApi = inject(PublicAvailabilityApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly staffProfileId = input.required<string>();
  /** Day to open on (YYYY-MM-DD). Defaults to the first day with free time. */
  readonly initialDate = input<string | null>(null);
  /** Highlights this slot (e.g. the one the parent is about to confirm). */
  readonly selectedStartAtUtc = input<string | null>(null);
  readonly disabled = input(false);

  readonly slotSelected = output<PublicAvailabilitySlotResponse>();

  readonly today = signal(bogotaToday());
  readonly selectedDate = signal(this.today());
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  /** Free slots per Bogotá day, for every day already loaded. */
  private readonly slotsByDate = signal<Record<string, PublicAvailabilitySlotResponse[]>>({});

  readonly days = computed<SlotPickerDay[]>(() => {
    const loaded = this.slotsByDate();
    const today = this.today();

    return Array.from({ length: SLOT_PICKER_WINDOW_DAYS }, (_, index) => {
      const date = addDaysToDateKey(today, index);
      const asDate = dateKeyToUtcNoon(date);

      return {
        date,
        topLabel: index === 0 ? 'Hoy' : index === 1 ? 'Mañana' : capitalize(trimDot(weekdayFormatter.format(asDate))),
        bottomLabel: trimDot(dayMonthFormatter.format(asDate)),
        slotCount: date in loaded ? loaded[date].length : null,
      };
    });
  });

  readonly windowEnd = computed(() => addDaysToDateKey(this.today(), SLOT_PICKER_WINDOW_DAYS - 1));
  readonly isOutsideWindow = computed(() => this.selectedDate() > this.windowEnd());

  readonly selectedDateLabel = computed(() =>
    capitalize(longDateFormatter.format(dateKeyToUtcNoon(this.selectedDate()))),
  );

  readonly selectedSlots = computed(() => this.slotsByDate()[this.selectedDate()] ?? null);

  constructor() {
    afterNextRender(() => this.scrollSelectedDayIntoView());
  }

  ngOnInit(): void {
    const initial = this.initialDate();
    const hasInitialDate = isDateKey(initial) && initial >= this.today();
    if (hasInitialDate) {
      this.selectedDate.set(initial);
    }

    void this.loadWindow(!hasInitialDate);
  }

  formatTime(slot: PublicAvailabilitySlotResponse): string {
    return timeFormatter.format(new Date(slot.startAtUtc));
  }

  selectDay(date: string): void {
    this.selectedDate.set(date);
    if (!(date in this.slotsByDate())) {
      void this.loadRange(date, date);
    }
  }

  onOtherDate(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (!isDateKey(value) || value < this.today()) {
      return;
    }

    this.selectDay(value);
    this.scrollSelectedDayIntoView();
  }

  pick(slot: PublicAvailabilitySlotResponse): void {
    if (!this.disabled()) {
      this.slotSelected.emit(slot);
    }
  }

  /** Reloads free times, e.g. after the chosen one was taken by someone else. */
  async reload(): Promise<void> {
    this.today.set(bogotaToday());
    this.slotsByDate.set({});
    await this.loadWindow(false);

    if (this.isOutsideWindow()) {
      await this.loadRange(this.selectedDate(), this.selectedDate());
    }
  }

  private async loadWindow(selectFirstAvailable: boolean): Promise<void> {
    await this.loadRange(this.today(), this.windowEnd());

    if (this.isOutsideWindow()) {
      await this.loadRange(this.selectedDate(), this.selectedDate());
    }

    if (selectFirstAvailable && this.selectedSlots()?.length === 0) {
      const firstWithSlots = this.days().find((day) => (day.slotCount ?? 0) > 0);
      if (firstWithSlots) {
        this.selectedDate.set(firstWithSlots.date);
        this.scrollSelectedDayIntoView();
      }
    }
  }

  private async loadRange(from: string, to: string): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const response = await firstValueFrom(
        this.availabilityApi.getSlots(this.staffProfileId(), from, to),
      );

      const grouped: Record<string, PublicAvailabilitySlotResponse[]> = {};
      for (let date = from; date <= to; date = addDaysToDateKey(date, 1)) {
        grouped[date] = [];
      }

      for (const slot of response.slots) {
        const date = bogotaDateKey(slot.startAtUtc);
        (grouped[date] ??= []).push(slot);
      }

      for (const slots of Object.values(grouped)) {
        slots.sort((a, b) => a.startAtUtc.localeCompare(b.startAtUtc));
      }

      this.slotsByDate.update((current) => ({ ...current, ...grouped }));
    } catch {
      this.errorMessage.set('No pudimos cargar los horarios. Intenta de nuevo.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private scrollSelectedDayIntoView(): void {
    setTimeout(() => {
      const button = this.host.nativeElement.querySelector<HTMLElement>(
        `[data-date="${this.selectedDate()}"]`,
      );
      button?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    });
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function trimDot(value: string): string {
  return value.replace(/\./g, '');
}
