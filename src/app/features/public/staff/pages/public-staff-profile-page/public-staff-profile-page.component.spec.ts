import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { PublicStaffProfileResponse, PublicStaffServiceResponse } from '../../../../../core/models/content.models';
import { PublicAvailabilityApiService } from '../../../../../core/services/public-availability-api.service';
import { PublicStaffApiService } from '../../../../../core/services/public-staff-api.service';
import { PublicStaffReviewsApiService } from '../../../../../core/services/public-staff-reviews-api.service';
import { PublicStaffProfilePageComponent } from './public-staff-profile-page.component';

describe('PublicStaffProfilePageComponent (booking by service)', () => {
  let fixture: ComponentFixture<PublicStaffProfilePageComponent>;
  let component: PublicStaffProfilePageComponent;
  let getSlots: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;

  const cut: PublicStaffServiceResponse = {
    generalServiceId: 'g-cut',
    name: 'Corte',
    description: null,
    categoryId: 'c-barber',
    categoryName: 'Barbería',
    durationMinutes: 30,
  };
  const beard: PublicStaffServiceResponse = { ...cut, generalServiceId: 'g-beard', name: 'Barba', durationMinutes: 20 };

  let phoneNumber: string | null = null;

  const profile = (services: PublicStaffServiceResponse[]): PublicStaffProfileResponse => ({
    staffProfileId: 'st-1',
    displayName: 'Alex',
    bio: null,
    phoneNumber,
    photoMediaAssetId: null,
    photoUrl: null,
    tipsQrMediaAssetId: null,
    tipsQrUrl: null,
    defaultAppointmentDurationMinutes: 30,
    averageRating: 4.5,
    reviewCount: 2,
    services,
    instagramUrl: null,
    facebookUrl: null,
    tikTokUrl: null,
    youtubeUrl: null,
    xUrl: null,
  });

  const slot = { startAtUtc: '2026-11-07T15:00:00Z', endAtUtc: '2026-11-07T15:30:00Z' };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-06T15:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    phoneNumber = null;
  });

  async function open(services: PublicStaffServiceResponse[], queryParams: Record<string, string> = {}): Promise<void> {
    getSlots = vi.fn((staffProfileId: string, from: string, to: string) =>
      of({ staffProfileId, from, to, slotDurationMinutes: 30, slots: [slot], generalServiceId: null, slotStepMinutes: 15 }),
    );

    await TestBed.configureTestingModule({
      imports: [PublicStaffProfilePageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ staffProfileId: 'st-1' }),
              queryParamMap: convertToParamMap(queryParams),
            },
          },
        },
        { provide: PublicStaffApiService, useValue: { getById: () => of(profile(services)) } },
        {
          provide: PublicStaffReviewsApiService,
          useValue: {
            getSummaryByStaffProfileId: () => of({ averageStars: 4.5, totalReviews: 2 }),
            listByStaffProfileId: () => of([]),
          },
        },
        { provide: PublicAvailabilityApiService, useValue: { getSlots } },
      ],
    }).compileComponents();

    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(PublicStaffProfilePageComponent);
    component = fixture.componentInstance;
    await render();
  }

  async function render(): Promise<void> {
    fixture.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  function text(): string {
    return fixture.nativeElement.textContent as string;
  }

  async function chooseFirstDay(index = 0): Promise<string> {
    const day = fixture.nativeElement.querySelectorAll('.psp__day-option')[index] as HTMLButtonElement;
    const date = day.getAttribute('data-day')!;
    day.click();
    await render();
    return date;
  }

  it('asks for the day first (ADR-0016 D8), before any service or free time', async () => {
    await open([cut, beard]);
    component.openBookingModal();
    await render();

    expect(text()).toContain('¿Qué día quieres venir?');
    expect(fixture.nativeElement.querySelectorAll('.psp__day-option').length).toBe(14);
    expect(fixture.nativeElement.querySelector('.psp__service-option')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-slot-picker')).toBeNull();
    expect(getSlots).not.toHaveBeenCalled();
  });

  it('then asks for the service, showing name and duration and never a price', async () => {
    await open([cut, beard]);
    component.openBookingModal();
    await render();
    await chooseFirstDay();

    expect(fixture.nativeElement.querySelector('[data-testid="chosen-date"]')).not.toBeNull();
    const options = Array.from(
      fixture.nativeElement.querySelectorAll('.psp__service-option') as NodeListOf<HTMLElement>,
    ).map((button) => [button.querySelector('strong')?.textContent?.trim(), button.querySelector('span')?.textContent?.trim()]);
    expect(options).toEqual([
      ['Corte', '30 min'],
      ['Barba', '20 min'],
    ]);
    expect(fixture.nativeElement.querySelector('app-slot-picker')).toBeNull();
    expect(getSlots).not.toHaveBeenCalled();
    expect(text()).not.toContain('$');
  });

  it('loads the free times of the chosen day and service and books it', async () => {
    await open([cut, beard]);
    component.openBookingModal();
    await render();
    const date = await chooseFirstDay(1); // the mocked free time is tomorrow (2026-11-07)

    (fixture.nativeElement.querySelector('[data-service-id="g-beard"]') as HTMLButtonElement).click();
    await render();

    expect(fixture.nativeElement.querySelector('[data-testid="chosen-service"]').textContent.trim()).toBe('Barba · 20 min');
    expect(getSlots).toHaveBeenCalledWith('st-1', expect.any(String), expect.any(String), { generalServiceId: 'g-beard' });
    expect(component.bookingDate()).toBe(date);
    expect(text()).not.toContain('$');

    (fixture.nativeElement.querySelector('.sp__slot') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/booking/confirm'], {
      queryParams: { staffProfileId: 'st-1', startsAt: slot.startAtUtc, generalServiceId: 'g-beard' },
    });
  });

  it('skips the service step when the professional offers a single service', async () => {
    await open([cut]);
    component.openBookingModal();
    await render();
    await chooseFirstDay();

    expect(component.selectedService()?.generalServiceId).toBe('g-cut');
    expect(fixture.nativeElement.querySelector('app-slot-picker')).not.toBeNull();
    expect(getSlots).toHaveBeenCalledWith('st-1', expect.any(String), expect.any(String), { generalServiceId: 'g-cut' });
  });

  it('reopens on the service of "Cambiar fecha u hora"', async () => {
    await open([cut, beard], { reservar: '1', fecha: '2026-11-07', servicio: 'g-beard' });

    expect(component.showBookingModal()).toBe(true);
    expect(component.selectedService()?.generalServiceId).toBe('g-beard');
    expect(component.bookingDate()).toBe('2026-11-07');
  });

  it('lets the customer change the day after choosing it', async () => {
    await open([cut, beard]);
    component.openBookingModal();
    await render();
    await chooseFirstDay();

    (Array.from(fixture.nativeElement.querySelectorAll('.psp__link') as NodeListOf<HTMLButtonElement>)
      .find((button) => button.textContent?.includes('Cambiar día')))!.click();
    await render();

    expect(component.bookingDate()).toBeNull();
    expect(text()).toContain('¿Qué día quieres venir?');
  });

  it('explains when the professional has nothing to book', async () => {
    await open([]);
    component.openBookingModal();
    await render();

    expect(text()).toContain('Este profesional aún no tiene servicios disponibles para reservar.');
    expect(fixture.nativeElement.querySelector('app-slot-picker')).toBeNull();
  });

  describe('WhatsApp link (SONDA BUG-048)', () => {
    function whatsappLink(): HTMLAnchorElement | null {
      return fixture.nativeElement.querySelector('.psp__whatsapp');
    }

    it('links to wa.me with the country code once and no "+"', async () => {
      phoneNumber = '+57 300 123 4567';
      await open([cut]);

      expect(whatsappLink()!.getAttribute('href')).toBe('https://wa.me/573001234567');
    });

    it('renders no link for a phone that is not a usable number', async () => {
      phoneNumber = '+57 (300) abc';
      await open([cut]);

      expect(whatsappLink()).toBeNull();
    });
  });
});
