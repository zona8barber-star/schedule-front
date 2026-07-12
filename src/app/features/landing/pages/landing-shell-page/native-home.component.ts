import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  BannerResponse,
  LandingContentResponse,
  PublicStaffListItemResponse,
  TickerItemResponse,
} from '../../../../core/models/content.models';

@Component({
  selector: 'app-native-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './native-home.component.html',
  styleUrl: './native-home.component.scss',
})
export class NativeHomeComponent {
  readonly greetingName = input<string | null>(null);
  readonly landingContent = input<LandingContentResponse | null>(null);
  readonly isOpenNow = input(false);
  readonly formattedSchedule = input('');
  readonly staffMembers = input<PublicStaffListItemResponse[]>([]);
  readonly activeBanners = input<BannerResponse[]>([]);
  readonly tickerItems = input<TickerItemResponse[]>([]);
  readonly isLoading = input(false);
  readonly whatsappUrl = input<string | null>(null);

  readonly bookStaff = output<PublicStaffListItemResponse>();

  visibleServices(member: PublicStaffListItemResponse) {
    return member.services.filter((s) => s.isActive).slice(0, 3);
  }

  openModal(member: PublicStaffListItemResponse): void {
    this.bookStaff.emit(member);
  }
}
