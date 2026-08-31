import { AppStateProvider } from './state/AppStateProvider';
import { OnboardingGate } from './components/setup/OnboardingGate';
import { AppShell } from './components/shell/AppShell';
import { useNavigation } from './state/useHashRoute';
import { CalendarTab } from './components/calendar/CalendarTab';
import { ActivitiesTab } from './components/activities/ActivitiesTab';
import { ExpensesTab } from './components/expenses/ExpensesTab';
import { SettingsTab } from './components/settings/SettingsTab';

export default function App() {
  return (
    <AppStateProvider>
      <OnboardingGate>
        <AppShell>
          <Routed />
        </AppShell>
      </OnboardingGate>
    </AppStateProvider>
  );
}

function Routed() {
  const { route } = useNavigation();
  switch (route.tab) {
    case 'calendar':
      return <CalendarTab />;
    case 'activities':
      return <ActivitiesTab />;
    case 'expenses':
      return <ExpensesTab />;
    case 'settings':
      return <SettingsTab />;
  }
}
