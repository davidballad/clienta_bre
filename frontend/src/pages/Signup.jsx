import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { createTenant } from '../api/onboarding';
import { useAuth } from '../context/AuthContext';

const BUSINESS_TYPE_KEYS = [
  { value: 'real_estate', labelKey: 'signup.businessTypes.real_estate' },
  { value: 'construction', labelKey: 'signup.businessTypes.construction' },
];

export default function Signup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signIn, signInWithGoogle } = useAuth();
  const [form, setForm] = useState({
    business_name: '',
    business_type: 'real_estate',
    owner_email: '',
    owner_password: '',
    meta_phone_number_id: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.owner_password.length < 8) {
      setError(t('signup.passwordMinLength'));
      return;
    }
    setSubmitting(true);
    try {
      await createTenant(form);
      await signIn(form.owner_email, form.owner_password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || t('signup.signupFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex">
            <img src="/mainLogo.png" alt="Clienta AI" className="mx-auto mb-4 h-16 w-auto" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{t('signup.title')}</h1>
          <p className="mt-2 text-sm text-gray-500">{t('signup.tagline')}</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div>
            <label htmlFor="business_name" className="mb-1 block text-sm font-medium text-gray-700">{t('signup.businessName')}</label>
            <input id="business_name" required value={form.business_name} onChange={update('business_name')} className="input-field" placeholder={t('signup.placeholderBusiness')} />
          </div>

          <div>
            <label htmlFor="business_type" className="mb-1 block text-sm font-medium text-gray-700">{t('signup.businessType')}</label>
            <select id="business_type" value={form.business_type} onChange={update('business_type')} className="input-field">
              {BUSINESS_TYPE_KEYS.map((opt) => <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="owner_email" className="mb-1 block text-sm font-medium text-gray-700">{t('common.email')}</label>
            <input id="owner_email" type="email" required value={form.owner_email} onChange={update('owner_email')} className="input-field" placeholder={t('common.placeholderEmail')} />
          </div>

          <div>
            <label htmlFor="owner_password" className="mb-1 block text-sm font-medium text-gray-700">{t('common.password')}</label>
            <input id="owner_password" type="password" required minLength={8} value={form.owner_password} onChange={update('owner_password')} className="input-field" placeholder={t('signup.placeholderPassword')} />
          </div>

          <div>
            <label htmlFor="meta_phone_number_id" className="mb-1 block text-sm font-medium text-gray-700">
              {t('signup.whatsappPhoneNumberId')}
            </label>
            <input id="meta_phone_number_id" required value={form.meta_phone_number_id} onChange={update('meta_phone_number_id')} className="input-field" placeholder={t('signup.placeholderPhoneId')} />
            <p className="mt-1 text-xs text-gray-400">{t('signup.whatsappHint')}</p>
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? t('common.creatingAccount') : t('common.createAccount')}
          </button>

          {/* Divider */}
          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-gray-400">{t('common.orContinueWith')}</span></div>
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={signInWithGoogle}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 active:bg-gray-100"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {t('common.signUpWithGoogle')}
          </button>

          <p className="text-center text-sm text-gray-500">
            {t('signup.alreadyHaveAccount')}{' '}
            <Link to="/login" className="font-medium text-brand-600 hover:text-brand-500">{t('common.signIn')}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
