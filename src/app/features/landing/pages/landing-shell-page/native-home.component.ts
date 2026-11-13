import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { safeGoogleMapsUrl, safeHttpUrl } from '../../../../core/utils/safe-url.utils';

import {
  PublicBannerResponse,
  PublicLandingContentResponse,
  PublicStaffListItemResponse,
  PublicTickerItemResponse,
} from '../../../../core/models/content.models';

@Component({
  selector: 'app-native-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './native-home.component.html',
  styleUrl: './native-home.component.scss',
})
export class NativeHomeComponent {
  /** Links from the CMS are shown only when they are http(s) (SONDA BUG-047). */
  readonly safeUrl = safeHttpUrl;
  readonly safeMapsUrl = safeGoogleMapsUrl;

  readonly greetingName = input<string | null>(null);
  readonly landingContent = input<PublicLandingContentResponse | null>(null);
  readonly isOpenNow = input(false);
  readonly formattedSchedule = input('');
  readonly staffMembers = input<PublicStaffListItemResponse[]>([]);
  readonly activeBanners = input<PublicBannerResponse[]>([]);
  readonly tickerItems = input<PublicTickerItemResponse[]>([]);
  readonly isLoading = input(false);
  readonly whatsappUrl = input<string | null>(null);

  readonly bookStaff = output<PublicStaffListItemResponse>();

  visibleServices(member: PublicStaffListItemResponse) {
    return member.services.slice(0, 3);
  }

  openModal(member: PublicStaffListItemResponse): void {
    this.bookStaff.emit(member);
  }
}
