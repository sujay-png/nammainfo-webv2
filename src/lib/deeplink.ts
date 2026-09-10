/**
 * Central place for "app vs web" decisions.
 *
 * While NEXT_PUBLIC_APP_IS_LIVE is not "true" (i.e. the mobile app isn't
 * published yet), every card page must behave like a complete product on
 * its own — no dead "Open in App" buttons, no store badges that 404.
 * Flip the env var once both store listings are live and the CTA switches
 * automatically, no code change needed.
 */
export const appIsLive = process.env.NEXT_PUBLIC_APP_IS_LIVE === "true";

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nammainfo.com";
export const appScheme = process.env.NEXT_PUBLIC_APP_SCHEME ?? "nammainfo";
export const playStoreUrl = process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? "";
export const appStoreUrl = process.env.NEXT_PUBLIC_APP_STORE_URL ?? "";

export function profileDeepLink(profileId: string) {
  return `${appScheme}://profile/${profileId}`;
}

export function cardUniversalLink(cardSlugOrId: string) {
  return `${siteUrl}/c/${cardSlugOrId}`;
}
