import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PublicAvailabilitySlotResponse } from '../../../../core/models/availability.models';
import {
  BannerResponse,
  BrandingSettingsResponse,
  BusinessScheduleDayResponse,
  BusinessScheduleResponse,
  LandingContentResponse,
  PublicStaffListItemResponse,
} from '../../../../core/models/content.models';
import { AuthService } from '../../../../core/services/auth.service';
import { PublicAvailabilityApiService } from '../../../../core/services/public-availability-api.service';
import { PublicContentApiService } from '../../../../core/services/public-content-api.service';
import { PublicStaffApiService } from '../../../../core/services/public-staff-api.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { getApiErrorMessage } from '../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../shared/components/page-state/page-state.component';
import { NativeHomeComponent } from './native-home.component';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

@Component({
  selector: 'app-landing-shell-page',
  imports: [RouterLink, ApiFeedbackComponent, PageStateComponent, NativeHomeComponent],
  templateUrl: './landing-shell-page.component.html',
  styleUrl: './landing-shell-page.component.scss',
})
export class LandingShellPageComponent implements OnInit {
  readonly tickerItems = [
    'Reserva en minutos',
    'Profesionales verificados',
    'Cortes con estilo',
    'Agenda 100% online',
  ];
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly publicContentApiService = inject(PublicContentApiService);
  private readonly publicStaffApiService = inject(PublicStaffApiService);
  private readonly publicAvailabilityApiService = inject(PublicAvailabilityApiService);
  private readonly themeService = inject(ThemeService);
  private readonly sanitizer = inject(DomSanitizer);

  private readonly timeFormatter = new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  private readonly standaloneQuery =
    globalThis.window !== undefined
      ? globalThis.window.matchMedia('(display-mode: standalone)')
      : null;

  readonly isStandalone = signal(this.standaloneQuery?.matches ?? false);

  readonly greetingName = computed(() => {
    const user = this.authService.currentUser();
    return user?.fullName?.split(' ')[0] ?? null;
  });

  readonly isAuthenticated = computed(() => this.authService.isAuthenticated());
  readonly currentYear = new Date().getFullYear();

  readonly landingContent = signal<LandingContentResponse | null>(null);
  readonly branding = signal<BrandingSettingsResponse | null>(null);
  readonly banners = signal<BannerResponse[]>([]);
  readonly staffMembers = signal<PublicStaffListItemResponse[]>([]);
  readonly businessSchedule = signal<BusinessScheduleResponse | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly infoMessage = signal<string | null>(null);

  readonly isOpenNow = computed<boolean>(() => {
    const schedule = this.businessSchedule();
    if (!schedule) return false;
    const { dayOfWeek, minutesSinceMidnight } = getBogotaDayAndMinutes();
    const today = schedule.days.find((d) => d.dayOfWeek === dayOfWeek);
    if (!today?.isOpen || !today.openTime || !today.closeTime) return false;
    return minutesSinceMidnight >= timeToMinutes(today.openTime) && minutesSinceMidnight < timeToMinutes(today.closeTime);
  });

  readonly formattedSchedule = computed<string>(() => {
    const schedule = this.businessSchedule();
    if (!schedule) return 'Lun–Sáb · 10–20h';
    return formatSchedule(schedule.days);
  });

  // Availability modal
  readonly activeStaff = signal<PublicStaffListItemResponse | null>(null);
  readonly selectedDate = signal(todayIso());
  readonly slots = signal<PublicAvailabilitySlotResponse[]>([]);
  readonly slotsLoading = signal(false);
  readonly slotsError = signal<string | null>(null);
  readonly slotsLoaded = signal(false);

  readonly activeBanners = computed(() =>
    this.banners()
      .filter((banner) => banner.isActive)
      .slice()
      .sort((first, second) => first.sortOrder - second.sortOrder),
  );

  readonly mapEmbedUrl = computed<SafeResourceUrl | null>(() => {
    const content = this.landingContent();
    if (!content) return null;

    // 1) Try to convert the mapsUrl (works for full google.com/maps URLs)
    if (content.mapsUrl) {
      const embed = toMapsEmbedUrl(content.mapsUrl);
      if (embed) return this.sanitizer.bypassSecurityTrustResourceUrl(embed);
    }

    // 2) Fallback: use the address field as a search query (works for short URLs / any address)
    if (content.address) {
      const embed = `https://maps.google.com/maps?q=${encodeURIComponent(content.address)}&output=embed`;
      return this.sanitizer.bypassSecurityTrustResourceUrl(embed);
    }

    return null;
  });

  readonly whatsappUrl = computed<string | null>(() => {
    const phone = this.landingContent()?.contactPhone;
    if (!phone) return null;
    return toWhatsappUrl(phone);
  });

  constructor() {
    if (this.standaloneQuery) {
      fromEvent<MediaQueryListEvent>(this.standaloneQuery, 'change')
        .pipe(takeUntilDestroyed())
        .subscribe((e) => this.isStandalone.set(e.matches));
    }
  }

  async ngOnInit(): Promise<void> {
    await this.loadLanding();
  }

  visibleServices(staffMember: PublicStaffListItemResponse) {
    return staffMember.services.filter((service) => service.isActive).slice(0, 3);
  }

  staffRoleSummary(member: PublicStaffListItemResponse): string {
    return member.services
      .filter((s) => s.isActive)
      .slice(0, 2)
      .map((s) => s.name)
      .join(' · ');
  }

  formatRating(value: number): string {
    return value.toFixed(1);
  }

  todayDate(): string {
    return todayIso();
  }

  formatSlotTime(utc: string): string {
    return this.timeFormatter.format(new Date(utc));
  }

  openAvailabilityModal(staffMember: PublicStaffListItemResponse): void {
    this.activeStaff.set(staffMember);
    this.selectedDate.set(todayIso());
    this.slots.set([]);
    this.slotsLoaded.set(false);
    this.slotsError.set(null);
    void this.loadSlots(staffMember.staffProfileId);
  }

  closeAvailabilityModal(): void {
    this.activeStaff.set(null);
  }

  onDateChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (!value) return;
    const staffProfileId = this.activeStaff()?.staffProfileId;
    if (!staffProfileId) return;
    this.selectedDate.set(value);
    this.slotsLoaded.set(false);
    void this.loadSlots(staffProfileId);
  }

  selectSlot(slot: PublicAvailabilitySlotResponse): void {
    const staffProfileId = this.activeStaff()?.staffProfileId;
    if (!staffProfileId) return;
    void this.router.navigate(['/booking/confirm'], {
      queryParams: { staffProfileId, startsAt: slot.startAtUtc },
    });
  }

  private async loadSlots(staffProfileId: string): Promise<void> {
    const date = this.selectedDate();
    this.slotsLoading.set(true);
    this.slotsError.set(null);
    try {
      const response = await firstValueFrom(
        this.publicAvailabilityApiService.getSlots(staffProfileId, date, date),
      );
      this.slots.set(response.slots);
      this.slotsLoaded.set(true);
    } catch {
      this.slotsError.set('No pudimos cargar los horarios. Intenta de nuevo.');
      this.slots.set([]);
    } finally {
      this.slotsLoading.set(false);
    }
  }

  private async loadLanding(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.infoMessage.set(null);

    this.themeService.applyBranding(null);

    const [landingResult, brandingResult, bannersResult, staffResult, scheduleResult] =
      await Promise.allSettled([
        firstValueFrom(this.publicContentApiService.getLanding()),
        firstValueFrom(this.publicContentApiService.getBranding()),
        firstValueFrom(this.publicContentApiService.getBanners()),
        firstValueFrom(this.publicStaffApiService.list()),
        firstValueFrom(this.publicContentApiService.getBusinessSchedule()),
      ]);

    const failedSections: string[] = [];

    if (landingResult.status === 'fulfilled') {
      this.landingContent.set(landingResult.value);
    } else {
      this.landingContent.set(null);
      failedSections.push('contenido principal');
    }

    if (brandingResult.status === 'fulfilled') {
      this.branding.set(brandingResult.value);
      this.themeService.applyBranding(brandingResult.value);
    } else {
      this.branding.set(null);
      failedSections.push('branding');
    }

    if (bannersResult.status === 'fulfilled') {
      this.banners.set(bannersResult.value);
    } else {
      this.banners.set([]);
      failedSections.push('banners');
    }

    if (staffResult.status === 'fulfilled') {
      this.staffMembers.set(staffResult.value);
    } else {
      this.staffMembers.set([]);
      failedSections.push('profesionales');
    }

    if (scheduleResult.status === 'fulfilled') {
      this.businessSchedule.set(scheduleResult.value);
    } else {
      this.businessSchedule.set(null);
    }

    const hasAnyContent =
      this.landingContent() !== null || this.banners().length > 0 || this.staffMembers().length > 0;

    if (failedSections.length > 0 && hasAnyContent) {
      this.infoMessage.set(
        `Se cargo el home con datos parciales. Falto: ${failedSections.join(', ')}.`,
      );
    }

    if (failedSections.length > 0 && !hasAnyContent) {
      const firstFailure =
        landingResult.status === 'rejected'
          ? landingResult.reason
          : brandingResult.status === 'rejected'
            ? brandingResult.reason
            : bannersResult.status === 'rejected'
              ? bannersResult.reason
              : staffResult.status === 'rejected'
                ? staffResult.reason
                : null;

      this.errorMessage.set(getApiErrorMessage(firstFailure));
    }

    this.isLoading.set(false);
  }
}

function toWhatsappUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/+57${digits}`;
}

/**
 * Converts a Google Maps share URL to an embeddable iframe src.
 * Only accepts maps.google.com / google.com/maps domains for security.
 * Returns null when the URL cannot be converted (e.g. short links like goo.gl).
 */
function toMapsEmbedUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    const host = url.hostname;

    const isGoogleMaps =
      host === 'maps.google.com' || host === 'www.google.com' || host === 'google.com';

    if (!isGoogleMaps) return null;

    // Prefer the q= parameter (search term or coordinates)
    const q = url.searchParams.get('q');
    if (q) {
      return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
    }

    // Place URL: /maps/place/Place+Name/@lat,lng,zoom/
    if (url.pathname.includes('/place/')) {
      const placeName = url.pathname.split('/place/')[1]?.split('/')[0];
      if (placeName) {
        return `https://maps.google.com/maps?q=${placeName}&output=embed`;
      }
    }

    // Generic maps URL — just append output=embed
    if (url.pathname.startsWith('/maps') || host === 'maps.google.com') {
      url.searchParams.set('output', 'embed');
      return url.toString();
    }

    return null;
  } catch {
    return null;
  }
}

// ── Business schedule helpers ────────────────────────────

const DAY_LABELS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function getBogotaDayAndMinutes(): { dayOfWeek: number; minutesSinceMidnight: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const weekdayMap: Record<string, number> = {
    Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
  };
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);

  return {
    dayOfWeek: weekdayMap[weekday] ?? 0,
    minutesSinceMidnight: (hour % 24) * 60 + minute,
  };
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

function formatHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return m === 0 ? String(h) : `${String(h)}:${String(m).padStart(2, '0')}`;
}

function toConsecutiveRanges(sortedDays: number[]): string[] {
  const ranges: string[] = [];
  let i = 0;
  while (i < sortedDays.length) {
    let j = i;
    while (j + 1 < sortedDays.length && sortedDays[j + 1] === sortedDays[j] + 1) j++;
    ranges.push(
      j > i
        ? `${DAY_LABELS_SHORT[sortedDays[i]]}–${DAY_LABELS_SHORT[sortedDays[j]]}`
        : DAY_LABELS_SHORT[sortedDays[i]],
    );
    i = j + 1;
  }
  return ranges;
}

function formatSchedule(days: BusinessScheduleDayResponse[]): string {
  const openDays = days
    .filter((d) => d.isOpen && d.openTime && d.closeTime)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  if (!openDays.length) return 'Cerrado';

  const groupMap = new Map<string, { days: number[]; open: string; close: string }>();
  for (const day of openDays) {
    const key = `${day.openTime}|${day.closeTime}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, { days: [], open: day.openTime!, close: day.closeTime! });
    }
    groupMap.get(key)!.days.push(day.dayOfWeek);
  }

  const groups = [...groupMap.values()].sort((a, b) => a.days[0] - b.days[0]);
  const parts: string[] = [];
  for (const group of groups) {
    const timeStr = `${formatHour(group.open)}–${formatHour(group.close)}h`;
    for (const range of toConsecutiveRanges(group.days)) {
      parts.push(`${range} ${timeStr}`);
    }
  }
  return parts.join(' · ');
}
