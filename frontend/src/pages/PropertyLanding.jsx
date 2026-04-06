import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchPublicProperties } from '../api/properties';
import {
  Building2,
  MapPin,
  Bed,
  Bath,
  Maximize,
  MessageCircle,
  ChevronLeft,
  Calendar,
  Car,
  Layers,
} from 'lucide-react';

export default function PropertyLanding() {
  const { tenantId, propertyId } = useParams();
  const [property, setProperty] = useState(null);
  const [meta, setMeta] = useState({ business_name: 'Catálogo Inmobiliario', support_phone: '' });
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_URL || '';
    fetch(`${baseUrl}/onboarding/meta?tenant_id=${tenantId}`)
      .then(res => res.json())
      .then(data => {
        if (data.business_name) {
          setMeta({
            business_name: data.business_name,
            support_phone: data.support_phone?.replace(/[^\d+]/g, '') || '',
          });
        }
      })
      .catch(() => {});

    fetchPublicProperties(tenantId, { limit: 200 })
      .then(data => {
        const found = (data.properties || []).find(p => p.id === propertyId);
        if (found) setProperty(found);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [tenantId, propertyId]);

  const isSale = property?.transaction_type === 'sale';
  const price = Number(property?.price || 0);
  const ref = property?.reference_code || property?.id;
  const txLabel = isSale ? 'Venta' : 'Renta';

  const waText = property
    ? `Hola! 👋 Estoy interesado en la propiedad: "${property.name}" (${txLabel}) — $${price.toLocaleString()}. Ref: ${ref}. ¿Me pueden dar más información?`
    : '';
  const waUrl = `https://wa.me/${meta.support_phone || '593997848591'}?text=${encodeURIComponent(waText)}`;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900 tracking-tight uppercase">{meta.business_name}</h1>
              <p className="text-[10px] font-medium text-gray-500 tracking-widest uppercase -mt-0.5">Ficha de Propiedad</p>
            </div>
          </div>
          <Link
            to={`/propiedades/${tenantId}`}
            className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Ver catálogo
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {loading && (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-600 border-t-transparent mb-4" />
            <p className="text-sm font-medium text-gray-500">Cargando propiedad...</p>
          </div>
        )}

        {notFound && !loading && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-10 text-center mx-auto max-w-lg mt-16">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-4">
              <span className="text-2xl">🏚️</span>
            </div>
            <h3 className="text-lg font-bold text-red-900 mb-2">Propiedad no encontrada</h3>
            <p className="text-sm text-red-700 mb-6">Esta propiedad puede haber sido retirada del catálogo.</p>
            <Link
              to={`/propiedades/${tenantId}`}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 transition-colors"
            >
              Ver otras propiedades
            </Link>
          </div>
        )}

        {property && !loading && (
          <div className="space-y-6">
            {/* Hero image */}
            <div className="relative overflow-hidden rounded-3xl bg-gray-100 h-72 sm:h-96">
              {property.image_url ? (
                <img src={property.image_url} alt={property.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Building2 className="h-20 w-20 text-gray-200" />
                </div>
              )}
              <div className="absolute top-4 left-4 flex gap-2">
                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${
                  isSale ? 'bg-brand-600 text-white' : 'bg-teal-600 text-white'
                }`}>
                  {txLabel}
                </span>
                <span className="bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider text-gray-800 shadow-sm border border-white/50">
                  {property.property_type || 'Inmueble'}
                </span>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Main info */}
              <div className="lg:col-span-2 space-y-6">
                <div>
                  {property.city && (
                    <div className="flex items-center gap-1.5 text-brand-600 mb-2">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="text-xs font-bold uppercase tracking-tight">
                        {property.city}{property.neighborhood ? `, ${property.neighborhood}` : ''}
                      </span>
                    </div>
                  )}
                  <h2 className="text-3xl font-black text-gray-900 leading-tight">{property.name}</h2>
                  {property.project_name && (
                    <p className="mt-1 text-sm text-gray-500">Proyecto: {property.project_name}</p>
                  )}
                  {ref && (
                    <p className="mt-1 text-xs text-gray-400 font-medium">Ref: {ref}</p>
                  )}
                </div>

                {/* Specs grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {property.bedrooms > 0 && (
                    <div className="flex flex-col items-center gap-1 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                      <Bed className="h-5 w-5 text-brand-500" />
                      <span className="text-xl font-bold text-gray-900">{property.bedrooms}</span>
                      <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Habitaciones</span>
                    </div>
                  )}
                  {property.bathrooms > 0 && (
                    <div className="flex flex-col items-center gap-1 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                      <Bath className="h-5 w-5 text-brand-500" />
                      <span className="text-xl font-bold text-gray-900">{property.bathrooms}</span>
                      <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Baños</span>
                    </div>
                  )}
                  {property.area_m2 > 0 && (
                    <div className="flex flex-col items-center gap-1 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                      <Maximize className="h-5 w-5 text-brand-500" />
                      <span className="text-xl font-bold text-gray-900">{Number(property.area_m2)}</span>
                      <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">m²</span>
                    </div>
                  )}
                  {property.parking_spots > 0 && (
                    <div className="flex flex-col items-center gap-1 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                      <Car className="h-5 w-5 text-brand-500" />
                      <span className="text-xl font-bold text-gray-900">{property.parking_spots}</span>
                      <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Parqueos</span>
                    </div>
                  )}
                </div>

                {/* Description */}
                {property.description && (
                  <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">Descripción</h3>
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{property.description}</p>
                  </div>
                )}

                {/* Amenities */}
                {property.amenities?.length > 0 && (
                  <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">Amenidades</h3>
                    <div className="flex flex-wrap gap-2">
                      {property.amenities.map((a, i) => (
                        <span key={i} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 capitalize">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extra details */}
                {(property.floor_number || property.year_built) && (
                  <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">Detalles</h3>
                    <div className="space-y-2 text-sm text-gray-600">
                      {property.floor_number && (
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-gray-400" />
                          Piso {property.floor_number}
                        </div>
                      )}
                      {property.year_built && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          Año de construcción: {property.year_built}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Sticky CTA panel */}
              <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Precio</p>
                  <p className="text-4xl font-black text-gray-900 tracking-tight">
                    ${price.toLocaleString()}
                    {!isSale && <span className="text-base font-normal text-gray-400">/mes</span>}
                  </p>

                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-500 hover:scale-[1.02] active:scale-95"
                  >
                    <MessageCircle className="h-5 w-5" />
                    Consultar por WhatsApp
                  </a>

                  <p className="mt-3 text-center text-xs text-gray-400">
                    Te respondemos a la brevedad
                  </p>
                </div>

                {property.address && (
                  <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Dirección</h3>
                    <p className="text-sm text-gray-700">{property.address}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-20 border-t border-gray-100 bg-white py-12">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="text-sm text-gray-500 font-medium">© {new Date().getFullYear()} Catálogo impulsado por Clienta BR</p>
        </div>
      </footer>
    </div>
  );
}
