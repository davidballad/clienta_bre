import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays, Clock, Mail, Phone, User, Building2,
  CheckCircle2, XCircle, RefreshCw, ChevronDown, X,
  Search, Filter, Ban, Plus, Trash2, CalendarOff,
} from 'lucide-react';
import {
  fetchAppointments, patchAppointment,
  fetchBlockedDates, blockDate, unblockDate,
} from '../api/appointments';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_META = {
  confirmed: {
    label: 'Confirmada',
    icon: CheckCircle2,
    chip: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  cancelled: {
    label: 'Cancelada',
    icon: XCircle,
    chip: 'bg-red-100 text-red-700 border-red-200',
    dot: 'bg-red-500',
  },
  rescheduled: {
    label: 'Reagendada',
    icon: RefreshCw,
    chip: 'bg-amber-100 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
};

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'confirmed', label: 'Confirmadas' },
  { value: 'cancelled', label: 'Canceladas' },
  { value: 'rescheduled', label: 'Reagendadas' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('es', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Intl.DateTimeFormat('es', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    }).format(new Date(dateStr + 'T12:00:00'));
  } catch {
    return dateStr;
  }
}

function isUpcoming(iso) {
  if (!iso) return false;
  return new Date(iso) > new Date();
}

function toLocalDatetimeInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.confirmed;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

// ─── Cancel modal ─────────────────────────────────────────────────────────────

function CancelModal({ appointment, onConfirm, onClose, isPending }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Cancelar cita</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            ¿Seguro que deseas cancelar la cita de{' '}
            <strong>{appointment.contact_name || appointment.contact_phone || 'este contacto'}</strong>
            {appointment.scheduled_at && (
              <> agendada para el <strong>{formatDateTime(appointment.scheduled_at)}</strong></>
            )}?
          </p>
          <p className="text-xs text-gray-400">
            Esta acción <strong>no</strong> eliminará el evento de Google Calendar automáticamente.
          </p>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Mantener
            </button>
            <button
              onClick={() => onConfirm(appointment.appointment_id)}
              disabled={isPending}
              className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Cancelando…' : 'Cancelar cita'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Reschedule modal ─────────────────────────────────────────────────────────

function RescheduleModal({ appointment, onConfirm, onClose, isPending }) {
  const [newDatetime, setNewDatetime] = useState(toLocalDatetimeInput(appointment.scheduled_at));
  const [newDuration, setNewDuration] = useState(appointment.duration_minutes || 60);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newDatetime) return;
    const utcIso = new Date(newDatetime).toISOString();
    onConfirm(appointment.appointment_id, { scheduled_at: utcIso, duration_minutes: Number(newDuration), status: 'rescheduled' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Reagendar cita</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            Cita de <strong>{appointment.contact_name || appointment.contact_phone || 'este contacto'}</strong>
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nueva fecha y hora</label>
            <input
              type="datetime-local"
              required
              value={newDatetime}
              onChange={(e) => setNewDatetime(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Duración (minutos)</label>
            <select
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
              className="input-field"
            >
              {[30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>{m} min</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || !newDatetime}
              className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Guardando…' : 'Reagendar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Appointment card ─────────────────────────────────────────────────────────

function AppointmentCard({ appointment, onCancel, onReschedule }) {
  const upcoming = isUpcoming(appointment.scheduled_at);
  const status = appointment.status || 'confirmed';

  return (
    <div className={`rounded-xl border bg-white shadow-sm transition-all hover:shadow-md ${upcoming && status === 'confirmed' ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-sm font-bold text-white shadow">
            {(appointment.contact_name || '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{appointment.contact_name || 'Sin nombre'}</p>
            <StatusBadge status={status} />
          </div>
        </div>
        {upcoming && status === 'confirmed' && (
          <span className="shrink-0 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">Próxima</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 px-4 pb-4 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-2 text-gray-700">
          <CalendarDays className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="truncate">{formatDateTime(appointment.scheduled_at)}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-500">
          <Clock className="h-4 w-4 shrink-0 text-gray-400" />
          <span>{appointment.duration_minutes || 60} min</span>
        </div>
        {appointment.contact_email && (
          <div className="flex items-center gap-2 text-gray-600 sm:col-span-2">
            <Mail className="h-4 w-4 shrink-0 text-gray-400" />
            <a href={`mailto:${appointment.contact_email}`} className="truncate hover:text-emerald-700 hover:underline">{appointment.contact_email}</a>
          </div>
        )}
        {appointment.contact_phone && (
          <div className="flex items-center gap-2 text-gray-600">
            <Phone className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="truncate">{appointment.contact_phone}</span>
          </div>
        )}
        {appointment.property_name && (
          <div className="flex items-center gap-2 text-gray-600">
            <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="truncate">{appointment.property_name}</span>
          </div>
        )}
        {appointment.notes && (
          <div className="flex items-start gap-2 text-gray-500 sm:col-span-2">
            <span className="mt-0.5 shrink-0 text-xs font-semibold uppercase text-gray-400">Nota:</span>
            <p className="line-clamp-2 text-xs">{appointment.notes}</p>
          </div>
        )}
        {appointment.contact_id && (
          <div className="sm:col-span-2 pt-1">
            <Link to={`/br/leads/${appointment.contact_id}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:underline">
              <User className="h-3.5 w-3.5" />
              Ver perfil del lead
            </Link>
          </div>
        )}
      </div>

      {status === 'confirmed' && (
        <div className="border-t border-gray-100 px-4 py-3 flex items-center gap-2">
          <button
            onClick={() => onReschedule(appointment)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reagendar
          </button>
          <button
            onClick={() => onCancel(appointment)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <XCircle className="h-3.5 w-3.5" />
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Blocked dates panel ──────────────────────────────────────────────────────

function BlockedDatesPanel() {
  const queryClient = useQueryClient();
  const [newDate, setNewDate] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['blocked-dates'],
    queryFn: fetchBlockedDates,
    staleTime: 60_000,
  });

  const blockMutation = useMutation({
    mutationFn: (date) => blockDate(date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-dates'] });
      setNewDate('');
    },
  });

  const unblockMutation = useMutation({
    mutationFn: (date) => unblockDate(date),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blocked-dates'] }),
  });

  const blockedDates = data?.blocked_dates || [];
  const today = new Date().toISOString().split('T')[0];

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newDate) return;
    blockMutation.mutate(newDate);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
        <CalendarOff className="h-4 w-4 text-gray-400" />
        <h2 className="text-sm font-bold text-gray-700">Fechas bloqueadas</h2>
        <span className="ml-auto text-xs text-gray-400">El agente de WhatsApp no ofrecerá estas fechas</span>
      </div>

      <div className="p-5 space-y-4">
        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <input
            type="date"
            value={newDate}
            min={today}
            onChange={(e) => setNewDate(e.target.value)}
            className="input-field flex-1"
          />
          <button
            type="submit"
            disabled={!newDate || blockMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Bloquear
          </button>
        </form>

        {isLoading && <p className="text-sm text-gray-400">Cargando…</p>}

        {!isLoading && blockedDates.length === 0 && (
          <p className="text-sm text-gray-400">Sin fechas bloqueadas.</p>
        )}

        {blockedDates.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {blockedDates.map((d) => (
              <li key={d} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Ban className="h-4 w-4 text-red-400" />
                  {formatDate(d)}
                </div>
                <button
                  onClick={() => unblockMutation.mutate(d)}
                  disabled={unblockMutation.isPending}
                  className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                  title="Eliminar bloqueo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Appointments() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['appointments', { status: statusFilter, phone: phoneSearch }],
    queryFn: () => fetchAppointments({ status: statusFilter || undefined, phone: phoneSearch.trim() || undefined }),
    staleTime: 30_000,
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, updates }) => patchAppointment(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setCancelTarget(null);
      setRescheduleTarget(null);
    },
  });

  const handleCancelConfirm = useCallback(
    (appointmentId) => patchMutation.mutate({ id: appointmentId, updates: { status: 'cancelled' } }),
    [patchMutation]
  );

  const handleRescheduleConfirm = useCallback(
    (appointmentId, updates) => patchMutation.mutate({ id: appointmentId, updates }),
    [patchMutation]
  );

  const appointments = data?.appointments || [];
  const upcoming = appointments.filter((a) => a.status === 'confirmed' && isUpcoming(a.scheduled_at));
  const past = appointments.filter((a) => !(a.status === 'confirmed' && isUpcoming(a.scheduled_at)));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Citas agendadas</h1>
          <p className="text-sm text-gray-500">
            {isLoading ? 'Cargando…' : `${appointments.length} cita${appointments.length !== 1 ? 's' : ''} encontrada${appointments.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={phoneSearch}
              onChange={(e) => setPhoneSearch(e.target.value)}
              placeholder="Buscar por teléfono…"
              className="rounded-lg border border-gray-300 py-2 pl-8 pr-3 text-sm text-gray-800 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44"
            />
            {phoneSearch && (
              <button onClick={() => setPhoneSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none rounded-lg border border-gray-300 py-2 pl-8 pr-8 text-sm text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error.message || 'Error al cargar las citas.'}
        </div>
      )}

      {!isLoading && !error && appointments.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <CalendarDays className="mb-3 h-12 w-12 text-gray-300" />
          <p className="font-semibold text-gray-600">No hay citas agendadas</p>
          <p className="mt-1 max-w-xs text-sm text-gray-400">
            Las citas se crean automáticamente cuando un lead agenda una visita a través del agente de WhatsApp.
          </p>
        </div>
      )}

      {!isLoading && upcoming.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-700">Próximas ({upcoming.length})</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {upcoming.map((appt) => (
              <AppointmentCard key={appt.appointment_id} appointment={appt} onCancel={setCancelTarget} onReschedule={setRescheduleTarget} />
            ))}
          </div>
        </section>
      )}

      {!isLoading && past.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-gray-400" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Historial ({past.length})</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {past.map((appt) => (
              <AppointmentCard key={appt.appointment_id} appointment={appt} onCancel={setCancelTarget} onReschedule={setRescheduleTarget} />
            ))}
          </div>
        </section>
      )}

      {/* Blocked dates */}
      <BlockedDatesPanel />

      {/* Modals */}
      {cancelTarget && (
        <CancelModal
          appointment={cancelTarget}
          onConfirm={handleCancelConfirm}
          onClose={() => setCancelTarget(null)}
          isPending={patchMutation.isPending}
        />
      )}
      {rescheduleTarget && (
        <RescheduleModal
          appointment={rescheduleTarget}
          onConfirm={handleRescheduleConfirm}
          onClose={() => setRescheduleTarget(null)}
          isPending={patchMutation.isPending}
        />
      )}
    </div>
  );
}
