import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { completeSetup, getTenantConfig, patchTenantConfig } from '../api/onboarding';
import { MessageCircle, ExternalLink, Pencil, CheckCircle, Plus, Trash2 } from 'lucide-react';

const normalizePhoneNumber = (value) => String(value || '').replace(/\D/g, '');

export default function WhatsAppSetup() {
  const { t } = useTranslation();
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState('');
  const [businessPhoneNumber, setBusinessPhoneNumber] = useState('');
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [metaBusinessAccountId, setMetaBusinessAccountId] = useState('');
  const [aiSystemPrompt, setAiSystemPrompt] = useState('');
  const [bankName, setBankName] = useState('');
  const [personName, setPersonName] = useState('');
  const [accountType, setAccountType] = useState('');
  const [accountId, setAccountId] = useState('');
  const [identificationNumber, setIdentificationNumber] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [supportPhoneSaving, setSupportPhoneSaving] = useState(false);
  const [supportPhoneSuccess, setSupportPhoneSuccess] = useState('');
  const [catalogSlug, setCatalogSlug] = useState('');
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugSuccess, setSlugSuccess] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [config, setConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const isConnected = !!(config?.meta_phone_number_id);

  useEffect(() => {
    let cancelled = false;
    getTenantConfig()
      .then((data) => { if (!cancelled) setConfig(data); })
      .catch(() => { if (!cancelled) setConfig(null); })
      .finally(() => { if (!cancelled) setConfigLoading(false); });
    return () => { cancelled = true; };
  }, [success]);

  useEffect(() => {
    if (config) {
      setMetaPhoneNumberId(config.meta_phone_number_id || '');
      setBusinessPhoneNumber(normalizePhoneNumber(config.phone_number || config.settings?.phone_number));
      setMetaBusinessAccountId(config.meta_business_account_id || '');
      setAiSystemPrompt(config.ai_system_prompt || '');
      setBankName(config.bank_name || '');
      setPersonName(config.person_name || '');
      setAccountType(config.account_type || '');
      setAccountId(config.account_id || '');
      setIdentificationNumber(config.identification_number || '');
      setSupportPhone(config.support_phone || '');
      setCatalogSlug(config.catalog_slug || '');
    }
  }, [config]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const id = (metaPhoneNumberId || '').trim();
    if (!id) {
      setError('El ID de numero de telefono de Meta es obligatorio.');
      return;
    }
    setSubmitting(true);
    try {
      await completeSetup({
        meta_phone_number_id: id,
        ...(normalizePhoneNumber(businessPhoneNumber) && { phone_number: normalizePhoneNumber(businessPhoneNumber) }),
        ...(metaBusinessAccountId.trim() && { meta_business_account_id: metaBusinessAccountId.trim() }),
        ...(metaAccessToken.trim() && { meta_access_token: metaAccessToken.trim() }),
        ...(aiSystemPrompt.trim() && { ai_system_prompt: aiSystemPrompt.trim() }),
        ...(bankName.trim() && { bank_name: bankName.trim() }),
        ...(personName.trim() && { person_name: personName.trim() }),
        ...(accountType.trim() && { account_type: accountType.trim() }),
        ...(accountId.trim() && { account_id: accountId.trim() }),
        ...(identificationNumber.trim() && { identification_number: identificationNumber.trim() }),
      });
      setSuccess(t('whatsapp.successLinked'));
      setEditing(false);
    } catch (err) {
      setError(err.message || t('whatsapp.setupFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  const showForm = editing || !isConnected;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Conectar WhatsApp</h1>
        <p className="text-sm text-gray-500">
          Vincula tu numero de WhatsApp de Meta a este negocio para que el flujo de n8n enrute los mensajes aqui.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <img src="/whatsapp-glyph.svg" alt="" className="h-8 w-8 object-contain" width={32} height={32} loading="lazy" decoding="async" />
          <span className="text-sm font-medium text-gray-700">WhatsApp Business</span>
        </div>
      </div>

      {/* Support phone for bot escalation */}
      <div className="mt-6 card max-w-xl">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">{t('whatsapp.handoffTitle')}</h2>
        <p className="mb-4 text-xs text-gray-500">
          {t('whatsapp.handoffDesc')}
        </p>

        {supportPhoneSuccess && <div className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">{supportPhoneSuccess}</div>}

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            {t('whatsapp.handoffLabel')}
          </label>
          <input
            type="text"
            value={supportPhone}
            onChange={(e) => setSupportPhone(normalizePhoneNumber(e.target.value))}
            placeholder="Ej: 593999999999"
            className="input-field w-full font-mono text-sm"
            inputMode="numeric"
            pattern="[0-9]*"
          />
          <p className="mt-1 text-xs text-gray-400">{t('whatsapp.handoffHint')}</p>
        </div>

        <button
          type="button"
          disabled={supportPhoneSaving}
          onClick={async () => {
            setSupportPhoneSaving(true);
            setSupportPhoneSuccess('');
            try {
              await patchTenantConfig({ support_phone: supportPhone.trim() });
              setSupportPhoneSuccess(t('whatsapp.handoffSuccess'));
              setError('');
            } catch (err) {
              setError(err.message || 'Error al guardar el telefono de soporte');
            } finally {
              setSupportPhoneSaving(false);
            }
          }}
          className="mt-3 btn-primary text-sm"
        >
          {supportPhoneSaving ? t('whatsapp.saving') : t('whatsapp.handoffSave')}
        </button>
      </div>

      {/* Shareable properties link */}
      {config?.tenant_id && (
        <div className="mt-6 card max-w-xl">
          <h2 className="mb-1 text-sm font-semibold text-gray-900">Catálogo de propiedades</h2>
          <p className="mb-3 text-xs text-gray-500">
            Comparte este link en Instagram, Facebook o WhatsApp. Tus clientes podrán ver tus propiedades y contactarte directamente.
          </p>

          {/* Slug input */}
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Nombre del catálogo (URL amigable)
            </label>
            <input
              type="text"
              value={catalogSlug}
              onChange={e => setCatalogSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
              placeholder="Ej: remax-quito"
              className="input-field w-full font-mono text-sm"
              maxLength={50}
            />
            <p className="mt-1 text-xs text-gray-400">Solo letras minúsculas, números y guiones. Sin espacios.</p>
          </div>

          {slugSuccess && <div className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">{slugSuccess}</div>}

          <button
            type="button"
            disabled={slugSaving || !catalogSlug}
            onClick={async () => {
              setSlugSaving(true);
              setSlugSuccess('');
              try {
                await patchTenantConfig({ catalog_slug: catalogSlug });
                setSlugSuccess('¡URL actualizada correctamente!');
              } catch (err) {
                setError(err.message || 'Error al guardar la URL');
              } finally {
                setSlugSaving(false);
              }
            }}
            className="mb-4 btn-primary text-sm disabled:opacity-50"
          >
            {slugSaving ? 'Guardando...' : 'Guardar URL'}
          </button>

          {/* URL preview + copy */}
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <code className="flex-1 truncate text-xs text-gray-700">
              {window.location.origin}/propiedades/{catalogSlug || config.tenant_id}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/propiedades/${catalogSlug || config.tenant_id}`);
              }}
              className="shrink-0 rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-600 shadow-sm ring-1 ring-gray-200 hover:bg-gray-100"
            >
              Copiar
            </button>
          </div>
        </div>
      )}

      <div className="card max-w-xl">
        {isConnected && !showForm ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h2 className="text-sm font-semibold text-gray-900">Conectado</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="btn-secondary inline-flex items-center gap-1.5 text-sm"
              >
                <Pencil className="h-4 w-4" /> Editar
              </button>
            </div>
            <p className="text-sm text-gray-600">
              ID del numero de telefono: <code className="rounded bg-gray-100 px-1.5 py-0.5">{config.meta_phone_number_id}</code>
            </p>
            <p className="mt-1 text-sm text-gray-600">
              {t('whatsapp.supportPhoneDisplay')}: <code className="rounded bg-gray-100 px-1.5 py-0.5">{normalizePhoneNumber(config.phone_number || config.settings?.phone_number) || '—'}</code>
            </p>
            {config.meta_business_account_id && (
              <p className="mt-1 text-sm text-gray-600">
                ID de cuenta de negocio: <code className="rounded bg-gray-100 px-1.5 py-0.5">{config.meta_business_account_id}</code>
              </p>
            )}
            <p className="mt-1 text-sm text-gray-500">Token configurado (no se muestra por seguridad).</p>
            {config.ai_system_prompt && (
              <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                {t('whatsapp.aiPromptPrefix')}: {config.ai_system_prompt}
              </p>
            )}
            {(config.bank_name || config.person_name || config.account_type || config.account_id || config.identification_number) && (
              <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                <p className="font-medium text-gray-800">Datos de transferencia bancaria configurados</p>
                {config.bank_name && <p className="mt-1">Banco: {config.bank_name}</p>}
                {config.person_name && <p>Nombre: {config.person_name}</p>}
                {config.account_type && <p>Tipo de cuenta: {config.account_type}</p>}
                {config.account_id && <p>ID de cuenta: {config.account_id}</p>}
                {config.identification_number && <p>Identificacion: {config.identification_number}</p>}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              <h2 className="text-sm font-semibold text-gray-900">
                {isConnected ? 'Actualizar configuracion' : 'Vincular numero'}
              </h2>
            </div>

        <p className="mb-4 text-sm text-gray-600">
          Obtiene tu <strong>ID del numero de telefono</strong> desde{' '}
          <a
            href="https://developers.facebook.com/apps"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-brand-600 hover:underline"
          >
            Meta for Developers
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          → tu App → WhatsApp → Configuracion de API → Numeros de telefono. Copia el ID numerico (ej. 106540352242922).
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>
          )}

          <div>
            <label htmlFor="meta_phone_number_id" className="mb-1 block text-sm font-medium text-gray-700">
              ID del numero de telefono de Meta <span className="text-red-500">*</span>
            </label>
            <input
              id="meta_phone_number_id"
              type="text"
              value={metaPhoneNumberId}
              onChange={(e) => setMetaPhoneNumberId(e.target.value)}
              placeholder="ej. 106540352242922"
              className="input-field w-full"
              required
            />
          </div>

          <div>
            <label htmlFor="business_phone_number" className="mb-1 block text-sm font-medium text-gray-700">
              {t('whatsapp.mainPhoneLabel')}
            </label>
            <input
              id="business_phone_number"
              type="text"
              value={businessPhoneNumber}
              onChange={(e) => setBusinessPhoneNumber(normalizePhoneNumber(e.target.value))}
              placeholder="ej. 593999999999"
              className="input-field w-full"
              inputMode="numeric"
              pattern="[0-9]*"
            />
            <p className="mt-1 text-xs text-gray-500">
              {t('whatsapp.mainPhoneHint')}
            </p>
          </div>

          <div>
            <label htmlFor="meta_access_token" className="mb-1 block text-sm font-medium text-gray-700">
              Token de acceso de Meta
            </label>
            <input
              id="meta_access_token"
              type="password"
              value={metaAccessToken}
              onChange={(e) => setMetaAccessToken(e.target.value)}
              placeholder={isConnected ? 'Dejar en blanco para mantener el actual' : 'Desde Meta App → WhatsApp → API'}
              className="input-field w-full"
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-gray-500">
              Desde Meta App → WhatsApp → API → Token temporal o de usuario del sistema. Deja en blanco para mantener el actual.
            </p>
          </div>

          <div>
            <label htmlFor="meta_business_account_id" className="mb-1 block text-sm font-medium text-gray-700">
              ID de cuenta de WhatsApp Business
            </label>
            <input
              id="meta_business_account_id"
              type="text"
              value={metaBusinessAccountId}
              onChange={(e) => setMetaBusinessAccountId(e.target.value)}
              placeholder="ej. 102290129340398"
              className="input-field w-full"
            />
            <p className="mt-1 text-xs text-gray-500">
              Desde Meta Business Suite → WhatsApp Manager → Numeros de telefono (ID de cuenta).
            </p>
          </div>

          <div>
            <label htmlFor="ai_system_prompt" className="mb-1 block text-sm font-medium text-gray-700">
              Prompt de IA para "Algo mas" (opcional)
            </label>
            <textarea
              id="ai_system_prompt"
              value={aiSystemPrompt}
              onChange={(e) => setAiSystemPrompt(e.target.value)}
              placeholder="Eres un asistente util para una agencia inmobiliaria..."
              rows={3}
              className="input-field w-full resize-y"
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Datos bancarios</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="bank_name" className="mb-1 block text-sm font-medium text-gray-700">Nombre del banco</label>
                <input id="bank_name" type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} className="input-field w-full" />
              </div>
              <div>
                <label htmlFor="person_name" className="mb-1 block text-sm font-medium text-gray-700">Nombre de la persona</label>
                <input id="person_name" type="text" value={personName} onChange={(e) => setPersonName(e.target.value)} className="input-field w-full" />
              </div>
              <div>
                <label htmlFor="account_type" className="mb-1 block text-sm font-medium text-gray-700">Tipo de cuenta</label>
                <input id="account_type" type="text" value={accountType} onChange={(e) => setAccountType(e.target.value)} className="input-field w-full" />
              </div>
              <div>
                <label htmlFor="account_id" className="mb-1 block text-sm font-medium text-gray-700">ID de cuenta</label>
                <input id="account_id" type="text" value={accountId} onChange={(e) => setAccountId(e.target.value)} className="input-field w-full" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="identification_number" className="mb-1 block text-sm font-medium text-gray-700">Numero de identificacion</label>
                <input id="identification_number" type="text" value={identificationNumber} onChange={(e) => setIdentificationNumber(e.target.value)} className="input-field w-full" />
              </div>
            </div>
          </div>

              <div className="flex gap-2">
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? 'Guardando...' : isConnected ? 'Actualizar' : 'Vincular WhatsApp'}
                </button>
                {isConnected && (
                  <button type="button" onClick={() => { setEditing(false); setError(''); setSuccess(''); }} className="btn-secondary">
                    {t('whatsapp.cancel')}
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
