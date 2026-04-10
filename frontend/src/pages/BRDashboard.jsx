import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  TrendingUp,
  Users,
  DollarSign,
  Plus,
  Upload,
  ArrowUpRight,
  Home,
  Key,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MapPin,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useProperties, usePropertyStats, useSyncVectors } from '../hooks/useProperties';
import { useContacts } from '../hooks/useContacts';

function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMinutes = Math.floor((now - date) / 60000);
  if (diffMinutes < 1) return 'Hace un momento';
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Hace ${diffHours} horas`;
  return `Hace ${Math.floor(diffHours / 24)} días`;
}

/* ── Sub-components ────────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, color, subtext }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
      {subtext && <p className="mt-2 text-xs text-gray-400">{subtext}</p>}
    </div>
  );
}

function ScoreBadge({ score }) {
  let color = 'bg-gray-100 text-gray-600';
  if (score >= 75) color = 'bg-emerald-100 text-emerald-700';
  else if (score >= 50) color = 'bg-amber-100 text-amber-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      {score}%
    </span>
  );
}

function StatusBadge({ status }) {
  const colors = {
    disponible: 'bg-emerald-100 text-emerald-700',
    reservado: 'bg-amber-100 text-amber-700',
    vendido: 'bg-blue-100 text-blue-700',
    rentado: 'bg-purple-100 text-purple-700',
  };
  const labels = {
    disponible: 'Disponible',
    reservado: 'Reservado',
    vendido: 'Vendido',
    rentado: 'Rentado',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
      {labels[status] || status}
    </span>
  );
}

function PropertyCard({ property }) {
  const isSale = property.transaction_type === 'sale';
  const price = Number(property.price) || 0;
  return (
    <Link
      to={`/br/properties/${property.id}`}
      className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-lg hover:border-emerald-200"
    >
      <div className="relative h-40 bg-gradient-to-br from-gray-100 to-gray-200">
        {property.image_url ? (
          <img src={property.image_url} alt={property.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Building2 className="h-12 w-12 text-gray-300" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <StatusBadge status={property.status} />
        </div>
        <div className="absolute top-2 right-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${isSale ? 'bg-emerald-600 text-white' : 'bg-teal-600 text-white'}`}>
            {isSale ? 'Venta' : 'Renta'}
          </span>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 truncate">{property.name}</h3>
        <div className="mt-0.5 flex items-center gap-1 text-sm text-gray-500">
          <MapPin className="h-3 w-3" />
          {property.city || 'Sin ciudad'}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-lg font-bold text-emerald-700">
            ${price.toLocaleString()}
            {!isSale && <span className="text-xs font-normal text-gray-400">/mes</span>}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {property.bedrooms > 0 && <span>{property.bedrooms} hab</span>}
            {property.area_m2 > 0 && <span>{Number(property.area_m2)}m²</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ── Main Dashboard ────────────────────────────────────────────────── */

export default function BRDashboard() {
  const { data: statsData, isLoading: statsLoading } = usePropertyStats();
  const { data: propsData, isLoading: propsLoading } = useProperties({ limit: 6 });
  const { data: contactsData, isLoading: contactsLoading } = useContacts({ limit: 10 });
  const syncMutation = useSyncVectors();

  const stats = statsData || { total: 0, by_status: {}, by_type: {} };
  const properties = propsData?.properties || [];
  
  const leads = (contactsData?.contacts || []).map(c => ({
    id: c.contact_id,
    name: c.name || 'Sin nombre',
    phone: c.phone || '',
    score: c.lead_score || 0,
    intent: c.lead_intent || 'buy',
    property: c.interested_property_id ? `ID: ${c.interested_property_id.substring(0, 8)}` : null,
    time: formatTime(c.last_activity_ts || c.created_ts)
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel Inmobiliario</h1>
          <p className="mt-1 text-sm text-gray-500">Resumen de propiedades y leads activos</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/br/properties/new"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-500"
          >
            <Plus className="h-4 w-4" />
            Agregar Inmueble
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Building2}
          label="Total Propiedades"
          value={statsLoading ? '...' : stats.total}
          color="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          icon={CheckCircle2}
          label="Disponibles"
          value={statsLoading ? '...' : (stats.by_status?.disponible || 0)}
          color="bg-green-100 text-green-700"
        />
        <StatCard
          icon={Home}
          label="Venta"
          value={statsLoading ? '...' : (stats.by_type?.sale || 0)}
          color="bg-blue-100 text-blue-700"
          subtext={`${stats.by_type?.rent || 0} en renta`}
        />
        <StatCard
          icon={TrendingUp}
          label="Leads Hot (>75%)"
          value={leads.filter(l => l.score >= 75).length}
          color="bg-red-100 text-red-700"
          subtext="Requieren atención"
        />
      </div>

      {/* Two columns: Hot Leads + Recent Properties */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Hot Leads Panel */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="flex items-center gap-2 font-semibold text-gray-900">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              Leads Calientes
            </h2>
            <Link to="/br/leads" className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-500">
              Ver todos <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {leads.map((lead, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-gray-50">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                  lead.score >= 75 ? 'bg-emerald-600' : lead.score >= 50 ? 'bg-amber-500' : 'bg-gray-400'
                }`}>
                  {lead.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{lead.name}</p>
                  <p className="truncate text-xs text-gray-400">
                    {lead.property || 'Sin inmueble asignado'} · {lead.time}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <ScoreBadge score={lead.score} />
                  <span className={`text-[10px] font-medium ${lead.intent === 'buy' ? 'text-emerald-600' : 'text-teal-600'}`}>
                    {lead.intent === 'buy' ? 'Compra' : 'Renta'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Property Gallery */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 font-semibold text-gray-900">
              <Building2 className="h-5 w-5 text-emerald-600" />
              Propiedades Recientes
            </h2>
            <Link to="/br/properties" className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-500">
              Ver galería <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          {propsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            </div>
          ) : properties.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {properties.slice(0, 6).map((prop) => (
                <PropertyCard key={prop.id} property={prop} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-gray-300">
              <Building2 className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500 mb-2">Aún no hay propiedades</p>
              <Link to="/br/properties/new" className="text-sm font-medium text-emerald-600 hover:text-emerald-500">
                Agregar primera propiedad →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          to="/br/properties/new"
          className="flex items-center gap-4 rounded-xl border border-dashed border-gray-300 bg-white p-5 transition-all hover:border-emerald-400 hover:bg-emerald-50/50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <Plus className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Agregar Propiedad</p>
            <p className="text-xs text-gray-500">Formulario o foto de flyer</p>
          </div>
        </Link>
        <Link
          to="/br/properties"
          className="flex items-center gap-4 rounded-xl border border-dashed border-gray-300 bg-white p-5 transition-all hover:border-emerald-400 hover:bg-emerald-50/50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Importar CSV</p>
            <p className="text-xs text-gray-500">Carga masiva de inmuebles</p>
          </div>
        </Link>
        <Link
          to="/br/settings"
          className="flex items-center gap-4 rounded-xl border border-dashed border-gray-300 bg-white p-5 transition-all hover:border-emerald-400 hover:bg-emerald-50/50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Conectar WhatsApp</p>
            <p className="text-xs text-gray-500">API oficial de Meta</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
