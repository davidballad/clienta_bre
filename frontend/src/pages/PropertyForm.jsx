import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Building2,
  Save,
  ArrowLeft,
  MapPin,
  DollarSign,
  Home,
  Upload,
  FileText,
  Image,
  X,
  Plus,
  Loader2,
  Sparkles,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { useCreateProperty, useUpdateProperty, useProperty, useExtractFlyer } from '../hooks/useProperties';
import { getDocumentUploadUrl } from '../api/properties';

const PROPERTY_TYPES = [
  { value: 'departamento', label: 'Departamento / Suite' },
  { value: 'casa', label: 'Casa' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'oficina', label: 'Oficina' },
  { value: 'local', label: 'Local Comercial' },
  { value: 'suite', label: 'Suite' },
];

const AMENITIES_OPTIONS = [
  'piscina', 'gimnasio', 'guardianía', 'jardín', 'bbq', 'rooftop',
  'bodega', 'lavandería', 'parqueadero cubierto', 'área social',
  'ascensor', 'lobby', 'cámaras de seguridad', 'generador eléctrico',
];

const INITIAL_FORM = {
  name: '',
  transaction_type: 'sale',
  property_type: 'departamento',
  price: '',
  city: '',
  neighborhood: '',
  address: '',
  bedrooms: '',
  bathrooms: '',
  parking_spots: '',
  area_m2: '',
  year_built: '',
  floor_number: '',
  description: '',
  project_name: '',
  reference_code: '',
  amenities: [],
};

export default function PropertyForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const fileInputRef = useRef(null);
  const docInputRef = useRef(null);
  const flyerInputRef = useRef(null);

  const [form, setForm] = useState(INITIAL_FORM);
  const [documents, setDocuments] = useState([]);
  const [toast, setToast] = useState(null);

  const createMutation = useCreateProperty();
  const updateMutation = useUpdateProperty();
  const flyerMutation = useExtractFlyer();
  const { data: existingProperty } = useProperty(id);

  // Populate form when editing
  useEffect(() => {
    if (existingProperty && isEditing) {
      setForm({
        name: existingProperty.name || '',
        transaction_type: existingProperty.transaction_type || 'sale',
        property_type: existingProperty.property_type || 'departamento',
        price: existingProperty.price?.toString() || '',
        city: existingProperty.city || '',
        neighborhood: existingProperty.neighborhood || '',
        address: existingProperty.address || '',
        bedrooms: existingProperty.bedrooms?.toString() || '',
        bathrooms: existingProperty.bathrooms?.toString() || '',
        parking_spots: existingProperty.parking_spots?.toString() || '',
        area_m2: existingProperty.area_m2?.toString() || '',
        year_built: existingProperty.year_built?.toString() || '',
        floor_number: existingProperty.floor_number?.toString() || '',
        description: existingProperty.description || '',
        project_name: existingProperty.project_name || '',
        reference_code: existingProperty.reference_code || '',
        amenities: existingProperty.amenities || [],
      });
    }
  }, [existingProperty, isEditing]);

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const toggleAmenity = (amenity) => {
    setForm(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  };

  const handleDocAdd = (e) => {
    const files = Array.from(e.target.files || []);
    setDocuments(prev => [
      ...prev,
      ...files.map(f => ({
        file: f,
        name: f.name,
        type: f.name.split('.').pop()?.toUpperCase() || 'PDF',
        uploading: false,
        uploaded: false,
      })),
    ]);
  };

  const removeDoc = (index) => setDocuments(prev => prev.filter((_, i) => i !== index));

  // ── Flyer Extraction ────────────────────────────────────────────
  const handleFlyerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const result = await flyerMutation.mutateAsync({
          imageBase64: reader.result,
          mimeType: file.type,
        });

        if (result?.property_data) {
          const d = result.property_data;
          setForm(prev => ({
            ...prev,
            name: d.name || prev.name,
            transaction_type: d.transaction_type || prev.transaction_type,
            property_type: d.property_type || prev.property_type,
            price: d.price?.toString() || prev.price,
            city: d.city || prev.city,
            neighborhood: d.neighborhood || prev.neighborhood,
            address: d.address || prev.address,
            bedrooms: d.bedrooms?.toString() || prev.bedrooms,
            bathrooms: d.bathrooms?.toString() || prev.bathrooms,
            parking_spots: d.parking_spots?.toString() || prev.parking_spots,
            area_m2: d.area_m2?.toString() || prev.area_m2,
            year_built: d.year_built?.toString() || prev.year_built,
            floor_number: d.floor_number?.toString() || prev.floor_number,
            description: d.description || prev.description,
            project_name: d.project_name || prev.project_name,
            reference_code: d.reference_code || prev.reference_code,
            amenities: d.amenities?.length ? d.amenities : prev.amenities,
          }));

          setToast({
            type: 'success',
            message: `Datos extraídos del flyer (confianza: ${Math.round((d._confidence || result.property_data.confidence || 0) * 100)}%). Revisa y ajusta antes de guardar.`,
          });
          setTimeout(() => setToast(null), 8000);
        }
      } catch (err) {
        setToast({ type: 'error', message: `Error extrayendo datos: ${err.message}` });
        setTimeout(() => setToast(null), 5000);
      }
    };
    reader.readAsDataURL(file);
  };

  // ── Submit ──────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const payload = {
      ...form,
      price: form.price ? Number(form.price) : undefined,
      bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined,
      bathrooms: form.bathrooms ? Number(form.bathrooms) : undefined,
      parking_spots: form.parking_spots ? Number(form.parking_spots) : undefined,
      area_m2: form.area_m2 ? Number(form.area_m2) : undefined,
      year_built: form.year_built ? Number(form.year_built) : undefined,
      floor_number: form.floor_number ? Number(form.floor_number) : undefined,
    };

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      navigate('/br/properties');
    } catch (err) {
      setToast({ type: 'error', message: err.message });
      setTimeout(() => setToast(null), 5000);
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Editar Inmueble' : 'Agregar Inmueble'}
          </h1>
          <p className="text-sm text-gray-500">
            {isEditing ? 'Modifica los datos de la propiedad' : 'Ingresa los datos manualmente o extrae desde un flyer'}
          </p>
        </div>
      </div>

      {/* Flyer Extraction Banner */}
      {!isEditing && (
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
              <Sparkles className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Extracción con IA</h3>
              <p className="mt-0.5 text-sm text-gray-600">
                Sube un flyer de Canva, screenshot o imagen del anuncio y la IA extraerá los datos automáticamente.
              </p>
              <input
                ref={flyerInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFlyerUpload}
              />
              <button
                onClick={() => flyerInputRef.current?.click()}
                disabled={flyerMutation.isPending}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
              >
                {flyerMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Extrayendo...
                  </>
                ) : (
                  <>
                    <Image className="h-4 w-4" />
                    Subir Flyer / Imagen
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className={`flex items-start gap-2 rounded-xl border p-4 text-sm ${
          toast.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-auto shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-5">
            <Building2 className="h-5 w-5 text-emerald-600" />
            Información General
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Inmueble *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => updateField('name', e.target.value)}
                placeholder="Ej: Suite 2BR en La Carolina"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Transacción</label>
              <div className="flex gap-2">
                {['sale', 'rent'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => updateField('transaction_type', t)}
                    className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                      form.transaction_type === t
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {t === 'sale' ? '🏠 Venta' : '🔑 Renta'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Propiedad</label>
              <select
                value={form.property_type}
                onChange={e => updateField('property_type', e.target.value)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                {PROPERTY_TYPES.map(pt => (
                  <option key={pt.value} value={pt.value}>{pt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Precio (USD) {form.transaction_type === 'rent' && '/ mes'}
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={e => updateField('price', e.target.value)}
                  placeholder="120000"
                  className="block w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código Referencia</label>
              <input
                type="text"
                value={form.reference_code}
                onChange={e => updateField('reference_code', e.target.value)}
                placeholder="SOL-101"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto</label>
              <input
                type="text"
                value={form.project_name}
                onChange={e => updateField('project_name', e.target.value)}
                placeholder="Ej: Proyecto Sol de Quito"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-5">
            <MapPin className="h-5 w-5 text-emerald-600" />
            Ubicación
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
              <input type="text" value={form.city} onChange={e => updateField('city', e.target.value)} placeholder="Quito" className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sector / Barrio</label>
              <input type="text" value={form.neighborhood} onChange={e => updateField('neighborhood', e.target.value)} placeholder="La Carolina" className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
              <input type="text" value={form.address} onChange={e => updateField('address', e.target.value)} placeholder="Av. Amazonas y Naciones Unidas" className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-5">
            <Home className="h-5 w-5 text-emerald-600" />
            Características
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { field: 'bedrooms', label: 'Habitaciones', placeholder: '2' },
              { field: 'bathrooms', label: 'Baños', placeholder: '2' },
              { field: 'parking_spots', label: 'Parqueaderos', placeholder: '1' },
              { field: 'area_m2', label: 'Área (m²)', placeholder: '85' },
              { field: 'year_built', label: 'Año Construcción', placeholder: '2024' },
              { field: 'floor_number', label: 'Piso', placeholder: '5' },
            ].map(({ field, label, placeholder }) => (
              <div key={field}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                <input
                  type="number"
                  value={form[field]}
                  onChange={e => updateField(field, e.target.value)}
                  placeholder={placeholder}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            ))}
          </div>
          {/* Amenities */}
          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">Amenidades</label>
            <div className="flex flex-wrap gap-2">
              {AMENITIES_OPTIONS.map(amenity => (
                <button
                  key={amenity}
                  type="button"
                  onClick={() => toggleAmenity(amenity)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    form.amenities.includes(amenity)
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {amenity}
                </button>
              ))}
            </div>
          </div>
          {/* Description */}
          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={e => updateField('description', e.target.value)}
              placeholder="Describe las características principales del inmueble..."
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Documents */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            Documentos
          </h2>
          <p className="text-xs text-gray-500 mb-4">Escrituras, planos, certificados de predio, etc. Estos documentos alimentan al bot para responder preguntas técnicas.</p>
          <input
            ref={docInputRef}
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleDocAdd}
          />
          <div className="space-y-2">
            {documents.map((doc, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5">
                <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="flex-1 truncate text-sm text-gray-700">{doc.name}</span>
                <span className="text-xs text-gray-400">{doc.type}</span>
                {doc.uploaded && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                <button type="button" onClick={() => removeDoc(i)} className="text-gray-400 hover:text-red-500">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => docInputRef.current?.click()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-4 text-sm font-medium text-gray-500 transition-colors hover:border-emerald-400 hover:text-emerald-600"
          >
            <Upload className="h-4 w-4" />
            Subir Documentos
          </button>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Guardando...' : isEditing ? 'Actualizar Inmueble' : 'Guardar Inmueble'}
          </button>
        </div>
      </form>
    </div>
  );
}
