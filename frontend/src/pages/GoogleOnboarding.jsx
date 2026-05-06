import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { provisionGoogleUser } from '../api/onboarding';

const BUSINESS_TYPE_OPTIONS = [
  { value: 'real_estate', label: 'Bienes Raíces' },
  { value: 'construction', label: 'Construcción' },
  { value: 'other', label: 'Otro' },
];

export default function GoogleOnboarding() {
  const { user, isAuthenticated, refreshSession } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    business_name: '',
    business_type: 'real_estate',
    meta_phone_number_id: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // If user already has a tenantId they don't need onboarding.
  useEffect(() => {
    if (isAuthenticated && user?.tenantId) {
      navigate('/br', { replace: true });
    }
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await provisionGoogleUser(form);
      // Fetch new tokens — Cognito now has custom:tenant_id set.
      const { tenantId } = await refreshSession();
      if (tenantId) {
        navigate('/br', { replace: true });
      } else {
        // Refresh token didn't pick up the new attribute yet; ask user to re-login.
        navigate('/login', { replace: true, state: { message: 'Cuenta creada. Por favor inicia sesión de nuevo para continuar.' } });
      }
    } catch (err) {
      setError(err.message || 'Error al configurar la cuenta. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src="/mainLogo.png" alt="Clienta AI" className="mx-auto mb-4 h-16 w-auto" />
          <h1 className="text-2xl font-bold text-gray-900">Configura tu cuenta</h1>
          <p className="mt-2 text-sm text-gray-500">
            Bienvenido, <span className="font-medium">{user?.email}</span>. Completa estos datos para activar tu espacio de trabajo.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div>
            <label htmlFor="business_name" className="mb-1 block text-sm font-medium text-gray-700">
              Nombre del negocio
            </label>
            <input
              id="business_name"
              required
              value={form.business_name}
              onChange={update('business_name')}
              className="input-field"
              placeholder="Ej. Inmobiliaria Sol"
            />
          </div>

          <div>
            <label htmlFor="business_type" className="mb-1 block text-sm font-medium text-gray-700">
              Tipo de negocio
            </label>
            <select
              id="business_type"
              value={form.business_type}
              onChange={update('business_type')}
              className="input-field"
            >
              {BUSINESS_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="meta_phone_number_id" className="mb-1 block text-sm font-medium text-gray-700">
              WhatsApp Phone Number ID
            </label>
            <input
              id="meta_phone_number_id"
              required
              value={form.meta_phone_number_id}
              onChange={update('meta_phone_number_id')}
              className="input-field"
              placeholder="Ej. 123456789012345"
            />
            <p className="mt-1 text-xs text-gray-400">
              Encuéntralo en Meta Developer Console → WhatsApp → Phone numbers.
            </p>
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Configurando...' : 'Activar mi cuenta'}
          </button>
        </form>
      </div>
    </div>
  );
}
