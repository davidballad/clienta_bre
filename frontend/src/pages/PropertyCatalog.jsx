import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchPublicProperties } from '../api/properties';
import { 
  Building2, 
  MapPin, 
  Bed, 
  Bath, 
  Maximize, 
  Search,
  ChevronRight,
  Phone,
  MessageCircle,
  Home
} from 'lucide-react';

export default function PropertyCatalog() {
  const { tenantId } = useParams();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [transactionType, setTransactionType] = useState('all');
  const [meta, setMeta] = useState({ business_name: 'Catálogo Inmobiliario', support_phone: '' });

  useEffect(() => {
    // Fetch Metadata (Name & Phone)
    const baseUrl = import.meta.env.VITE_API_URL || '';
    fetch(`${baseUrl}/onboarding/meta?tenant_id=${tenantId}`)
      .then(res => res.json())
      .then(data => {
        if (data.business_name) {
          setMeta({
            business_name: data.business_name,
            support_phone: data.support_phone?.replace(/[^\d+]/g, '') || ''
          });
        }
      })
      .catch(err => console.error("Error loading agency meta:", err));

    let cancelled = false;
    setLoading(true);
    fetchPublicProperties(tenantId, { 
      search: search.trim() || undefined,
      transactionType: transactionType === 'all' ? undefined : transactionType
    })
      .then(data => {
        if (!cancelled) {
          setProperties(data.properties || []);
          setError(null);
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [tenantId, search, transactionType]);

  const stats = {
    total: properties.length,
    sale: properties.filter(p => p.transaction_type === 'sale').length,
    rent: properties.filter(p => p.transaction_type === 'rent').length,
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900 tracking-tight uppercase">{meta.business_name}</h1>
              <p className="text-[10px] font-medium text-gray-500 tracking-widest uppercase -mt-0.5">Catálogo Inmobiliario</p>
            </div>
          </div>
          <Link to="/" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1">
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Portal</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Filters and Promo */}
        <div className="mb-10 lg:flex lg:items-end lg:justify-between gap-6">
          <div className="flex-1 max-w-2xl">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Propiedades Disponibles</h2>
            <p className="text-gray-500 mb-6">Explora nuestra selección exclusiva de inmuebles en venta y renta.</p>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-brand-600 transition-colors" />
                <input
                  type="text"
                  placeholder="Buscar por ciudad, barrio o nombre..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border-0 py-3.5 pl-10 pr-4 text-sm bg-white shadow-sm ring-1 ring-gray-200 focus:ring-2 focus:ring-brand-600 outline-none transition-all placeholder:text-gray-400"
                />
              </div>
              <div className="flex bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-1 shrink-0">
                {['all', 'sale', 'rent'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setTransactionType(type)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                      transactionType === type 
                        ? 'bg-brand-600 text-white shadow-md' 
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {type === 'all' ? 'Ver Todo' : type === 'sale' ? 'Venta' : 'Renta'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="hidden lg:block shrink-0">
             <div className="flex gap-4">
                <div className="text-center px-6 border-r border-gray-200">
                   <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                   <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Total</div>
                </div>
                <div className="text-center px-6 border-r border-gray-200">
                   <div className="text-2xl font-bold text-brand-600">{stats.sale}</div>
                   <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Venta</div>
                </div>
                <div className="text-center px-6">
                   <div className="text-2xl font-bold text-teal-600">{stats.rent}</div>
                   <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Renta</div>
                </div>
             </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-600 border-t-transparent mb-4" />
            <p className="text-sm font-medium text-gray-500">Cargando catálogo...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-10 text-center mx-auto max-w-lg">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-4">
               <span className="text-2xl">⚠️</span>
            </div>
            <h3 className="text-lg font-bold text-red-900 mb-2">Error al cargar</h3>
            <p className="text-sm text-red-700 mb-6">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-white rounded-xl text-sm font-semibold text-red-700 shadow-sm border border-red-200 hover:bg-red-50 transition-colors"
            >
              Reintentar
            </button>
          </div>
        ) : properties.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-300 p-20 text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-gray-100/50 mb-6 group hover:scale-110 transition-transform">
               <Building2 className="h-10 w-10 text-gray-300 group-hover:text-brand-300 transition-colors" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No se encontraron propiedades</h3>
            <p className="text-gray-500 max-w-sm mx-auto">Vuelve más tarde o utiliza otros filtros para encontrar el inmueble ideal.</p>
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            {properties.map((prop) => (
              <div 
                key={prop.id} 
                className="group flex flex-col overflow-hidden rounded-[2rem] bg-white shadow-[0_10px_40px_-15px_rgba(0,0,0,0.08)] ring-1 ring-gray-100 transition-all hover:-translate-y-2 hover:shadow-[0_25px_60px_-20px_rgba(0,0,0,0.12)] hover:ring-brand-100"
              >
                {/* Image Placeholder/Thumbnail */}
                <div className="relative h-64 overflow-hidden">
                  {prop.image_url ? (
                    <img src={prop.image_url} alt={prop.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-brand-50/50 group-hover:bg-brand-50 transition-colors">
                      <Building2 className="h-16 w-16 text-brand-100 group-hover:text-brand-200 transition-colors" />
                    </div>
                  )}
                  <div className="absolute top-4 left-4 flex gap-2">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${
                      prop.transaction_type === 'sale' ? 'bg-brand-600 text-white' : 'bg-teal-600 text-white'
                    }`}>
                      {prop.transaction_type === 'sale' ? 'Venta' : 'Renta'}
                    </span>
                    <span className="bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider text-gray-800 shadow-sm border border-white/50">
                      {prop.property_type || 'Inmueble'}
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 text-brand-600 mb-2">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="text-xs font-bold uppercase tracking-tight">{prop.city}{prop.neighborhood ? `, ${prop.neighborhood}` : ''}</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-brand-700 transition-colors line-clamp-2 leading-tight mb-3">
                      {prop.name}
                    </h3>
                    
                    {/* Features bar */}
                    <div className="grid grid-cols-3 gap-2 py-4 border-y border-gray-50 mb-4">
                       <div className="flex flex-col items-center gap-0.5">
                          <div className="flex items-center gap-1 text-gray-900">
                             <Bed className="h-4 w-4 text-brand-500" />
                             <span className="text-sm font-bold">{prop.bedrooms || 0}</span>
                          </div>
                          <span className="text-[10px] text-gray-400 font-medium uppercase">Hab.</span>
                       </div>
                       <div className="flex flex-col items-center gap-0.5 border-x border-gray-50">
                          <div className="flex items-center gap-1 text-gray-900">
                             <Bath className="h-4 w-4 text-brand-500" />
                             <span className="text-sm font-bold">{prop.bathrooms || 0}</span>
                          </div>
                          <span className="text-[10px] text-gray-400 font-medium uppercase">Baños</span>
                       </div>
                       <div className="flex flex-col items-center gap-0.5">
                          <div className="flex items-center gap-1 text-gray-900">
                             <Maximize className="h-4 w-4 text-brand-500" />
                             <span className="text-sm font-bold">{prop.area_m2 || 0}</span>
                          </div>
                          <span className="text-[10px] text-gray-400 font-medium uppercase">m²</span>
                       </div>
                    </div>

                    <div className="text-3xl font-black text-gray-900 tracking-tight">
                       ${Number(prop.price || 0).toLocaleString()}
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-2 pt-2">
                    <a
                      href={`https://wa.me/${meta.support_phone || '593997848591'}?text=${encodeURIComponent(`Hola! 👋 Estoy interesado en la propiedad: "${prop.name}" (Ref: ${prop.reference_code || prop.id}). ¿Podrían darme más información?`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-500 hover:scale-[1.02] active:scale-95"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Consultar por WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-gray-100 bg-white py-12">
         <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <p className="text-sm text-gray-500 font-medium">© {new Date().getFullYear()} Catálogo impulsado por Clienta BR</p>
            <p className="mt-1 text-xs text-gray-400">AWS Infrastructure · High Availability Cloud Catalog</p>
         </div>
      </footer>
    </div>
  );
}
