const PROPERTIES_BR = [
  { id: 'prop-001', name: 'Suite 2BR La Carolina', transaction_type: 'sale', property_type: 'departamento', price: 120000, city: 'Quito', neighborhood: 'La Carolina', bedrooms: 2, bathrooms: 2, parking_spots: 1, area_m2: 85, status: 'disponible', amenities: ['piscina', 'gimnasio', 'guardianía'], project_name: 'Proyecto Sol', reference_code: 'SOL-101', description: 'Suite de lujo con vista panorámica al parque' },
  { id: 'prop-002', name: 'Casa Familiar Cumbayá', transaction_type: 'sale', property_type: 'casa', price: 250000, city: 'Quito', neighborhood: 'Cumbayá', bedrooms: 4, bathrooms: 3, parking_spots: 2, area_m2: 220, status: 'disponible', amenities: ['jardín', 'bbq', 'bodega'], description: 'Casa amplia en urbanización cerrada' },
  { id: 'prop-003', name: 'Oficina Centro Norte', transaction_type: 'rent', property_type: 'oficina', price: 800, city: 'Quito', neighborhood: 'Centro Norte', bedrooms: 0, bathrooms: 1, parking_spots: 1, area_m2: 65, status: 'disponible', description: 'Oficina amoblada con divisiones modulares' },
  { id: 'prop-004', name: 'Depto 3BR Samborondón', transaction_type: 'rent', property_type: 'departamento', price: 1200, city: 'Guayaquil', neighborhood: 'Samborondón', bedrooms: 3, bathrooms: 2, parking_spots: 2, area_m2: 140, status: 'reservado', amenities: ['piscina', 'gimnasio', 'área social'], description: 'Departamento moderno en zona exclusiva' },
  { id: 'prop-005', name: 'Terreno Valle Tumbaco', transaction_type: 'sale', property_type: 'terreno', price: 95000, city: 'Quito', neighborhood: 'Tumbaco', bedrooms: 0, bathrooms: 0, parking_spots: 0, area_m2: 500, status: 'disponible', description: 'Terreno plano con servicios básicos' },
  { id: 'prop-006', name: 'Penthouse González Suárez', transaction_type: 'sale', property_type: 'departamento', price: 380000, city: 'Quito', neighborhood: 'González Suárez', bedrooms: 3, bathrooms: 3, parking_spots: 2, area_m2: 180, status: 'vendido', amenities: ['rooftop', 'ascensor', 'lobby', 'cámaras de seguridad'], description: 'Penthouse con vista al valle' },
  { id: 'prop-007', name: 'Local Comercial Centro', transaction_type: 'rent', property_type: 'local', price: 1500, city: 'Guayaquil', neighborhood: 'Centro', bedrooms: 0, bathrooms: 1, parking_spots: 0, area_m2: 90, status: 'disponible', description: 'Excelente ubicación para retail' },
  { id: 'prop-008', name: 'Suite Moderna Iñaquito', transaction_type: 'sale', property_type: 'suite', price: 89000, city: 'Quito', neighborhood: 'Iñaquito', bedrooms: 1, bathrooms: 1, parking_spots: 1, area_m2: 55, status: 'disponible', amenities: ['gimnasio', 'lavandería'], description: 'Suite para inversión, alto retorno' },
];

const CONTACTS = [
  { contact_id: 'con-001', name: 'Alice Smith', email: 'alice@example.com', phone: '+15551234567', source_channel: 'whatsapp', lead_status: 'closed_won', tier: 'hot', tags: ['comprador'], conversation_mode: 'bot', created_ts: new Date().toISOString() },
  { contact_id: 'con-002', name: 'Bob Jones', email: 'bob@example.com', phone: '+15559876543', source_channel: 'whatsapp', lead_status: 'interested', tier: 'warm', tags: ['arriendo'], conversation_mode: 'bot', created_ts: new Date().toISOString() },
  { contact_id: 'con-003', name: 'Carol Lee', email: 'carol@example.com', phone: '+15557778888', source_channel: 'whatsapp', lead_status: 'prospect', tier: 'cold', tags: ['inversionista'], conversation_mode: 'human', created_ts: new Date().toISOString() },
];

const MESSAGES = [
  { message_id: 'msg-001', tenant_id: 'demo-tenant', channel: 'whatsapp', direction: 'inbound', from_number: '+15551234567', to_number: '+15550000000', text: 'Hola, me gustaría agendar una visita para la Suite en La Carolina', contact_id: 'con-001', category: 'cerrado', created_ts: new Date(Date.now() - 3600000).toISOString() },
  { message_id: 'msg-002', tenant_id: 'demo-tenant', channel: 'whatsapp', direction: 'outbound', from_number: '+15550000000', to_number: '+15551234567', text: '¡Claro! Tenemos disponibilidad este jueves a las 10am. ¿Te queda bien?', contact_id: 'con-001', category: 'cerrado', created_ts: new Date(Date.now() - 3500000).toISOString() },
  { message_id: 'msg-003', tenant_id: 'demo-tenant', channel: 'whatsapp', direction: 'inbound', from_number: '+15559876543', to_number: '+15550000000', text: '¿Cuentan con departamentos de 3 habitaciones en Cumbayá?', contact_id: 'con-002', category: 'activo', created_ts: new Date(Date.now() - 1800000).toISOString() },
  { message_id: 'msg-004', tenant_id: 'demo-tenant', channel: 'whatsapp', direction: 'inbound', from_number: '+15557778888', to_number: '+15550000000', text: 'Me interesa invertir en locales comerciales, ¿tienen opciones?', contact_id: 'con-003', category: 'activo', created_ts: new Date(Date.now() - 900000).toISOString() },
];

const NOTES = {};

const APPOINTMENTS = [
  { appointment_id: 'apt-001', tenant_id: 'demo-tenant', contact_phone: '+15551234567', contact_name: 'Alice Smith', contact_email: 'alice@example.com', scheduled_at: new Date(Date.now() + 86400000).toISOString(), duration_minutes: 60, property_id: 'prop-001', property_name: 'Suite 2BR La Carolina', status: 'confirmed', created_at: new Date().toISOString() },
];

function delay(ms = 200) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockHandlers = {
  // ── Onboarding ────────────────────────────────────────────────────

  async 'GET /users'() {
    await delay();
    return { users: [{ id: 'owner-001', email: 'owner@demo.com', display_name: 'Owner', role: 'owner', status: 'active' }] };
  },
  async 'POST /users'(_, body) {
    await delay(400);
    return { id: `user-${Date.now()}`, email: body.email, display_name: body.display_name || body.email, role: 'staff', status: 'active' };
  },
  async 'PUT /users/:id'(id, body) {
    await delay(200);
    return { id, ...body };
  },
  async 'DELETE /users/:id'(id) {
    await delay(200);
    return {};
  },

  async 'GET /onboarding/config'() {
    await delay();
    return { plan: 'pro', business_name: 'Clienta Real Estate', business_type: 'real_estate', tenant_id: 'demo-tenant' };
  },

  async 'POST /onboarding/setup'(_, body) {
    await delay(300);
    return { message: 'Setup complete. Your workspace is ready.' };
  },

  async 'PATCH /onboarding/config'(_, body) {
    await delay(300);
    return { message: 'Config updated' };
  },

  async 'POST /onboarding/provision'(_, body) {
    await delay(500);
    return { tenant_id: 'demo-tenant', message: 'Tenant provisioned. Refresh your session to continue.' };
  },

  async 'POST /onboarding/logo-upload'(_, body) {
    await delay(200);
    return { upload_url: null, logo_url: 'https://mock-bucket.s3.amazonaws.com/logos/demo-tenant/logo.png' };
  },

  // ── Contacts ─────────────────────────────────────────────────────

  async 'GET /contacts'() {
    await delay();
    return { contacts: CONTACTS };
  },
  async 'GET /contacts/stats'() {
    await delay(200);
    return {
      total: CONTACTS.length,
      by_tier: { bronze: 1, silver: 1, gold: 1 },
      by_status: { prospect: 1, interested: 1, closed_won: 1, abandoned: 0 },
      avg_ltv: 245.50,
    };
  },
  async 'GET /contacts/export'() {
    await delay(400);
    const header = 'name,email,phone,lead_status,tier\n';
    const rows = CONTACTS.map(c => `${c.name},${c.email || ''},${c.phone || ''},${c.lead_status || ''},${c.tier || ''}`).join('\n');
    return header + rows;
  },
  async 'GET /contacts/:id'(id) {
    await delay();
    const c = CONTACTS.find((x) => x.contact_id === id);
    if (!c) throw new Error('Contact not found');
    return c;
  },
  async 'POST /contacts'(_, body) {
    await delay(300);
    const newContact = { contact_id: `con-${Date.now()}`, ...body, created_ts: new Date().toISOString() };
    CONTACTS.push(newContact);
    return newContact;
  },
  async 'PUT /contacts/:id'(id, body) {
    await delay(300);
    const idx = CONTACTS.findIndex((c) => c.contact_id === id);
    if (idx === -1) throw new Error('Contact not found');
    Object.assign(CONTACTS[idx], body);
    return CONTACTS[idx];
  },
  async 'PATCH /contacts/:id'(id, body) {
    await delay(300);
    const idx = CONTACTS.findIndex((c) => c.contact_id === id);
    if (idx === -1) throw new Error('Contact not found');
    Object.assign(CONTACTS[idx], body);
    return CONTACTS[idx];
  },
  async 'DELETE /contacts/:id'(id) {
    await delay(200);
    const idx = CONTACTS.findIndex((c) => c.contact_id === id);
    if (idx !== -1) CONTACTS.splice(idx, 1);
    return null;
  },
  async 'POST /contacts/bulk-tag'(_, body) {
    await delay(300);
    return { updated: (body?.contact_ids || []).length };
  },
  async 'GET /contacts/:id/notes'(id) {
    await delay();
    return { notes: NOTES[id] || [] };
  },
  async 'POST /contacts/:id/notes'(id, body) {
    await delay(300);
    const note = { note_id: `note-${Date.now()}`, contact_id: id, content: body?.content || '', created_at: new Date().toISOString() };
    if (!NOTES[id]) NOTES[id] = [];
    NOTES[id].unshift(note);
    return note;
  },
  async 'DELETE /contacts/:id/notes/:noteId'(id, noteId) {
    await delay(200);
    if (NOTES[id]) NOTES[id] = NOTES[id].filter(n => n.note_id !== noteId);
    return null;
  },
  async 'GET /contacts/:id/messages'(id) {
    await delay();
    return { messages: MESSAGES.filter((m) => m.contact_id === id) };
  },

  // ── Messages / Conversations ──────────────────────────────────────

  async 'GET /messages'() {
    await delay();
    return { messages: MESSAGES };
  },
  async 'POST /messages'(_, body) {
    await delay(300);
    const newMsg = { message_id: `msg-${Date.now()}`, tenant_id: 'demo-tenant', category: 'activo', ...body, created_ts: new Date().toISOString() };
    MESSAGES.push(newMsg);
    return newMsg;
  },
  async 'POST /messages/send'(_, body) {
    await delay(500);
    const msg = { message_id: `msg-${Date.now()}`, tenant_id: 'demo-tenant', channel: 'whatsapp', direction: 'outbound', from_number: '+15550000000', to_number: body?.to_number, text: body?.text, category: 'activo', created_ts: new Date().toISOString() };
    MESSAGES.push(msg);
    return msg;
  },
  async 'PATCH /messages/:id/flags'(id, body) {
    await delay(200);
    const idx = MESSAGES.findIndex((m) => m.message_id === id);
    if (idx === -1) throw new Error('Message not found');
    Object.assign(MESSAGES[idx], body);
    return MESSAGES[idx];
  },
  async 'POST /messages/mark-conversation'(_, body) {
    await delay(200);
    return { updated: true, category: body?.category };
  },
  async 'POST /messages/mark-conversation-closed'(_, body) {
    await delay(200);
    const msg = MESSAGES.filter(m => m.from_number === body?.from_number).at(-1);
    if (msg) msg.category = 'cerrado';
    return { closed: true, message_id: msg?.message_id };
  },
  async 'GET /conversations'() {
    await delay();
    const phones = [...new Set(MESSAGES.map(m => m.direction === 'inbound' ? m.from_number : m.to_number).filter(Boolean))];
    const convos = phones.map(phone => {
      const msgs = MESSAGES.filter(m => m.from_number === phone || m.to_number === phone);
      const last = msgs.at(-1);
      return { tenant_id: 'demo-tenant', customer_phone: phone, channel: 'whatsapp', category: last?.category || 'activo', last_message_ts: last?.created_ts, last_text: last?.text, last_direction: last?.direction };
    });
    return { conversations: convos };
  },
  async 'GET /conversations/:phone/messages'(phone) {
    await delay();
    const decoded = decodeURIComponent(phone);
    return { messages: MESSAGES.filter(m => m.from_number === decoded || m.to_number === decoded) };
  },

  // ── Appointments ─────────────────────────────────────────────────

  async 'GET /appointments'() {
    await delay();
    return { appointments: APPOINTMENTS };
  },
  async 'GET /appointments/:id'(id) {
    await delay();
    const a = APPOINTMENTS.find(x => x.appointment_id === id);
    if (!a) throw new Error('Appointment not found');
    return a;
  },
  async 'PATCH /appointments/:id'(id, body) {
    await delay(300);
    const idx = APPOINTMENTS.findIndex(a => a.appointment_id === id);
    if (idx === -1) throw new Error('Appointment not found');
    Object.assign(APPOINTMENTS[idx], body, { updated_at: new Date().toISOString() });
    return APPOINTMENTS[idx];
  },
  async 'DELETE /appointments/:id'(id) {
    await delay(200);
    const idx = APPOINTMENTS.findIndex(a => a.appointment_id === id);
    if (idx !== -1) APPOINTMENTS.splice(idx, 1);
    return null;
  },
  async 'POST /appointments'(_, body) {
    await delay(300);
    const newApt = { appointment_id: `apt-${Date.now()}`, tenant_id: 'demo-tenant', status: 'confirmed', created_at: new Date().toISOString(), ...body };
    APPOINTMENTS.push(newApt);
    return newApt;
  },

  async 'GET /appointments/blocked-dates'() {
    await delay(200);
    return { blocked_dates: [] };
  },
  async 'POST /appointments/blocked-dates'(_, body) {
    await delay(200);
    return { date: body.date };
  },
  async 'DELETE /appointments/blocked-dates/:date'() {
    await delay(200);
    return {};
  },

  // ── Properties ───────────────────────────────────────────────────

  async 'GET /properties'() {
    await delay();
    return { properties: PROPERTIES_BR };
  },
  async 'GET /properties/stats'() {
    await delay();
    const stats = { total: PROPERTIES_BR.length, by_status: { disponible: 0, reservado: 0, vendido: 0, rentado: 0 }, by_type: { sale: 0, rent: 0 } };
    PROPERTIES_BR.forEach(p => {
      stats.by_status[p.status] = (stats.by_status[p.status] || 0) + 1;
      stats.by_type[p.transaction_type] = (stats.by_type[p.transaction_type] || 0) + 1;
    });
    return stats;
  },
  async 'GET /properties/:id'(id) {
    await delay();
    const p = PROPERTIES_BR.find(x => x.id === id);
    if (!p) throw new Error('Property not found');
    return p;
  },
  async 'POST /properties'(_, body) {
    await delay(300);
    const newProp = { id: `prop-${Date.now()}`, status: 'disponible', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...body };
    PROPERTIES_BR.push(newProp);
    return newProp;
  },
  async 'PUT /properties/:id'(id, body) {
    await delay(300);
    const idx = PROPERTIES_BR.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Property not found');
    Object.assign(PROPERTIES_BR[idx], body, { updated_at: new Date().toISOString() });
    return PROPERTIES_BR[idx];
  },
  async 'DELETE /properties/:id'(id) {
    await delay(200);
    const idx = PROPERTIES_BR.findIndex(p => p.id === id);
    if (idx !== -1) PROPERTIES_BR.splice(idx, 1);
    return null;
  },
  async 'POST /properties/import'(csvText) {
    await delay(500);
    if (!csvText || typeof csvText !== 'string') return { imported_count: 0, error_count: 0, imported: [], errors: [] };
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) return { imported_count: 0, error_count: 1, imported: [], errors: [{ row: 1, error: 'No data rows' }] };
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    const nameIdx = headers.indexOf('name');
    if (nameIdx === -1) return { imported_count: 0, error_count: 1, imported: [], errors: [{ error: 'CSV must have name column' }] };
    const imported = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const name = vals[nameIdx];
      if (!name) continue;
      const id = `prop-${Date.now()}-${i}`;
      const newProp = { id, name, transaction_type: vals[headers.indexOf('transaction_type')] || 'sale', property_type: vals[headers.indexOf('property_type')] || 'departamento', price: parseFloat(vals[headers.indexOf('price')]) || 0, city: vals[headers.indexOf('city')] || '', neighborhood: vals[headers.indexOf('neighborhood')] || '', status: 'disponible', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      PROPERTIES_BR.push(newProp);
      imported.push({ id, name, city: newProp.city });
    }
    return { imported_count: imported.length, error_count: 0, imported };
  },
  async 'POST /properties/upload-doc'(_, body) {
    await delay(300);
    const s3_key = `docs/mock/${body?.property_id}/${Date.now()}_${body?.filename || 'document.pdf'}`;
    return { upload_url: null, document_url: `https://mock-bucket.s3.amazonaws.com/${s3_key}`, s3_key };
  },
  async 'POST /properties/upload-image'(_, body) {
    await delay(300);
    const s3_key = `images/mock/${body?.property_id}/${Date.now()}_${body?.filename || 'image.jpg'}`;
    return { upload_url: null, image_url: `https://mock-bucket.s3.amazonaws.com/${s3_key}`, s3_key };
  },
  async 'DELETE /properties/:id/images'(id) {
    await delay(200);
    return { deleted: true };
  },
  async 'POST /properties/process-doc'(_, body) {
    await delay(800);
    return { success: true, vector_key: `mock#doc#${body?.s3_key}` };
  },
  async 'POST /properties/extract-flyer'() {
    await delay(2000);
    return { success: true, property_data: { name: 'Suite Premium La Carolina', transaction_type: 'sale', property_type: 'departamento', price: 145000, city: 'Quito', neighborhood: 'La Carolina', bedrooms: 2, bathrooms: 2, parking_spots: 1, area_m2: 92, description: 'Hermosa suite con vista panorámica al parque, acabados de lujo, piso de porcelanato.', amenities: ['piscina', 'gimnasio', 'guardianía', 'ascensor'], project_name: 'Torres del Parque', confidence: 0.87 } };
  },
  async 'POST /properties/query'(_, body) {
    await delay(1000);
    return { answer: `Encontré ${PROPERTIES_BR.length} propiedades que podrían interesarle. La mejor opción en ${body?.city || 'su zona'} es "${PROPERTIES_BR[0]?.name}" con un precio de $${PROPERTIES_BR[0]?.price?.toLocaleString()}.`, sources: PROPERTIES_BR.slice(0, 3).map(p => ({ property_id: p.id, name: p.name, score: 0.85 })) };
  },
  async 'POST /properties/score-lead'() {
    await delay(800);
    return { intent: { intent: 'buy', urgency: 'high', budget_mentioned: 120000 }, score: { score: 78, tier: 'hot', summary: 'Lead caliente con intención de compra', action: 'Notificar agente' }, should_notify_agent: true };
  },
  async 'POST /properties/sync-vectors'() {
    await delay(1500);
    return { synced_count: PROPERTIES_BR.filter(p => p.status === 'disponible').length };
  },
};

export function matchMockRoute(method, path) {
  const cleanPath = path.split('?')[0];

  const exact = `${method} ${cleanPath}`;
  if (mockHandlers[exact]) return { handler: mockHandlers[exact], params: [] };

  for (const pattern of Object.keys(mockHandlers)) {
    const [pMethod, pPath] = pattern.split(' ');
    if (pMethod !== method) continue;

    const patternParts = pPath.split('/');
    const pathParts = cleanPath.split('/');
    if (patternParts.length !== pathParts.length) continue;

    const params = [];
    let match = true;
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params.push(pathParts[i]);
      } else if (patternParts[i] !== pathParts[i]) {
        match = false;
        break;
      }
    }
    if (match) return { handler: mockHandlers[pattern], params };
  }

  return null;
}
