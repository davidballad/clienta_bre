import { useState, useEffect, useRef } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  MessageSquare,
  BarChart3,
  Users,
  FileText,
  Check,
  ChevronDown,
  Bot,
  TrendingUp,
  Home,
  MapPin,
  Shield,
  Sparkles,
  ArrowRight,
  Phone,
  Upload,
} from 'lucide-react';
import { submitContact } from '../api/contact';

const BUSINESS_WHATSAPP_URL = 'https://wa.me/593997848591';

function WhatsAppGlyph({ className }) {
  return (
    <img
      src="/whatsapp-glyph.svg"
      alt=""
      width={40}
      height={40}
      className={className}
      decoding="async"
    />
  );
}

/** Real-estate themed background with building-like geometric elements */
function RealEstateBackground() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden>
      <div className="absolute top-[10%] left-[5%] h-72 w-72 rounded-full bg-emerald-500/8 blur-[100px] animate-pulse" />
      <div className="absolute top-[50%] right-[10%] h-96 w-96 rounded-full bg-teal-500/8 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      <div className="absolute bottom-[5%] left-[30%] h-64 w-64 rounded-full bg-emerald-400/6 blur-[80px] animate-pulse" style={{ animationDelay: '4s' }} />

      <svg className="h-full w-full opacity-[0.08]" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="br-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
        </defs>
        {/* Abstract building outlines */}
        <g stroke="url(#br-grad)" strokeWidth="0.8" fill="none" opacity="0.6">
          <rect x="100" y="300" width="80" height="400" rx="4" />
          <rect x="200" y="200" width="60" height="500" rx="4" />
          <rect x="280" y="350" width="100" height="350" rx="4" />
          <rect x="500" y="250" width="70" height="450" rx="4" />
          <rect x="590" y="180" width="90" height="520" rx="4" />
          <rect x="700" y="320" width="60" height="380" rx="4" />
        </g>
        {/* Window dots */}
        {[120, 140, 160].map(x =>
          [320, 360, 400, 440, 480, 520, 560, 600].map(y => (
            <rect key={`${x}-${y}`} x={x} y={y} width="8" height="8" rx="1" fill="#10b981" opacity="0.15" />
          ))
        )}
        {[520, 540].map(x =>
          [280, 320, 360, 400, 440, 480, 520, 560].map(y => (
            <rect key={`${x}-${y}`} x={x} y={y} width="8" height="8" rx="1" fill="#14b8a6" opacity="0.12" />
          ))
        )}
      </svg>
    </div>
  );
}

function WhatsAppMockup() {
  return (
    <div className="relative mx-auto w-[280px] h-[540px] lg:w-[300px] lg:h-[580px]">
      <div className="relative h-full w-full rounded-[2.35rem] border-[8px] border-white/15 bg-[#0b141a] shadow-[0_30px_70px_-15px_rgba(0,0,0,0.8),0_0_50px_-5px_rgba(16,185,129,0.25)] ring-1 ring-white/10">
        <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-black/90" />
        <div className="absolute inset-[7px] flex flex-col overflow-hidden rounded-[1.65rem] bg-[#0b141a]">
          <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-[#1f2c34] px-3 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">BR</div>
            <div>
              <span className="block text-xs font-semibold text-white">Clienta BR</span>
              <span className="block text-[10px] text-emerald-400">En línea</span>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden p-3">
            <div className="max-w-[92%] rounded-lg rounded-tl-sm bg-white/10 px-3 py-2 text-[11px] leading-snug text-white/95">
              Hola, vi el departamento de 2 habitaciones en La Carolina, ¿sigue disponible?
            </div>
            <div className="ml-auto max-w-[92%] rounded-lg rounded-tr-sm bg-[#005c4b] px-3 py-2 text-[11px] leading-snug text-white/95">
              ¡Hola! 🏠 Sí, la Suite 2BR en La Carolina está disponible. Tiene 85m², 2 baños, parqueadero y vista al parque. ¿Te gustaría agendar una visita?
            </div>
            <div className="max-w-[92%] rounded-lg rounded-tl-sm bg-white/10 px-3 py-2 text-[11px] leading-snug text-white/95">
              ¿Cuál es el precio? Y ¿acepta crédito hipotecario?
            </div>
            <div className="ml-auto max-w-[92%] rounded-lg rounded-tr-sm bg-[#005c4b] px-3 py-2 text-[11px] leading-snug text-white/95">
              El precio es $120.000. Sí, el proyecto trabaja con BIESS e instituciones privadas. Un asesor puede guiarte. ¿Te contacto? 📞
            </div>
            <div className="mt-auto flex items-center gap-1 rounded-full bg-white/5 px-2 py-1.5 text-[10px] text-white/40">
              <span className="inline-block h-1 w-1 rounded-full bg-white/30" />
              <span className="flex-1 text-center">Escribe un mensaje...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: Bot,
    title: 'IA Inmobiliaria 24/7',
    desc: 'Bot que califica leads automáticamente desde WhatsApp. Detecta intención de compra o renta y responde con información precisa del inmueble.',
  },
  {
    icon: Building2,
    title: 'Catálogo Inteligente',
    desc: 'Sube propiedades por formulario, CSV masivo o foto de flyer (Canva). La IA extrae toda la información automáticamente.',
  },
  {
    icon: FileText,
    title: 'Documentación',
    desc: 'Adjunta escrituras, planos y certificados. El bot responde preguntas técnicas sobre cada inmueble con precisión legal.',
  },
  {
    icon: TrendingUp,
    title: 'Lead Scoring',
    desc: 'Algoritmo que mide la probabilidad de cierre (0-100%) basado en presupuesto, urgencia, financiamiento y ubicación.',
  },
  {
    icon: MapPin,
    title: 'Ads → WhatsApp',
    desc: 'Conecta anuncios de Facebook e Instagram directamente al bot. El sistema identifica automáticamente qué inmueble vio el cliente.',
  },
  {
    icon: Users,
    title: 'Asignación de Agentes',
    desc: 'Cuando un lead supera el 75% de probabilidad, notifica al agente asignado por email y dashboard para agendar visita.',
  },
];

const STEPS = [
  { num: '01', title: 'Sube tus Propiedades', desc: 'CSV, formulario o foto de flyer. La IA hace el resto.' },
  { num: '02', title: 'Conecta WhatsApp', desc: 'Conexión oficial con WhatsApp API. Sin servidores ni programación.' },
  { num: '03', title: 'Recibe Leads Calificados', desc: 'El bot filtra, califica y te envía solo los mejores.' },
];

export default function BRELanding() {
  const { isAuthenticated, loading } = useAuth();
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await submitContact({
        name: formName,
        email: formEmail,
        message: `[BR Lead] Tel: ${formPhone}\n${formMessage}`,
        subject: 'Clienta BR — Demo Request',
      });
      setSent(true);
      setFormName(''); setFormEmail(''); setFormPhone(''); setFormMessage('');
    } catch {
      setFormError('Error al enviar. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }
  if (isAuthenticated) return <Navigate to="/br" replace />;

  return (
    <div className="bre-landing min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#020617]/95 backdrop-blur-xl transition-all">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/bre" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-black text-white shadow-lg shadow-emerald-500/25">
              BR
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white tracking-tight">Clienta</span>
              <span className="text-[10px] font-medium text-emerald-400 -mt-0.5 tracking-wider">BIENES RAÍCES</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <a href="#features" className="hidden text-sm font-medium text-white/70 transition-colors hover:text-white sm:inline">Funciones</a>
            <a href="#how" className="hidden text-sm font-medium text-white/70 transition-colors hover:text-white sm:inline">Proceso</a>
            <a href="#contact" className="hidden text-sm font-medium text-white/70 transition-colors hover:text-white sm:inline">Contacto</a>
            <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10">
              Iniciar Sesión
            </Link>
            <Link to="/signup" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-600/25 transition-colors hover:bg-emerald-500">
              Empezar Gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-[95vh] overflow-hidden bg-[#020617]">
        <RealEstateBackground />
        <div className="relative z-10 mx-auto grid min-h-[calc(95vh-4rem)] max-w-6xl grid-cols-1 items-center gap-8 px-4 pb-12 pt-24 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8">
          <div className="text-center lg:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-emerald-400 drop-shadow-md sm:text-sm">
              Soluciones Inmobiliarias con IA
            </p>
            <h1 className="mt-8 font-serif text-[2.5rem] font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              <span>Vende </span>
              <span className="text-emerald-400 drop-shadow-[0_0_25px_rgba(16,185,129,0.4)]">Inmuebles </span>
              <span>mientras </span>
              <span className="text-teal-400">duermes</span>
            </h1>
            <p className="mx-auto mt-10 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl lg:mx-0">
              Bot de WhatsApp con IA que califica leads, responde preguntas sobre tus propiedades
              y agenda visitas automáticamente. Para constructoras y agencias inmobiliarias en Ecuador.
            </p>
            <div className="mt-14 flex flex-wrap items-center justify-center gap-5 lg:justify-start">
              <a
                href="#contact"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-10 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-500 hover:shadow-emerald-500/30 hover:scale-[1.02]"
              >
                Solicitar Demo
                <ArrowRight className="h-5 w-5" />
              </a>
              <a
                href={BUSINESS_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-10 py-4 text-base font-semibold text-white transition-all hover:bg-white/10"
              >
                <WhatsAppGlyph className="h-5 w-5" />
                Hablar con Ventas
              </a>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center lg:items-end">
            <div className="relative">
              <div className="absolute -inset-20 bg-emerald-500/12 rounded-full blur-[100px] animate-pulse pointer-events-none" />
              <div className="relative z-10">
                <WhatsAppMockup />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-t border-gray-100 bg-white py-10">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-8 px-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Shield className="h-5 w-5 text-emerald-600" />
            <span>Datos en AWS Ecuador</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Bot className="h-5 w-5 text-emerald-600" />
            <span>IA Bedrock + Gemini</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <WhatsAppGlyph className="h-5 w-5 opacity-70" />
            <span>API Oficial de Meta</span>
          </div>
          <div className="flex items-center gap-5 border-l border-gray-100 pl-8">
            <div className="flex items-center gap-2 group cursor-default pr-5 border-r border-gray-100">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400">Powered by</span>
              <div className="flex items-center gap-2 transition-opacity group-hover:opacity-100">
                <img src="/logo.png" alt="Clienta AI" className="h-5 w-auto brightness-90 contrast-125" />
              </div>
            </div>
            <a href="https://aws.amazon.com/what-is-cloud-computing" target="_blank" rel="noopener noreferrer" className="opacity-40 hover:opacity-100 transition-opacity">
              <img src="https://d0.awsstatic.com/logos/powered-by-aws.png" alt="Powered by AWS" className="h-6 w-auto" loading="lazy" />
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 border-t border-gray-100 bg-slate-50 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-600 sm:text-sm">Funcionalidades</p>
            <h2 className="mt-4 font-serif text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Todo lo que tu Inmobiliaria Necesita
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
              Desde la captación del lead hasta la visita presencial, automatizado con inteligencia artificial.
            </p>
          </div>
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="group rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition-all hover:shadow-lg hover:border-emerald-200 hover:scale-[1.02]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                  <f.icon className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <h3 className="mt-5 text-lg font-bold text-gray-900">{f.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how" className="scroll-mt-20 border-t border-gray-100 bg-[#020617] py-16 md:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400 sm:text-sm">Proceso</p>
            <h2 className="mt-4 font-serif text-4xl font-bold tracking-tight text-white sm:text-5xl">
              3 Pasos para Empezar
            </h2>
          </div>
          <div className="mt-14 space-y-8">
            {STEPS.map((step, i) => (
              <div key={i} className="flex items-start gap-6 rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm transition-all hover:border-emerald-500/30 hover:bg-white/[0.07]">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-600/20 text-xl font-black text-emerald-400">
                  {step.num}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm text-slate-400">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact / Demo */}
      <section id="contact" className="scroll-mt-20 border-t border-gray-100 bg-white py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Solicita tu Demo Gratuita</h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-600">
              Te mostramos cómo Clienta BR puede transformar la captación de clientes de tu constructora o agencia.
            </p>
          </div>
          <div className="mx-auto mt-10 max-w-lg">
            <a
              href={BUSINESS_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#1fa851]"
            >
              <WhatsAppGlyph className="h-5 w-5" />
              Contactar por WhatsApp
            </a>
            {sent ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
                <Sparkles className="mx-auto h-8 w-8 text-emerald-600" />
                <p className="mt-4 font-semibold text-emerald-800">¡Mensaje enviado!</p>
                <p className="mt-2 text-sm text-emerald-700">Te contactaremos en menos de 24 horas.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div>
                  <label htmlFor="br-name" className="block text-sm font-medium text-gray-700">Nombre completo *</label>
                  <input id="br-name" type="text" required value={formName} onChange={e => setFormName(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                </div>
                <div>
                  <label htmlFor="br-email" className="block text-sm font-medium text-gray-700">Email empresarial *</label>
                  <input id="br-email" type="email" required value={formEmail} onChange={e => setFormEmail(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                </div>
                <div>
                  <label htmlFor="br-phone" className="block text-sm font-medium text-gray-700">Teléfono / WhatsApp</label>
                  <input id="br-phone" type="tel" value={formPhone} onChange={e => setFormPhone(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="+593 9XX XXX XXXX" />
                </div>
                <div>
                  <label htmlFor="br-message" className="block text-sm font-medium text-gray-700">¿Qué tipo de inmobiliaria o constructora eres?</label>
                  <textarea id="br-message" rows={3} value={formMessage} onChange={e => setFormMessage(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                </div>
                {formError && <p className="text-sm text-red-600">{formError}</p>}
                <button type="submit" disabled={submitting} className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50">
                  {submitting ? 'Enviando...' : 'Solicitar Demo Gratuita'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50/80 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <Link to="/bre" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-black text-white">BR</div>
              <span className="text-sm font-bold text-gray-900">Clienta BR</span>
            </Link>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <Link to="https://clientaai.com" className="transition-colors hover:text-gray-700">Clienta AI</Link>
              <a href="/privacy-policy.html" className="transition-colors hover:text-gray-700">Privacidad</a>
              <a href="/terms-and-conditions.html" className="transition-colors hover:text-gray-700">Términos</a>
            </div>
          </div>
          <p className="mt-6 text-center text-sm text-gray-500">
            © {new Date().getFullYear()} Clienta AI. Todos los derechos reservados. · Avenida Atahualpa y Victor Hugo, Ambato, Ecuador 180204
          </p>
        </div>
      </footer>
    </div>
  );
}
