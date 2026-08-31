import type { ReactNode } from 'react';
import { useNavigation, TABS, type Tab } from '../../state/useHashRoute';
import { SyncBadge } from './SyncBadge';

const TAB_META: Record<Tab, { emoji: string; label: string }> = {
  calendar: { emoji: '📅', label: 'Calendar' },
  activities: { emoji: '🔁', label: 'Activities' },
  expenses: { emoji: '💰', label: 'Expenses' },
  settings: { emoji: '⚙️', label: 'Settings' },
};

export function AppShell({ children }: { children: ReactNode }) {
  const { route, goTab } = useNavigation();

  return (
    <div className="min-h-dvh bg-slate-50">
      {/* Bottom padding clears the fixed tab bar plus the home indicator. */}
      <main className="pb-[calc(4.5rem+var(--safe-b))]">{children}</main>

      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur"
        style={{ paddingBottom: 'var(--safe-b)' }}
      >
        <div className="mx-auto flex max-w-lg">
          {TABS.map((tab) => {
            const active = route.tab === tab;
            const meta = TAB_META[tab];
            return (
              <button
                key={tab}
                type="button"
                onClick={() => goTab(tab)}
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors',
                  active ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600',
                ].join(' ')}
              >
                <span className="text-xl leading-none" aria-hidden="true">
                  {meta.emoji}
                </span>
                <span className="text-[11px] font-medium">{meta.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <SyncBadge />
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur"
      style={{ paddingTop: 'calc(0.75rem + var(--safe-t))' }}
    >
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** Floating action button, offset above the tab bar. */
export function Fab({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="fixed right-4 z-40 flex size-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-700 active:scale-95"
      style={{ bottom: 'calc(5rem + var(--safe-b))' }}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-7" aria-hidden="true">
        <path
          d="M12 5v14M5 12h14"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}

export function EmptyState({
  emoji,
  title,
  body,
  action,
}: {
  emoji: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="text-4xl" aria-hidden="true">
        {emoji}
      </div>
      <h2 className="mt-3 text-base font-semibold text-slate-800">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-slate-500">
        {body}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
