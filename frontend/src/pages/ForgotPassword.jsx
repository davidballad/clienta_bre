import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { forgotPassword, confirmNewPassword } = useAuth();

  const [step, setStep] = useState('request'); // 'request' | 'confirm' | 'done'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleRequest = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await forgotPassword(email);
      setStep('confirm');
    } catch (err) {
      setError(err.message || t('forgotPassword.requestFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError(t('signup.passwordMinLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('forgotPassword.passwordMismatch'));
      return;
    }
    setSubmitting(true);
    try {
      await confirmNewPassword(email, code, newPassword);
      setStep('done');
    } catch (err) {
      setError(err.message || t('forgotPassword.confirmFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex">
            <img src="/mainLogo.png" alt="Clienta AI" className="mx-auto mb-4 h-16 w-auto" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{t('forgotPassword.title')}</h1>
          <p className="mt-2 text-sm text-gray-500">
            {step === 'request' && t('forgotPassword.requestTagline')}
            {step === 'confirm' && t('forgotPassword.confirmTagline', { email })}
            {step === 'done' && t('forgotPassword.doneTagline')}
          </p>
        </div>

        {step === 'done' ? (
          <div className="card space-y-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-gray-600">{t('forgotPassword.doneBody')}</p>
            <button
              className="btn-primary w-full"
              onClick={() => navigate('/login', { replace: true })}
            >
              {t('common.signIn')}
            </button>
          </div>
        ) : step === 'request' ? (
          <form onSubmit={handleRequest} className="card space-y-5">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}
            <div>
              <label htmlFor="fp-email" className="mb-1 block text-sm font-medium text-gray-700">
                {t('common.email')}
              </label>
              <input
                id="fp-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder={t('common.placeholderEmail')}
              />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? t('forgotPassword.sending') : t('forgotPassword.sendCode')}
            </button>
            <p className="text-center text-sm text-gray-500">
              <Link to="/login" className="font-medium text-brand-600 hover:text-brand-500">
                {t('common.signIn')}
              </Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleConfirm} className="card space-y-5">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}
            <div>
              <label htmlFor="fp-code" className="mb-1 block text-sm font-medium text-gray-700">
                {t('forgotPassword.codeLabel')}
              </label>
              <input
                id="fp-code"
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="input-field"
                placeholder={t('forgotPassword.codePlaceholder')}
                autoComplete="one-time-code"
              />
            </div>
            <div>
              <label htmlFor="fp-new-password" className="mb-1 block text-sm font-medium text-gray-700">
                {t('forgotPassword.newPasswordLabel')}
              </label>
              <input
                id="fp-new-password"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-field"
                placeholder={t('signup.placeholderPassword')}
              />
            </div>
            <div>
              <label htmlFor="fp-confirm-password" className="mb-1 block text-sm font-medium text-gray-700">
                {t('forgotPassword.confirmPasswordLabel')}
              </label>
              <input
                id="fp-confirm-password"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field"
                placeholder={t('forgotPassword.confirmPasswordPlaceholder')}
              />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? t('forgotPassword.saving') : t('forgotPassword.resetPassword')}
            </button>
            <p className="text-center text-sm text-gray-500">
              <button
                type="button"
                onClick={() => { setStep('request'); setError(''); }}
                className="font-medium text-brand-600 hover:text-brand-500"
              >
                {t('forgotPassword.backToEmail')}
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
