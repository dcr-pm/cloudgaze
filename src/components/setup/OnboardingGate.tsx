import { useState } from 'react';
import { useAppState } from '../../state/useAppState';
import { CreateHouseholdWizard } from './CreateHouseholdWizard';
import { JoinScreen } from './JoinScreen';
import { WhichParentAreYou } from './WhichParentAreYou';
import { Button } from '../ui/Button';

type Mode = 'choose' | 'create' | 'join';

/**
 * Everything before the app proper: pick a household, then say which parent
 * this device belongs to.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { state, familyCode, deviceParentId, booting } = useAppState();
  const [mode, setMode] = useState<Mode>('choose');

  if (booting) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="text-center">
          <div className="mx-auto size-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
          <p className="mt-3 text-sm text-slate-500">Loading…</p>
        </div>
      </div>
    );
  }

  if (!familyCode || !state) {
    if (mode === 'create') return <CreateHouseholdWizard onBack={() => setMode('choose')} />;
    if (mode === 'join') return <JoinScreen onBack={() => setMode('choose')} />;
    return <Welcome onCreate={() => setMode('create')} onJoin={() => setMode('join')} />;
  }

  // The household is loaded but this device hasn't said who it is yet — which
  // is the case on the second parent's phone right after they join.
  if (!deviceParentId || !state.household.parents.some((p) => p.id === deviceParentId)) {
    return <WhichParentAreYou />;
  }

  return <>{children}</>;
}

function Welcome({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <div className="text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-indigo-600 text-3xl">
            🏠
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-slate-900">Kin</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
            A shared record of plans, activities and expenses — so both parents
            can see what&rsquo;s happening with the kids.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <Button size="lg" full onClick={onCreate}>
            Set up a new household
          </Button>
          <Button size="lg" variant="secondary" full onClick={onJoin}>
            I have a family code
          </Button>
        </div>

        <p className="mt-8 text-center text-xs leading-relaxed text-slate-500">
          No accounts and no passwords. One shared code gives both parents access
          to the same record.
        </p>
      </div>
    </div>
  );
}
