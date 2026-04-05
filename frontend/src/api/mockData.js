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

const today = new Date().toISOString().slice(0, 10);

const DAILY_SUMMARY = {
  date: today,
  total_revenue: 0,
  transaction_count: 0,
  properties_active: PROPERTIES_BR.filter(p => p.status === 'disponible').length,
};

const CONTACTS = [
  { contact_id: 'con-001', name: 'Alice Smith', email: 'alice@example.com', phone: '+15551234567', source_channel: 'whatsapp', lead_status: 'closed_won', tier: 'gold', tags: [], conversation_mode: 'bot', created_ts: new Date().toISOString() },
  { contact_id: 'con-002', name: 'Bob Jones', email: 'bob@example.com', phone: '+15559876543', source_channel: 'whatsapp', lead_status: 'interested', tier: 'silver', tags: [], conversation_mode: 'bot', created_ts: new Date().toISOString() },
  { contact_id: 'con-003', name: 'Carol Lee', email: 'carol@example.com', phone: '+15557778888', source_channel: 'whatsapp', lead_status: 'prospect', tier: 'bronze', tags: [], conversation_mode: 'human', created_ts: new Date().toISOString() },
];

const MESSAGES = [
  { message_id: 'msg-001', channel: 'whatsapp', from_number: '+15551234567', to_number: '+15550000000', text: 'I want to order', contact_id: 'con-001', category: 'closed', created_ts: new Date().toISOString() },
  { message_id: 'msg-002', channel: 'whatsapp', from_number: '+15550000000', to_number: '+15551234567', text: 'Your order has been confirmed!', contact_id: 'con-001', category: 'closed', created_ts: new Date().toISOString() },
  { message_id: 'msg-003', channel: 'whatsapp', from_number: '+15559876543', to_number: '+15550000000', text: 'I want info', contact_id: 'con-002', category: 'active', created_ts: new Date().toISOString() },
  { message_id: 'msg-004', channel: 'whatsapp', from_number: '+15557778888', to_number: '+15550000000', text: 'Order', contact_id: 'con-003', category: 'incomplete', created_ts: new Date().toISOString() },
];

const INSIGHTS = {
  insight: {
    summary: 'Your electronics category is driving 65% of revenue today. Wireless Earbuds Pro and Webcam HD 1080p are top sellers. Three products (USB-C Hub, Mechanical Keyboard, Laptop Stand) are critically low on stock and need immediate reordering to avoid stockouts this week.',
    generated_at: new Date().toISOString(),
    forecasts: [
      'Wireless Earbuds Pro demand expected to increase 20% next week based on seasonal trends',
      'Webcam sales trending upward — consider stocking 50+ units for the upcoming quarter',
      'Monitor Light Bar showing steady growth; current stock will last approximately 3 weeks',
    ],
    reorder_suggestions: [
      { product: 'USB-C Hub 7-in-1', quantity: 50, description: 'USB-C Hub 7-in-1: order 50 units — only 8 remaining (below threshold of 15)' },
      { product: 'Mechanical Keyboard', quantity: 30, description: 'Mechanical Keyboard: order 30 units — only 5 remaining (below threshold of 10)' },
      { product: 'Laptop Stand Aluminum', quantity: 25, description: 'Laptop Stand Aluminum: order 25 units — only 3 remaining (below threshold of 8)' },
    ],
    spending_trends: [
      'Average order value increased 12% compared to last week',
      'Card payments account for 67% of transactions, up from 58% last month',
      'Afternoon sales (1-5 PM) contribute 54% of daily revenue',
    ],
    revenue_insights: [
      { day: 'Mon', revenue: 480 },
      { day: 'Tue', revenue: 620 },
      { day: 'Wed', revenue: 390 },
      { day: 'Thu', revenue: 720 },
      { day: 'Fri', revenue: 850 },
      { day: 'Sat', revenue: 560 },
      { day: 'Sun', revenue: 310 },
    ],
  },
};

function delay(ms = 200) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockHandlers = {
  async 'GET /inventory'() {
    await delay();
    return { properties: PROPERTIES_BR };
  },

  async 'GET /inventory/:id'(id) {
    await delay();
    const p = PROPERTIES_BR.find((x) => x.id === id);
    if (!p) throw new Error('Property not found');
    return p;
  },

  async 'POST /inventory'(_, body) {
    await delay(300);
    const newProp = { id: `prop-${Date.now()}`, ...body, status: 'disponible' };
    PROPERTIES_BR.push(newProp);
    return newProp;
  },

  async 'GET /transactions'() {
    await delay();
    return { transactions: TRANSACTIONS };
  },

  async 'GET /transactions/summary'() {
    await delay();
    return DAILY_SUMMARY;
  },

  async 'POST /transactions'(_, body) {
    await delay(300);
    const newTxn = { id: `txn-${Date.now()}`, created_at: new Date().toISOString(), ...body };
    TRANSACTIONS.unshift(newTxn);
    return newTxn;
  },

  async 'GET /onboarding/config'() {
    await delay();
    return { plan: 'pro', business_name: 'Clienta Real Estate', business_type: 'real_estate' };
  },

  async 'GET /insights'() {
    await delay(400);
    return INSIGHTS;
  },

  async 'POST /insights/generate'() {
    await delay(1500);
    INSIGHTS.insight.generated_at = new Date().toISOString();
    return INSIGHTS;
  },

  async 'GET /contacts'() {
    await delay();
    return { contacts: CONTACTS };
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
  async 'GET /contacts/:id/messages'(id) {
    await delay();
    const list = MESSAGES.filter((m) => m.contact_id === id || m.from_number);
    return { messages: list };
  },

  async 'GET /messages'() {
    await delay();
    return { messages: MESSAGES };
  },
  async 'POST /messages'(_, body) {
    await delay(300);
    const newMsg = { message_id: `msg-${Date.now()}`, category: 'active', ...body, created_ts: new Date().toISOString() };
    MESSAGES.push(newMsg);
    return newMsg;
  },
  async 'PATCH /messages/:id/flags'(id, body) {
    await delay(200);
    const idx = MESSAGES.findIndex((m) => m.message_id === id);
    if (idx === -1) throw new Error('Message not found');
    Object.assign(MESSAGES[idx], body);
    return MESSAGES[idx];
  },
  async 'PATCH /transactions/:id'(id, body) {
    await delay(300);
    const idx = TRANSACTIONS.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error('Transaction not found');
    Object.assign(TRANSACTIONS[idx], body);
    return TRANSACTIONS[idx];
  },

  async 'GET /transactions/revenue'() {
    await delay(300);
    const days = 30;
    const revenue = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      revenue.push({
        date: d.toISOString().slice(0, 10),
        revenue: Math.round(Math.random() * 800 + 200),
        order_count: Math.round(Math.random() * 8 + 1),
        items_sold: Math.round(Math.random() * 15 + 2),
      });
    }
    return { revenue };
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

  async 'POST /contacts/bulk-tag'(_, body) {
    await delay(300);
    return { updated: (body?.contact_ids || []).length };
  },

  async 'GET /campaigns'() {
    await delay(200);
    return { campaigns: [] };
  },

  async 'POST /campaigns'(_, body) {
    await delay(300);
    return { campaign_id: `camp-${Date.now()}`, status: 'draft', ...body };
  },

  async 'GET /campaigns/:id'(id) {
    await delay(200);
    return { campaign_id: id, status: 'draft', name: 'Mock Campaign', message_template: '', segment_filters: {}, sent_count: 0, failed_count: 0 };
  },

  async 'PATCH /campaigns/:id'(id, body) {
    await delay(200);
    return { campaign_id: id, ...body };
  },

  async 'DELETE /campaigns/:id'() {
    await delay(200);
    return null;
  },

  async 'POST /campaigns/:id/send'(id) {
    await delay(500);
    return { campaign_id: id, status: 'sending' };
  },

  // ── Properties (BR) ──────────────────────────────────────────────

  async 'GET /properties'() {
    await delay();
    return { properties: PROPERTIES_BR };
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

  async 'GET /properties/stats'() {
    await delay();
    const stats = { total: PROPERTIES_BR.length, by_status: { disponible: 0, reservado: 0, vendido: 0, rentado: 0 }, by_type: { sale: 0, rent: 0 } };
    PROPERTIES_BR.forEach(p => {
      stats.by_status[p.status] = (stats.by_status[p.status] || 0) + 1;
      stats.by_type[p.transaction_type] = (stats.by_type[p.transaction_type] || 0) + 1;
    });
    return stats;
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

  async 'POST /properties/extract-flyer'() {
    await delay(2000);
    return { success: true, property_data: { name: 'Suite Premium La Carolina', transaction_type: 'sale', property_type: 'departamento', price: 145000, city: 'Quito', neighborhood: 'La Carolina', bedrooms: 2, bathrooms: 2, parking_spots: 1, area_m2: 92, description: 'Hermosa suite con vista panorámica al parque, acabados de lujo, piso de porcelanato.', amenities: ['piscina', 'gimnasio', 'guardianía', 'ascensor'], project_name: 'Torres del Parque', confidence: 0.87 } };
  },

  async 'POST /properties/sync-vectors'() {
    await delay(1500);
    return { synced_count: PROPERTIES_BR.filter(p => p.status === 'disponible').length };
  },

  async 'POST /properties/query'(_, body) {
    await delay(1000);
    return { answer: `Encontré ${PROPERTIES_BR.length} propiedades que podrían interesarle. La mejor opción en ${body?.city || 'su zona'} es "${PROPERTIES_BR[0]?.name}" con un precio de $${PROPERTIES_BR[0]?.price?.toLocaleString()}.`, sources: PROPERTIES_BR.slice(0, 3).map(p => ({ property_id: p.id, name: p.name, score: 0.85 })) };
  },

  async 'POST /properties/score-lead'() {
    await delay(800);
    return { intent: { intent: 'buy', urgency: 'high', budget_mentioned: 120000 }, score: { score: 78, tier: 'hot', summary: 'Lead caliente con intención de compra', action: 'Notificar agente' }, should_notify_agent: true };
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
