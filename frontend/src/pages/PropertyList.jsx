import { useState, useRef, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  Search,
  Filter,
  Plus,
  Upload,
  Download,
  X,
  Home,
  Key,
  MapPin,
  ChevronDown,
  Loader2,
  ImagePlus,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  Eye,
  Pencil,
  Trash2,
  RefreshCw,
  Share2,
  Link2,
} from 'lucide-react';
import { useProperties, useDeleteProperty, useImportProperties, useExtractFlyer, useSyncVectors } from '../hooks/useProperties';
import { downloadPropertyTemplate } from '../api/properties';
import { getTenantConfig } from '../api/onboarding';
import { useAuth } from '../context/AuthContext';

/* ── Status / Type Badges ──────────────────────────────────────────── */

function StatusBadge({ status }) {
  const map = {
    disponible: { label: 'Disponible', cls: 'bg-emerald-100 text-emerald-700' },
    reservado: { label: 'Reservado', cls: 'bg-amber-100 text-amber-700' },
    vendido: { label: 'Vendido', cls: 'bg-blue-100 text-blue-700' },
    rentado: { label: 'Rentado', cls: 'bg-purple-100 text-purple-700' },
  };
  const s = map[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

function TxBadge({ type }) {
  const isSale = type === 'sale';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isSale ? 'bg-emerald-600 text-white' : 'bg-teal-600 text-white'}`}>
      {isSale ? 'Venta' : 'Renta'}
    </span>
  );
}

/* ── Property Card ─────────────────────────────────────────────────── */

function PropertyCard({ property, onDelete, supportPhone, tenantId }) {
  const navigate = useNavigate();
  const isSale = property.transaction_type === 'sale';
  const price = Number(property.price) || 0;
  const [copied, setCopied] = useState(null); // 'wa' | 'link' | null

  const ref = property.reference_code || property.id;
  const txLabel = isSale ? 'Venta' : 'Renta';
  const waText = `Hola! 👋 Estoy interesado en la propiedad: "${property.name}" (${txLabel}) — $${price.toLocaleString()}. Ref: ${ref}. ¿Me pueden dar más información?`;
  const waUrl = supportPhone ? `https://wa.me/${supportPhone}?text=${encodeURIComponent(waText)}` : null;
  const pageUrl = tenantId ? `${window.location.origin}/propiedades/${tenantId}/${property.id}` : null;

  const copy = (text, type) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <div className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-lg hover:border-emerald-200">
      {/* Image */}
      <div className="relative h-44 bg-gradient-to-br from-gray-100 to-gray-200">
        {property.image_url ? (
          <img src={property.image_url} alt={property.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Building2 className="h-12 w-12 text-gray-300" />
          </div>
        )}
        <div className="absolute top-2 left-2"><StatusBadge status={property.status} /></div>
        <div className="absolute top-2 right-2"><TxBadge type={property.transaction_type} /></div>
        {/* Hover actions */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
          <button
            onClick={() => navigate(`/br/properties/${property.id}`)}
            className="rounded-lg bg-white/90 p-2 text-gray-700 shadow-sm transition hover:bg-white"
            title="Editar"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete?.(property)}
            className="rounded-lg bg-white/90 p-2 text-red-600 shadow-sm transition hover:bg-white"
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {waUrl && (
            <button
              onClick={() => copy(waUrl, 'wa')}
              className={`rounded-lg p-2 shadow-sm transition ${copied === 'wa' ? 'bg-emerald-500 text-white' : 'bg-white/90 text-emerald-600 hover:bg-white'}`}
              title="Copiar enlace WhatsApp (para Meta Ads)"
            >
              {copied === 'wa' ? <CheckCircle className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            </button>
          )}
          {pageUrl && (
            <button
              onClick={() => copy(pageUrl, 'link')}
              className={`rounded-lg p-2 shadow-sm transition ${copied === 'link' ? 'bg-blue-500 text-white' : 'bg-white/90 text-blue-600 hover:bg-white'}`}
              title="Copiar enlace de página (para publicaciones)"
            >
              {copied === 'link' ? <CheckCircle className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>
      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 truncate">{property.name}</h3>
        <div className="mt-0.5 flex items-center gap-1 text-sm text-gray-500">
          <MapPin className="h-3.5 w-3.5" />
          {property.city || 'Sin ciudad'}{property.neighborhood ? `, ${property.neighborhood}` : ''}
        </div>
        {property.reference_code && (
          <p className="mt-0.5 text-xs text-gray-400">Ref: {property.reference_code}</p>
        )}
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
    </div>
  );
}

/* ── CSV Import Modal ──────────────────────────────────────────────── */

function CSVImportModal({ open, onClose }) {
  const fileRef = useRef(null);
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const importMutation = useImportProperties();

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setCsvText(reader.result);
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvText.trim()) return;
    try {
      await importMutation.mutateAsync(csvText);
      onClose?.();
      setCsvText('');
      setFileName('');
    } catch {
      // error handled by mutation
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Importar Propiedades CSV
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <button
              onClick={() => downloadPropertyTemplate()}
              className="inline-flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-500"
            >
              <Download className="h-4 w-4" />
              Descargar plantilla CSV
            </button>
          </div>
          <div>
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-8 text-sm font-medium text-gray-500 transition hover:border-emerald-400 hover:text-emerald-600"
            >
              <Upload className="h-5 w-5" />
              {fileName || 'Seleccionar archivo CSV'}
            </button>
          </div>
          {csvText && (
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500 mb-1">Vista previa:</p>
              <pre className="max-h-32 overflow-auto text-xs text-gray-700 whitespace-pre-wrap">
                {csvText.slice(0, 500)}{csvText.length > 500 ? '...' : ''}
              </pre>
            </div>
          )}
          {importMutation.isSuccess && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle className="h-4 w-4" />
              {importMutation.data?.imported_count ?? 0} propiedades importadas
              {importMutation.data?.error_count > 0 && (
                <span className="text-amber-600">({importMutation.data.error_count} errores)</span>
              )}
            </div>
          )}
          {importMutation.isError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4" />
              {importMutation.error?.message || 'Error al importar'}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cerrar
          </button>
          <button
            onClick={handleImport}
            disabled={!csvText || importMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
          >
            {importMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main PropertyList Page ────────────────────────────────────────── */

export default function PropertyList() {
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [txFilter, setTxFilter] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [supportPhone, setSupportPhone] = useState('');

  useEffect(() => {
    getTenantConfig().then(cfg => {
      if (cfg?.support_phone) setSupportPhone(cfg.support_phone.replace(/[^\d+]/g, ''));
    }).catch(() => {});
  }, []);

  const deleteMutation = useDeleteProperty();
  const syncMutation = useSyncVectors();

  const filters = {};
  if (search) filters.search = search;
  if (statusFilter) filters.status = statusFilter;
  if (txFilter) filters.transactionType = txFilter;
  filters.limit = 50;

  const { data, isLoading, isError } = useProperties(filters);
  const properties = data?.properties || [];

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch {}
  };

  const handleSync = () => syncMutation.mutate();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Propiedades</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isLoading ? 'Cargando...' : `${properties.length} inmueble${properties.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSync}
            disabled={syncMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            title="Sincronizar vectores RAG"
          >
            <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Sync RAG
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Importar CSV
          </button>
          <Link
            to="/br/properties/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500"
          >
            <Plus className="h-4 w-4" />
            Agregar
          </Link>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, ciudad, barrio o código..."
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
            showFilters || statusFilter || txFilter
              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Filter className="h-4 w-4" />
          Filtros
          <ChevronDown className={`h-3.5 w-3.5 transition ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Filter pills */}
      {showFilters && (
        <div className="flex flex-wrap gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Estado</label>
            <div className="flex gap-1.5">
              {[
                { v: '', l: 'Todos' },
                { v: 'disponible', l: 'Disponible' },
                { v: 'reservado', l: 'Reservado' },
                { v: 'vendido', l: 'Vendido' },
                { v: 'rentado', l: 'Rentado' },
              ].map(opt => (
                <button
                  key={opt.v}
                  onClick={() => setStatusFilter(opt.v)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    statusFilter === opt.v ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Tipo</label>
            <div className="flex gap-1.5">
              {[
                { v: '', l: 'Todos' },
                { v: 'sale', l: '🏠 Venta' },
                { v: 'rent', l: '🔑 Renta' },
              ].map(opt => (
                <button
                  key={opt.v}
                  onClick={() => setTxFilter(opt.v)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    txFilter === opt.v ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
          {(statusFilter || txFilter) && (
            <button
              onClick={() => { setStatusFilter(''); setTxFilter(''); }}
              className="flex items-center gap-1 self-end text-xs font-medium text-red-500 hover:text-red-600"
            >
              <X className="h-3.5 w-3.5" /> Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-10 text-sm text-red-600">
          <AlertTriangle className="h-5 w-5" />
          Error cargando propiedades
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && properties.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 mb-4">
            <Building2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {search ? 'Sin resultados' : 'Sin propiedades'}
          </h3>
          <p className="text-sm text-gray-500 mb-4 max-w-sm">
            {search
              ? 'Intenta con otros términos de búsqueda o ajusta los filtros.'
              : 'Agrega tu primer inmueble manualmente, desde un flyer, o importa un CSV.'}
          </p>
          {!search && (
            <div className="flex gap-2">
              <Link
                to="/br/properties/new"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                <Plus className="h-4 w-4" /> Agregar
              </Link>
              <button
                onClick={() => setShowImport(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Upload className="h-4 w-4" /> Importar CSV
              </button>
            </div>
          )}
        </div>
      )}

      {/* Property Grid */}
      {!isLoading && properties.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {properties.map(prop => (
            <PropertyCard key={prop.id} property={prop} onDelete={setDeleteTarget} supportPhone={supportPhone} tenantId={tenantId} />
          ))}
        </div>
      )}

      {/* Sync success toast */}
      {syncMutation.isSuccess && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          <CheckCircle className="h-4 w-4" />
          {syncMutation.data?.synced_count ?? 0} propiedades sincronizadas con RAG
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">¿Eliminar propiedad?</h3>
            <p className="text-sm text-gray-500 mb-1">{deleteTarget.name}</p>
            <p className="text-xs text-gray-400 mb-5">Esta acción no se puede deshacer. También se eliminarán los vectores RAG asociados.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      <CSVImportModal open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}
