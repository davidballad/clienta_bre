import { useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './context/AuthContext';
import { setTokenGetter } from './api/client';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import LeadsList from './pages/LeadsList';
import LeadProfile from './pages/LeadProfile';
import MessagesInbox from './pages/MessagesInbox';
import WhatsAppSetup from './pages/WhatsAppSetup';
import BRELanding from './pages/BRELanding';
import BRLayout from './components/BRLayout';
import BRDashboard from './pages/BRDashboard';
import Analytics from './pages/Analytics';
import PropertyForm from './pages/PropertyForm';
import PropertyList from './pages/PropertyList';
import PropertyCatalog from './pages/PropertyCatalog';
import PropertyLanding from './pages/PropertyLanding';
import Appointments from './pages/Appointments';

export default function App() {
  const { token } = useAuth();
  const { i18n } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    setTokenGetter(() => token);
  }, [token]);

  useEffect(() => {
    // Keep only landing page bilingual; force Spanish everywhere else.
    if (location.pathname !== '/' && i18n.language !== 'es') {
      i18n.changeLanguage('es');
    }
  }, [i18n, location.pathname]);

  return (
    <Routes>
      {/* Real Estate Public Landing */}
      <Route path="/" element={<BRELanding />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/propiedades/:tenantId/:propertyId" element={<PropertyLanding />} />
      <Route path="/propiedades/:tenantId" element={<PropertyCatalog />} />
      <Route path="/properties/:tenantId" element={<PropertyCatalog />} />

      {/* Legacy /app Redirect to /br */}
      <Route path="/app/*" element={<Navigate to="/br" replace />} />

      {/* Clienta BR (Bienes Raíces) Dashboard */}
      <Route
        path="/br"
        element={
          <ProtectedRoute>
            <BRLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<BRDashboard />} />
        <Route path="properties" element={<PropertyList />} />
        <Route path="properties/new" element={<PropertyForm />} />
        <Route path="properties/:id" element={<PropertyForm />} />
        <Route path="leads" element={<LeadsList />} />
        <Route path="leads/:id" element={<LeadProfile />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="messages" element={<MessagesInbox />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<WhatsAppSetup />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
