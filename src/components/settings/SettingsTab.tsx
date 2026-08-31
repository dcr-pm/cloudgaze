import { useState } from 'react';
import { PARENT_COLOR_CLASSES } from '../../../shared/constants';
import { useAppState, useHousehold } from '../../state/useAppState';
import { useNavigation } from '../../state/useHashRoute';
import { backupJson, downloadFile } from '../../lib/csv';
import { formatDateShort, toLocalDate } from '../../lib/dates';
import { PageHeader } from '../shell/AppShell';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { FamilyCodeCard } from '../setup/FamilyCodeCard';

export function SettingsTab() {
  const { state, household, deviceParent, otherParent } = useHousehold();
  const { familyCode, lastSyncedAt, leave } = useAppState();
  const { route, openSheet, closeSheet } = useNavigation();

  function exportBackup() {
    downloadFile(
      `kin-backup-${new Date().toISOString().slice(0, 10)}.json`,
      backupJson(state),
      'application/json',
    );
  }

  return (
    <>
      <PageHeader title="Settings" />

      <div className="mx-auto max-w-lg space-y-6 px-4 py-4">
        <Section title="This household">
          <div className="space-y-2">
            {household.parents.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5">
                <span
                  className={`size-8 shrink-0 rounded-full ${PARENT_COLOR_CLASSES[p.color].bg}`}
                  aria-hidden="true"
                />
                <span className="text-sm text-slate-700">
                  {p.name}
                  {p.id === deviceParent.id && (
                    <span className="text-slate-400"> · this device</span>
                  )}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-600">
            {household.kids.filter((k) => !k.archived).length} kid
            {household.kids.filter((k) => !k.archived).length === 1 ? '' : 's'}:{' '}
            {household.kids
              .filter((k) => !k.archived)
              .map((k) => k.name)
              .join(', ')}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Created {formatDateShort(household.createdAt.slice(0, 10))} ·{' '}
            {household.timezone}
          </p>
        </Section>

        <Section title="Family code">
          {familyCode && <FamilyCodeCard code={familyCode} variant="settings" />}
        </Section>

        <Section title="Activity log">
          <p className="text-sm text-slate-600">
            Every change is recorded with who made it and when. Either parent can
            edit or delete the other&rsquo;s entries — this log is what makes
            that visible rather than silent.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => openSheet('audit')}
          >
            View recent changes
          </Button>
        </Section>

        <Section title="Backup">
          <p className="text-sm text-slate-600">
            Download everything as a JSON file. If the family code is lost there
            is no other way to recover these records.
          </p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={exportBackup}>
            Download backup
          </Button>
          {lastSyncedAt && (
            <p className="mt-3 text-xs text-slate-400">
              Last synced{' '}
              {new Date(lastSyncedAt).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          )}
        </Section>

        <Section title="What this app does and doesn't do">
          {/* Stated plainly rather than buried. Someone may be relying on this
              in a genuinely difficult situation and deserves to know its limits. */}
          <ul className="space-y-2 text-sm leading-relaxed text-slate-600">
            <li>
              <strong className="text-slate-800">The code is the only lock.</strong>{' '}
              Anyone who has it can read and change everything here.
            </li>
            <li>
              <strong className="text-slate-800">Names are self-declared.</strong>{' '}
              Each device simply says which parent it is. Nothing verifies it, so
              &ldquo;added by&rdquo; is a convenience, not proof.
            </li>
            <li>
              <strong className="text-slate-800">Not a legal record.</strong> If
              you need something that stands up in a custody dispute, this
              isn&rsquo;t it — entries can be edited or deleted by either parent.
            </li>
            <li>
              <strong className="text-slate-800">No messaging, on purpose.</strong>{' '}
              This is a shared record, not somewhere to have an argument.
            </li>
          </ul>
        </Section>

        <Section title="This device">
          <p className="text-sm text-slate-600">
            Signed in as <strong>{deviceParent.name}</strong>
            {otherParent && ` · sharing with ${otherParent.name}`}
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => openSheet('leave')}
          >
            Sign out of this household
          </Button>
        </Section>
      </div>

      {route.sheet === 'audit' && <AuditSheet onClose={closeSheet} />}
      {route.sheet === 'leave' && (
        <LeaveSheet onClose={closeSheet} onConfirm={leave} />
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function AuditSheet({ onClose }: { onClose: () => void }) {
  const { state, household } = useHousehold();
  const recent = [...state.audit].reverse().slice(0, 100);
  const nameOf = (id: string) =>
    household.parents.find((p) => p.id === id)?.name ?? 'Someone';

  return (
    <Sheet title="Recent changes" onClose={onClose}>
      {recent.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Nothing yet.</p>
      ) : (
        <ul className="space-y-3">
          {recent.map((rec) => (
            <li key={rec.id} className="flex gap-3 text-sm">
              <span className="w-24 shrink-0 text-xs text-slate-400">
                {formatDateShort(toLocalDate(new Date(rec.at)))}
              </span>
              <span className="min-w-0 flex-1 text-slate-700">
                <span className="font-medium">{nameOf(rec.byParentId)}</span>{' '}
                <span className="text-slate-500">{lowerFirst(rec.summary)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function LeaveSheet({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { familyCode } = useAppState();
  const [confirmed, setConfirmed] = useState(false);

  return (
    <Sheet
      title="Sign out of this household"
      onClose={onClose}
      footer={
        <Button variant="danger" full disabled={!confirmed} onClick={onConfirm}>
          Sign out
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-slate-600">
          This clears the household from <em>this device only</em>. Nothing is
          deleted — the other parent keeps everything, and you can get back in
          with the family code.
        </p>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-900">
            You&rsquo;ll need this code to return. There is no other way back in.
          </p>
          <p className="mt-2 break-all font-mono text-sm font-semibold text-amber-900">
            {familyCode}
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          I have the family code saved somewhere.
        </label>
      </div>
    </Sheet>
  );
}
