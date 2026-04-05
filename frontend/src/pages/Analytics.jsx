import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Building2, CheckCircle, Users, TrendingUp } from 'lucide-react';
import { usePropertyStats } from '../hooks/useProperties';
import { useContactStats } from '../hooks/useContacts';

const STATUS_COLORS = {
  disponible: '#10b981',
  reservado: '#f59e0b',
  vendido:   '#6366f1',
  rentado:   '#06b6d4',
};

const STATUS_LABELS = {
  disponible: 'Disponible',
  reservado:  'Reservado',
  vendido:    'Vendido',
  rentado:    'Rentado',
};

const PIPELINE_COLORS = {
  prospect:    '#6366f1',
  interested:  '#f59e0b',
  closed_won:  '#10b981',
  abandoned:   '#ef4444',
};

const PIPELINE_LABELS = {
  prospect:   'Prospecto',
  interested: 'Interesado',
  closed_won: 'Compró',
  abandoned:  'Abandonado',
};

const TIER_COLORS = {
  bronze: '#cd7f32',
  silver: '#a8a9ad',
  gold:   '#f59e0b',
};

function StatCard({ icon: Icon, label, value, sub, color }) {
  const palette = {
    emerald: 'bg-emerald-50 text-emerald-600',
    indigo:  'bg-indigo-50 text-indigo-600',
    amber:   'bg-amber-50 text-amber-600',
    teal:    'bg-teal-50 text-teal-600',
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
        </div>
        <div className={`rounded-lg p-2 ${palette[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return <p className="py-8 text-center text-sm text-gray-400">Sin datos disponibles</p>;
}

export default function Analytics() {
  const { data: propStats, isLoading: loadingProps } = usePropertyStats();
  const { data: contactStats, isLoading: loadingContacts } = useContactStats();

  const isLoading = loadingProps || loadingContacts;

  // Property status data
  const propertyStatusData = propStats?.by_status
    ? Object.entries(propStats.by_status)
        .filter(([, v]) => v > 0)
        .map(([key, value]) => ({
          name: STATUS_LABELS[key] || key,
          value,
          fill: STATUS_COLORS[key] || '#94a3b8',
        }))
    : [];

  // Property type data
  const propertyTypeData = propStats?.by_type
    ? [
        { name: 'Venta', value: propStats.by_type.sale || 0, fill: '#6366f1' },
        { name: 'Arriendo', value: propStats.by_type.rent || 0, fill: '#10b981' },
      ].filter((d) => d.value > 0)
    : [];

  // Lead pipeline data
  const pipelineData = contactStats?.by_status
    ? Object.entries(contactStats.by_status)
        .map(([key, value]) => ({
          name: PIPELINE_LABELS[key] || key,
          value,
          fill: PIPELINE_COLORS[key] || '#94a3b8',
        }))
    : [];

  // Lead tier data
  const tierData = contactStats?.by_tier
    ? Object.entries(contactStats.by_tier)
        .filter(([, v]) => v > 0)
        .map(([key, value]) => ({
          name: key.charAt(0).toUpperCase() + key.slice(1),
          value,
          fill: TIER_COLORS[key] || '#94a3b8',
        }))
    : [];

  const disponible = propStats?.by_status?.disponible ?? 0;
  const goldLeads  = contactStats?.by_tier?.gold ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analíticas</h1>
        <p className="mt-0.5 text-sm text-gray-500">Resumen de propiedades y leads</p>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={Building2}
              label="Total propiedades"
              value={propStats?.total ?? 0}
              color="emerald"
            />
            <StatCard
              icon={CheckCircle}
              label="Disponibles"
              value={disponible}
              sub={propStats?.total ? `${Math.round((disponible / propStats.total) * 100)}% del inventario` : undefined}
              color="teal"
            />
            <StatCard
              icon={Users}
              label="Total leads"
              value={contactStats?.total ?? 0}
              color="indigo"
            />
            <StatCard
              icon={TrendingUp}
              label="Leads calientes"
              value={goldLeads}
              sub="Nivel gold"
              color="amber"
            />
          </div>

          {/* Properties row */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* By status */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-gray-800">Propiedades por estado</h2>
              {propertyStatusData.length === 0 ? <EmptyState /> : (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie
                        data={propertyStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {propertyStatusData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, name) => [v, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="space-y-2">
                    {propertyStatusData.map((entry) => (
                      <li key={entry.name} className="flex items-center gap-2 text-sm">
                        <span className="inline-block h-3 w-3 rounded-full" style={{ background: entry.fill }} />
                        <span className="text-gray-600">{entry.name}</span>
                        <span className="ml-auto font-semibold text-gray-900">{entry.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* By type */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-gray-800">Propiedades por tipo</h2>
              {propertyTypeData.length === 0 ? <EmptyState /> : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={propertyTypeData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} width={32} />
                    <Tooltip formatter={(v, name) => [v, name]} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {propertyTypeData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Leads row */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Pipeline */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-gray-800">Pipeline de leads</h2>
              {pipelineData.every((d) => d.value === 0) ? <EmptyState /> : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart
                    data={pipelineData}
                    layout="vertical"
                    margin={{ top: 0, right: 16, bottom: 0, left: 90 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip formatter={(v) => [v, 'Leads']} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {pipelineData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Tier breakdown */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-gray-800">Leads por nivel</h2>
              {tierData.length === 0 ? <EmptyState /> : (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie
                        data={tierData}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {tierData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, name) => [v, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="space-y-2">
                    {tierData.map((entry) => (
                      <li key={entry.name} className="flex items-center gap-2 text-sm">
                        <span className="inline-block h-3 w-3 rounded-full" style={{ background: entry.fill }} />
                        <span className="text-gray-600">{entry.name}</span>
                        <span className="ml-auto font-semibold text-gray-900">{entry.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
