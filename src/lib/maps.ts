/**
 * Turn a free-text address into a maps link.
 *
 * Apple Maps on iOS, Google Maps everywhere else. `maps.apple.com` falls back
 * to the web map on non-Apple platforms, and `google.com/maps/search` opens the
 * native app on Android when it's installed, so both work if the sniff is wrong.
 */
export function mapsUrl(location: string): string {
  const q = encodeURIComponent(location.trim());
  return isApplePlatform()
    ? `https://maps.apple.com/?q=${q}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Mac/.test(ua) && 'ontouchend' in document);
}

/** `tel:` link for a coach or instructor number. */
export function telUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}
