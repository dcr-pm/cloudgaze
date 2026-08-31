import { useAppState } from '../../state/useAppState';

/**
 * Only appears when there's something worth saying. Silence means saved.
 *
 * The offline case is the one that matters: a parent logging something at a
 * campsite needs to know it's kept and will send itself later, not wonder
 * whether it vanished.
 */
export function SyncBadge() {
  const { sync, pendingCount, error } = useAppState();

  if (sync === 'idle' && !error) return null;

  const content =
    sync === 'offline'
      ? {
          tone: 'bg-amber-100 text-amber-900 border-amber-200',
          icon: '📴',
          text:
            pendingCount > 0
              ? `Offline — ${pendingCount} change${pendingCount === 1 ? '' : 's'} will send when you reconnect`
              : 'Offline — showing your last saved copy',
        }
      : sync === 'error' || error
        ? {
            tone: 'bg-red-100 text-red-900 border-red-200',
            icon: '⚠️',
            text: error ?? "Couldn't sync",
          }
        : {
            tone: 'bg-slate-100 text-slate-700 border-slate-200',
            icon: '⏳',
            text: 'Saving…',
          };

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
      style={{ bottom: 'calc(5rem + var(--safe-b))' }}
    >
      <div
        className={`pointer-events-auto flex max-w-sm items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium shadow-sm ${content.tone}`}
      >
        <span aria-hidden="true">{content.icon}</span>
        <span>{content.text}</span>
      </div>
    </div>
  );
}
