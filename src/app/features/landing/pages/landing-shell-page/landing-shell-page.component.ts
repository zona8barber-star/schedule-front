import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PublicAvailabilitySlotResponse } from '../../../../core/models/availability.models';
import {
  PublicBannerResponse,
  PublicBrandingResponse,
  BusinessScheduleDayResponse,
  BusinessScheduleResponse,
  PublicLandingContentResponse,
  PublicStaffListItemResponse,
  PublicStaffServiceResponse,
  PublicTickerItemResponse,
} from '../../../../core/models/content.models';
import { AuthService } from '../../../../core/services/auth.service';
import { PublicAvailabilityApiService } from '../../../../core/services/public-availability-api.service';
import { PublicContentApiService } from '../../../../core/services/public-content-api.service';
import { PublicStaffApiService } from '../../../../core/services/public-staff-api.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { PublicBrandingStore } from '../../../../core/services/public-branding.store';
import { ApiFeedbackComponent } from '../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../shared/components/page-state/page-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { whatsAppUrl } from '../../../../core/utils/whatsapp-link.utils';
import { safeGoogleMapsUrl, safeHttpUrl } from '../../../../core/utils/safe-url.utils';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

@Component({
  selector: 'app-landing-shell-page',
  imports: [RouterLink, ApiFeedbackComponent, PageStateComponent, LoadErrorComponent],
  templateUrl: './landing-shell-page.component.html',
  styleUrl: './landing-shell-page.component.scss',
})
export class LandingShellPageComponent implements OnInit {
  /** Links from the CMS are shown only when they are http(s) (SONDA BUG-047). */
  readonly safeUrl = safeHttpUrl;
  readonly safeMapsUrl = safeGoogleMapsUrl;

  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly publicContentApiService = inject(PublicContentApiService);
  private readonly publicStaffApiService = inject(PublicStaffApiService);
  private readonly publicAvailabilityApiService = inject(PublicAvailabilityApiService);
  private readonly themeService = inject(ThemeService);
  private readonly brandingStore = inject(PublicBrandingStore);
  private readonly sanitizer = inject(DomSanitizer);

  private readonly timeFormatter = new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  readonly isAuthenticated = computed(() => this.authService.isAuthenticated());

  readonly landingContent = signal<PublicLandingContentResponse | null>(null);
  readonly branding = signal<PublicBrandingResponse | null>(null);
  readonly banners = signal<PublicBannerResponse[]>([]);
  readonly tickerItems = signal<PublicTickerItemResponse[]>([]);
  readonly tickerLoopItems = computed(() => {
    const items = this.tickerItems();
    return items.length ? [...items, ...items] : [];
  });
  readonly staffMembers = signal<PublicStaffListItemResponse[]>([]);
  readonly businessSchedule = signal<BusinessScheduleResponse | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  /** SONDA BUG-102: the whole landing failed; the page shows «Reintentar». */
  readonly loadError = signal<unknown>(null);
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
  /** General service the free times are computed for (ADR-0016 B3). */
  readonly selectedServiceId = signal<string | null>(null);

  /** The public API already returns only the active banners, in their order (SONDA BUG-101). */
  readonly activeBanners = computed(() => this.banners());

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

  readonly whatsappUrl = computed<string | null>(() => whatsAppUrl(this.landingContent()?.contactPhone));

  async ngOnInit(): Promise<void> {
    await this.loadLanding();
  }

  retryLanding(): Promise<void> {
    return this.loadLanding();
  }

  visibleServices(staffMember: PublicStaffListItemResponse) {
    return staffMember.services.slice(0, 3);
  }

  staffRoleSummary(member: PublicStaffListItemResponse): string {
    return member.services
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
    this.selectedServiceId.set(staffMember.services[0]?.generalServiceId ?? null);
    this.slots.set([]);
    this.slotsLoaded.set(false);
    this.slotsError.set(null);
    void this.loadSlots(staffMember.staffProfileId);
  }

  onServiceChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const staffProfileId = this.activeStaff()?.staffProfileId;
    if (!value || !staffProfileId) return;
    this.selectedServiceId.set(value);
    this.slotsLoaded.set(false);
    void this.loadSlots(staffProfileId);
  }

  formatServiceOption(service: PublicStaffServiceResponse): string {
    return `${service.name} · ${service.durationMinutes} min`;
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
    const generalServiceId = this.selectedServiceId();
    if (!generalServiceId) return;
    void this.router.navigate(['/booking/confirm'], {
      queryParams: { staffProfileId, startsAt: slot.startAtUtc, generalServiceId },
    });
  }

  private async loadSlots(staffProfileId: string): Promise<void> {
    const date = this.selectedDate();
    const generalServiceId = this.selectedServiceId();
    if (!generalServiceId) {
      this.slots.set([]);
      return;
    }

    this.slotsLoading.set(true);
    this.slotsError.set(null);
    try {
      const response = await firstValueFrom(
        this.publicAvailabilityApiService.getSlots(staffProfileId, date, date, { generalServiceId }),
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

    const [landingResult, brandingResult, bannersResult, staffResult, scheduleResult, tickerItemsResult] =
      await Promise.allSettled([
        firstValueFrom(this.publicContentApiService.getLanding()),
        // Shared with the shell header and the tab title (SONDA BUG-100): one request for all of them.
        this.brandingStore.load(),
        firstValueFrom(this.publicContentApiService.getBanners()),
        firstValueFrom(this.publicStaffApiService.list()),
        firstValueFrom(this.publicContentApiService.getBusinessSchedule()),
        firstValueFrom(this.publicContentApiService.getTickerItems()),
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

    if (tickerItemsResult.status === 'fulfilled') {
      this.tickerItems.set(tickerItemsResult.value);
    } else {
      this.tickerItems.set([]);
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

      this.loadError.set(firstFailure ?? new Error('landing failed'));
    } else {
      this.loadError.set(null);
    }

    this.isLoading.set(false);
  }
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
