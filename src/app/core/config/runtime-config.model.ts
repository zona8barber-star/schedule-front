export interface RuntimeConfig {
  apiBaseUrl: string;
  appName: string;
  appUrl: string;
  assetsBaseUrl: string;
  environmentName: string;
  vapidPublicKey?: string;
  /**
   * Optional public address of the site (e.g. the production alias), used to show shareable links such as the
   * product catalog. When missing, the current origin is used.
   */
  publicSiteUrl?: string;
}
