import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../../core/services/auth.service';
import { PublicAvailabilityApiService } from '../../../../core/services/public-availability-api.service';
import { PublicBrandingStore } from '../../../../core/services/public-branding.store';
import { PublicContentApiService } from '../../../../core/services/public-content-api.service';
import { PublicStaffApiService } from '../../../../core/services/public-staff-api.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { LandingShellPageComponent } from './landing-shell-page.component';

/** SONDA BUG-102: with the API failing completely, the landing offers «Reintentar». */
describe('LandingShellPageComponent (API down)', () => {
  let fixture: ComponentFixture<LandingShellPageComponent>;
  let content: Record<'getLanding' | 'getBanners' | 'getBusinessSchedule' | 'getTickerItems', ReturnType<typeof vi.fn>>;
  let staffList: ReturnType<typeof vi.fn>;
  let brandingLoad: ReturnType<typeof vi.fn>;

  const down = () => throwError(() => new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' }));

  async function settle(): Promise<void> {
    for (let tick = 0; tick < 3; tick++) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();
    }
  }

  async function create(): Promise<HTMLElement> {
    content = {
      getLanding: vi.fn(down),
      getBanners: vi.fn(down),
      getBusinessSchedule: vi.fn(down),
      getTickerItems: vi.fn(down),
    };
    staffList = vi.fn(down);
    brandingLoad = vi.fn(() => Promise.reject(new HttpErrorResponse({ status: 503 })));

    await TestBed.configureTestingModule({
      imports: [LandingShellPageComponent],
      providers: [
        provideRouter([]),
        { provide: PublicContentApiService, useValue: content },
        { provide: PublicStaffApiService, useValue: { list: staffList } },
        { provide: PublicAvailabilityApiService, useValue: { getSlots: () => of({ slots: [] }) } },
        { provide: PublicBrandingStore, useValue: { load: brandingLoad } },
        { provide: ThemeService, useValue: { applyBranding: vi.fn() } },
        { provide: AuthService, useValue: { isAuthenticated: () => false } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LandingShellPageComponent);
    fixture.detectChanges();
    await settle();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the common error state with «Reintentar»', async () => {
    const element = await create();

    expect(element.querySelector('[data-testid="load-error"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="load-error-retry"]')!.textContent).toContain('Reintentar');
  });

  it('«Reintentar» asks for the content again and hides the error once it arrives', async () => {
    const element = await create();
    content.getLanding.mockReturnValue(of({ heroTitle: 'Zona 8' }));
    content.getBanners.mockReturnValue(of([]));
    content.getBusinessSchedule.mockReturnValue(of({ days: [] }));
    content.getTickerItems.mockReturnValue(of([]));
    staffList.mockReturnValue(of([]));

    element.querySelector<HTMLButtonElement>('[data-testid="load-error-retry"]')!.click();
    await settle();

    expect(content.getLanding).toHaveBeenCalledTimes(2);
    expect(staffList).toHaveBeenCalledTimes(2);
    expect(element.querySelector('[data-testid="load-error"]')).toBeNull();
  });

  // SONDA BUG-050: a banner whose image cannot load keeps its text, without a broken image or a gap.
  it('hides the image of a banner that fails to load and keeps its text', async () => {
    const element = await create();
    content.getLanding.mockReturnValue(of({ heroTitle: 'Zona 8' }));
    content.getBanners.mockReturnValue(
      of([{ id: 'b-1', title: 'Promo de noviembre', subtitle: 'Corte y barba', imageUrl: 'https://cdn.test/gone.jpg', linkUrl: null }]),
    );
    content.getBusinessSchedule.mockReturnValue(of({ days: [] }));
    content.getTickerItems.mockReturnValue(of([]));
    staffList.mockReturnValue(of([]));
    element.querySelector<HTMLButtonElement>('[data-testid="load-error-retry"]')!.click();
    await settle();

    const image = element.querySelector<HTMLImageElement>('.lp__banner-img')!;
    image.dispatchEvent(new Event('error'));
    await settle();

    expect(element.querySelector('.lp__banner-img')).toBeNull();
    expect(element.querySelector('.lp__banner')!.textContent).toContain('Promo de noviembre');
  });
});
