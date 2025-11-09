import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthWrapper } from './pages/auth/AuthWrapper';
import { OnboardingFlow } from './pages/onboarding/OnboardingFlow';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Meals } from './pages/Meals';
import { Charts } from './pages/Charts';
import { Profile } from './pages/Profile';
import StravaAuth from './pages/StravaAuth';

const AppContent = () => {
  const { isAuthenticated, user, logout } = useAuth();

  if (!isAuthenticated) {
    return <AuthWrapper />;
  }

  if (user && !user.isOnboardingComplete) {
    return <OnboardingFlow onCancel={() => logout()} />;
  }
  

return (
    <Router>
      <Routes>
        {/* AJOUT: Route spéciale pour le retour Strava (sans la nav bar) */}
        <Route path="/strava-auth" element={<StravaAuth />} />

        {/* Routes principales avec la nav bar */}
        <Route path="/*" element={
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/meals" element={<Meals />} />
              <Route path="/charts" element={<Charts />} />
              <Route path="/profile" element={<Profile />} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </Router>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;