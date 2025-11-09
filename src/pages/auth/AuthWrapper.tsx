import { useState } from 'react';
import { Login } from './Login';
import { OnboardingFlow } from '../onboarding/OnboardingFlow';

export const AuthWrapper = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);

  if (showOnboarding) {
    return <OnboardingFlow onCancel={() => setShowOnboarding(false)} />;
  }

  return <Login onSwitchToRegister={() => setShowOnboarding(true)} />;
};