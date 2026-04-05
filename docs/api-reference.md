# Clienta AI — API Reference

Base URL: `https://<api-id>.execute-api.<region>.amazonaws.com`

## Authentication

### JWT (Frontend / Dashboard)

Most endpoints accept a JWT `Authorization: Bearer <token>` header. The JWT is obtained from Cognito after sign-in and contains `custom:tenant_id` and `custom:role` claims.

### Service Key (n8n / External Services)

Endpoints also accept service key auth for machine-to-machine calls (e.g. from n8n). Send two headers:

```
X-Service-Key: <shared-secret>
X-Tenant-Id: <tenant-id>
```

The service key is set via the `SERVICE_API_KEY` Lambda environment variable. The Lambda validates the key and extracts the tenant from `X-Tenant-Id`.

---

## Onboarding

### Create Tenant

**No authentication required.**

```
POST /onboarding/tenant
```

Creates a new tenant with a Cognito user account.

**Request Body:**

| Field            | Type   | Required | Description                                      |
| ---------------- | ------ | -------- | ------------------------------------------------ |
| `business_name`  | string | yes      | Name of the real estate agency                   |
| `business_type`  | string | yes      | Set to `real_estate`                             |
| `owner_email`    | string | yes      | Email for the owner account                      |
| `owner_password` | string | yes      | Password (min 8 chars, uppercase + lowercase + number) |

**Response:** `201 Created`

```json
{
  "tenant_id": "01HXYZ...",
  "message": "Tenant created successfully. Please log in to complete setup."
}
```

**Errors:** `400` validation error, `409` email already exists

**Example:**

```bash
curl -X POST "$API_URL/onboarding/tenant" \
  -H "Content-Type: application/json" \
  -d '{"business_name":"Inmobiliaria Real","business_type":"real_estate","owner_email":"admin@real.com","owner_password":"Secret123"}'
```

---

### Complete Setup

```
POST /onboarding/setup
```

Finalizes tenant setup after first login. Updates settings and seeds sample properties.

**Request Body (all optional):**

| Field                   | Type     | Description                                          |
| ----------------------- | -------- | ---------------------------------------------------- |
| `currency`              | string   | e.g. `"USD"`, `"EUR"`, `"MXN"`                     |
| `timezone`              | string   | e.g. `"America/New_York"`                           |
| `business_hours`        | object   | e.g. `{"open": "09:00", "close": "18:00"}`         |
| `settings`              | object   | Arbitrary settings key-value pairs                   |
| `phone_number`          | string   | Agency WhatsApp phone number                         |
| `meta_phone_number_id`  | string   | Meta's phone_number_id (from WhatsApp Cloud API)    |
| `ai_system_prompt`      | string   | System prompt for the n8n AI agent                   |
| `capabilities`          | string[] | Enabled features, e.g. `["property_info", "scheduling"]` |

When `meta_phone_number_id` is provided, a `PHONE_NUMBER_ID` mapping is created in DynamoDB for tenant resolution.

**Response:** `200 OK`

```json
{
  "message": "Setup complete. Your workspace is ready."
}
```

---

### Get Tenant Config

```
GET /onboarding/config
```

Returns the full tenant configuration. Used by the frontend settings page and by n8n to load AI agent context.

**Response:** `200 OK`

```json
{
  "id": "01HXYZ...",
  "business_name": "Proyectos Inmobiliarios ABC",
  "business_type": "real_estate",
  "owner_email": "admin@proyectosabc.com",
  "plan": "free",
  "phone_number": "+593991234567",
  "meta_phone_number_id": "102938...",
  "ai_system_prompt": "Eres el asistente virtual inmobiliario de Proyectos ABC...",
  "capabilities": ["property_info", "scheduling"],
  "currency": "USD",
  "timezone": "America/Guayaquil",
  "business_hours": {"open": "08:00", "close": "18:00"}
}
```

---

### Resolve Tenant by Phone Number ID

**Service key auth required** (no JWT).

```
GET /onboarding/resolve-phone?phone_number_id=102938...
```

Resolves a Meta `phone_number_id` to a tenant and returns the full tenant config. Used by n8n when an inbound WhatsApp message arrives.

**Query Parameters:**

| Param              | Type   | Required | Description                     |
| ------------------ | ------ | -------- | ------------------------------- |
| `phone_number_id`  | string | yes      | Meta's phone_number_id          |

**Response:** `200 OK` — same shape as GET /onboarding/config.

---

## Properties

### List Properties

```
GET /properties
```

Returns all properties for the tenant.

**Query Parameters:**

| Param        | Type   | Default | Description                            |
| ------------ | ------ | ------- | -------------------------------------- |
| `search`     | string | --      | Search in name, description, and tags  |
| `city`       | string | --      | Filter by city                         |
| `type`       | string | --      | `sale` or `rent`                       |

**Response:** `200 OK`

```json
{
  "properties": [
    {
      "id": "01HXYZ...",
      "name": "Suite La Carolina",
      "price": 125000,
      "city": "Quito",
      "transaction_type": "sale",
      "property_type": "departamento",
      "status": "disponible"
    }
  ]
}
```

---

### Create Property

```
POST /properties
```

**Request Body:**

| Field              | Type   | Required | Description                                      |
| ------------------ | ------ | -------- | ------------------------------------------------ |
| `name`             | string | yes      | Public title of the property                     |
| `description`      | string | no       | Detailed description                             |
| `price`            | decimal| yes      | Sale or monthly rent price                       |
| `city`             | string | yes      | e.g. "Quito"                                     |
| `neighborhood`     | string | no       | e.g. "La Carolina"                               |
| `transaction_type` | string | yes      | `sale` or `rent`                                 |
| `property_type`    | string | yes      | `departamento`, `casa`, `oficina`, `terreno`     |

**Response:** `201 Created`

---

## Leads & Contacts

### List Contacts

```
GET /contacts
```

Returns all contacts/leads gathered via WhatsApp or manual entry.

**Response:** `200 OK`

```json
{
  "contacts": [
    {
      "contact_id": "con-001",
      "name": "Alice Smith",
      "phone": "+15551234567",
      "lead_status": "interested",
      "tier": "hot"
    }
  ]
}
```

---

## Messages

### List Conversations

```
GET /messages
```

Returns summarized WhatsApp conversations.

### Get Thread

```
GET /contacts/{id}/messages
```

Returns the full message history for a specific contact.
pleted"
}
```

---

## Contacts (Leads)

### List Contacts

```
GET /contacts
```

**Query:** `phone` (optional — filter by exact phone), `limit`, `next_token`.

**Response:** `200 OK` with `{ "contacts": [...], "next_token": "..." }`.

Each contact: `contact_id`, `name`, `phone`, `email`, `source_channel`, `lead_status` (prospect | interested | closed_won | abandoned), `tier` (bronze | silver | gold), `tags`, `created_ts`, `last_activity_ts`.

### Create Contact

```
POST /contacts
```

**Body:** `name` (required), `phone`, `email`, `source_channel`. Defaults: `lead_status=prospect`, `tier=bronze`.

**Response:** `201 Created` with the created contact.

### Get Contact

```
GET /contacts/{id}
```

**Response:** `200 OK` with contact object.

### Patch Contact (partial update)

```
PATCH /contacts/{id}
```

**Body:** any of `name`, `phone`, `email`, `source_channel`, `lead_status`, `tier`, `last_activity_ts`, `tags`. Validates `lead_status` and `tier` enum values.

**Response:** `200 OK` with updated contact.

### Delete Contact

```
DELETE /contacts/{id}
```

**Response:** `204 No Content`.

### List Contact Messages (conversation history)

```
GET /contacts/{id}/messages
```

**Query:** `limit`, `next_token`. **Response:** `200 OK` with `{ "messages": [...] }`.

---

## Messages

### List Messages

```
GET /messages
```

**Query:** `contact_id`, `channel`, `category` (active | incomplete | closed), `limit`, `next_token`.

**Response:** `200 OK` with `{ "messages": [...] }`. Each message: `message_id`, `channel`, `from_number`, `to_number`, `text`, `contact_id`, `category`, `processed_flags`, `created_ts`.

### Create Message

```
POST /messages
```

**Body:** `channel`, `channel_message_id`, `from_number`, `to_number`, `text`, `contact_id`, `category`, `metadata`, `processed_flags`.

**Response:** `201 Created` with the created message.

### Update Message Flags

```
PATCH /messages/{id}/flags
```

**Body:** `category` (active | incomplete | closed) and/or `processed_flags` (array of strings).

**Response:** `200 OK` with updated message.

---

## Common Error Response Format

All errors follow this shape:

```json
{
  "error": "Human-readable error message"
}
```

| Status | Meaning                                    |
| ------ | ------------------------------------------ |
| 400    | Bad request (validation, insufficient stock) |
| 401    | Unauthorized (missing or invalid JWT)       |
| 403    | Forbidden (insufficient role)               |
| 404    | Resource not found                          |
| 409    | Conflict (duplicate email on signup)        |
| 500    | Internal server error                       |
| 503    | Service unavailable (Bedrock down)          |
