import { useCallback, useSyncExternalStore } from 'react';
import { currentMonthKey, isValidMonthKey, type MonthKey } from '../lib/dates';

/**
 * Hash routing, no library.
 *
 * Three tabs and a few sheets don't justify a router dependency, and hash
 * routes need zero server configuration — so a redirect mistake can never break
 * navigation. (The SPA fallback in netlify.toml still exists so a hard refresh
 * on any path serves the app.)
 *
 * Sheets push their own hash segment, which makes Android back and iOS
 * swipe-back dismiss them for free.
 */

export type Tab = 'calendar' | 'activities' | 'expenses' | 'settings';

export const TABS: readonly Tab[] = ['calendar', 'activities', 'expenses', 'settings'];

export interface Route {
  tab: Tab;
  /** Calendar only: the month being viewed. */
  month: MonthKey;
  /** A sheet stacked on top of the tab, e.g. "new-plan" or "entry/<id>". */
  sheet: string | null;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function getHash(): string {
  return window.location.hash;
}

function parse(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [tabPart = '', ...rest] = raw.split('/');

  const tab = (TABS as readonly string[]).includes(tabPart)
    ? (tabPart as Tab)
    : 'calendar';

  let month = currentMonthKey();
  let sheetParts = rest;

  // #/calendar/2026-08[/sheet...]
  if (tab === 'calendar' && rest[0] && isValidMonthKey(rest[0])) {
    month = rest[0];
    sheetParts = rest.slice(1);
  }

  const sheet = sheetParts.length > 0 ? sheetParts.join('/') : null;
  return { tab, month, sheet };
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, () => '');
  return parse(hash);
}

export function buildHash(route: Partial<Route> & { tab: Tab }): string {
  const parts: string[] = [route.tab];
  if (route.tab === 'calendar' && route.month) parts.push(route.month);
  if (route.sheet) parts.push(route.sheet);
  return `#/${parts.join('/')}`;
}

export function navigate(route: Partial<Route> & { tab: Tab }): void {
  window.location.hash = buildHash(route);
}

/** Replaces rather than pushes — used so month paging doesn't fill up history. */
export function replaceRoute(route: Partial<Route> & { tab: Tab }): void {
  window.history.replaceState(null, '', buildHash(route));
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function useNavigation() {
  const route = useRoute();

  const openSheet = useCallback(
    (sheet: string) => navigate({ ...route, sheet }),
    [route],
  );

  const closeSheet = useCallback(() => {
    // Prefer going back so the sheet feels like a real navigation step; if
    // there's nothing to go back to (deep link, fresh tab), replace instead.
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate({ tab: route.tab, month: route.month });
    }
  }, [route]);

  const goTab = useCallback((tab: Tab) => navigate({ tab }), []);

  const setMonth = useCallback(
    (month: MonthKey) => replaceRoute({ tab: 'calendar', month }),
    [],
  );

  return { route, openSheet, closeSheet, goTab, setMonth };
}
