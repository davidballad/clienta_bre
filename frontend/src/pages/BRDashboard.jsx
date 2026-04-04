import { useState, useEffect } from 'react';
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
  Filter,
} from 'lucide-react';

/** Mock stats for when API isn't connected yet */
const MOCK_STATS = {
  total: 24,
  by_status: { disponible: 18, reservado: 3, vendido: 2, rentado: 1 },
  by_type: { sale: 16, rent: 8 },
};

const MOCK_LEADS = [
  { name: 'María García', phone: '+593 998 123 456', score: 92, intent: 'buy', property: 'Suite 2BR La Carolina', time: 'Hace 5 min' },
  { name: 'Carlos Reyes', phone: '+593 997 654 321', score: 78, intent: 'rent', property: 'Oficina Centro Norte', time: 'Hace 20 min' },
  { name: 'Lucía Montenegro', phone: '+593 996 111 222', score: 65, intent: 'buy', property: 'Casa 3BR Cumbayá', time: 'Hace 1 hora' },
  { name: 'Andrés Torres', phone: '+593 995 333 444', score: 45, intent: 'buy', property: null, time: 'Hace 3 horas' },
];

const MOCK_PROPERTIES = [
  { id: '1', name: 'Suite 2BR La Carolina', city: 'Quito', price: 120000, type: 'sale', status: 'disponible', bedrooms: 2, area: 85, image: null },
  { id: '2', name: 'Casa Familiar Cumbayá', city: 'Quito', price: 250000, type: 'sale', status: 'disponible', bedrooms: 4, area: 220, image: null },
  { id: '3', name: 'Oficina Centro Norte', city: 'Quito', price: 800, type: 'rent', status: 'disponible', bedrooms: 0, area: 65, image: null },
  { id: '4', name: 'Depto Samborondón', city: 'Guayaquil', price: 1200, type: 'rent', status: 'reservado', bedrooms: 3, area: 140, image: null },
  { id: '5', name: 'Terreno Valle Tumbaco', city: 'Quito', price: 95000, type: 'sale', status: 'disponible', bedrooms: 0, area: 500, image: null },
  { id: '6', name: 'Penthouse González Suárez', city: 'Quito', price: 380000, type: 'sale', status: 'vendido', bedrooms: 3, area: 180, image: null },
];

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
  else color = 'bg-gray-100 text-gray-600';
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
  const isSale = property.type === 'sale';
  return (
    <div className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-lg hover:border-emerald-200">
      {/* Image placeholder */}
      <div className="relative h-40 bg-gradient-to-br from-gray-100 to-gray-200">
        {property.image ? (
          <img src={property.image} alt={property.name} className="h-full w-full object-cover" />
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
        <p className="mt-0.5 text-sm text-gray-500">{property.city}</p>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-lg font-bold text-emerald-700">
            ${property.price?.toLocaleString()}
            {!isSale && <span className="text-xs font-normal text-gray-400">/mes</span>}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {property.bedrooms > 0 && <span>{property.bedrooms} hab</span>}
            {property.area > 0 && <span>{property.area}m²</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BRDashboard() {
  const stats = MOCK_STATS;
  const leads = MOCK_LEADS;
  const properties = MOCK_PROPERTIES;

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
          value={stats.total}
          color="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          icon={CheckCircle2}
          label="Disponibles"
          value={stats.by_status.disponible}
          color="bg-green-100 text-green-700"
        />
        <StatCard
          icon={Home}
          label="Venta"
          value={stats.by_type.sale}
          color="bg-blue-100 text-blue-700"
          subtext={`${stats.by_type.rent} en renta`}
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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {properties.slice(0, 6).map((prop) => (
              <PropertyCard key={prop.id} property={prop} />
            ))}
          </div>
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
