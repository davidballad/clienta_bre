# Clienta AI — Architecture

## System Overview

```mermaid
graph TB
  subgraph client [Client]
    Browser["React SPA"]
  end

  subgraph cdn [CDN]
    CloudFront["CloudFront"]
  end

  subgraph auth [Authentication]
    Cognito["Cognito User Pool"]
  end

  subgraph api [API Layer]
    APIGW["API Gateway HTTP API"]
    JWTAuth["JWT Authorizer"]
  end

  subgraph whatsapp [WhatsApp Channel]
    Meta["Meta WhatsApp\nCloud API"]
    n8n["n8n AI Agent\n(self-hosted)"]
  end

  subgraph compute [Compute -- Lambda Functions]
    Properties["Properties Service"]
    Onboarding["Onboarding Service"]
    Users["User Management Service"]
    Messages["Messages Service"]
    Contacts["Contacts Service"]
    Agents["Agents Service"]
  end

  subgraph data [Data Layer]
    DynamoDB["DynamoDB Single Table"]
    S3Data["S3 Data Bucket"]
    Secrets["Secrets Manager"]
  end

  subgraph ai [AI]
    Gemini["Google Gemini API\n(AI Insights)"]
    Ollama["Ollama\n(n8n AI Agent, self-hosted)"]
  end

  subgraph hosting [Static Hosting]
    S3Frontend["S3 Frontend Bucket"]
  end

  Browser -->|HTTPS| CloudFront
  CloudFront -->|Origin| S3Frontend
  Browser -->|"API calls + JWT"| APIGW
  APIGW --> JWTAuth
  JWTAuth -->|Validate| Cognito
  APIGW --> Properties
  APIGW --> Onboarding
  APIGW --> Users
  APIGW --> Messages
  APIGW --> Contacts
  APIGW --> Agents
  Meta -->|Webhook| n8n
  n8n -->|"Service Key + Tenant ID"| APIGW
  n8n -->|Reply| Meta
  n8n -->|"Inference API"| Ollama
  Properties --> DynamoDB
  Onboarding --> DynamoDB
  Onboarding --> Cognito
  Users --> DynamoDB
  Users --> Cognito
  Messages --> DynamoDB
  Contacts --> DynamoDB
  Agents --> DynamoDB
  Properties --> S3Data
```

All services run as Lambda functions (Python 3.12) behind a single API Gateway HTTP API. Data is stored in a single DynamoDB table using a multi-tenant single-table design. The React SPA is served from S3 via CloudFront.

WhatsApp messages are handled by n8n (self-hosted): Meta sends webhooks directly to n8n, which runs an AI Agent (Ollama, self-hosted) to process conversations. n8n calls the Clienta API using a service key (`X-Service-Key` + `X-Tenant-Id` headers) to manage contacts, messages, and property listings. Tenant resolution uses Meta's `phone_number_id` mapped in DynamoDB.

---

## Request Lifecycle

```mermaid
sequenceDiagram
  participant B as Browser
  participant CF as CloudFront
  participant AG as API Gateway
  participant C as Cognito
  participant L as Lambda
  participant DB as DynamoDB

  B->>CF: GET /index.html
  CF->>B: React SPA

  Note over B: User signs in
  B->>C: SRP Auth (email + password)
  C->>B: JWT (id_token, access_token, refresh_token)

  Note over B: API Request
  B->>AG: GET /properties (Authorization: Bearer <JWT>)
  AG->>C: Validate JWT signature + expiry
  C-->>AG: Claims (sub, email, custom:tenant_id, custom:role)
  AG->>L: Invoke Lambda with event (claims injected)
  L->>L: @require_auth extracts tenant_id from claims
  L->>DB: Query(pk=TENANT#<tid>, sk begins_with PROPERTY#)
  DB-->>L: Items[]
  L-->>AG: 200 {properties: [...]}
  AG-->>B: JSON response
```

Key points:
- For browser requests, API Gateway validates the JWT before Lambda is invoked
- For n8n/service requests, Lambda validates the `X-Service-Key` header and reads `X-Tenant-Id`
- The `extract_tenant_id()` function tries JWT first, then falls back to service key auth
- All DynamoDB queries are scoped to the tenant's partition key, ensuring data isolation

---

## WhatsApp AI Agent (n8n)

```mermaid
sequenceDiagram
  participant C as Customer (WhatsApp)
  participant M as Meta Cloud API
  participant N as n8n AI Agent
  participant API as Clienta API
  participant DB as DynamoDB
  participant OL as Ollama (self-hosted)

  C->>M: "Busco departamento en La Carolina"
  M->>N: Webhook (phone_number_id, from, text)

  Note over N: Step 1 — Resolve tenant
  N->>API: GET /onboarding/resolve-phone?phone_number_id=102938
  API->>DB: GetItem(PHONE_NUMBER_ID, 102938)
  DB-->>API: tenant_id, config
  API-->>N: Tenant config (ai_system_prompt, capabilities, ...)

  Note over N: Step 2 — Find/create contact
  N->>API: GET /contacts?phone=34612345678 (X-Service-Key)
  API-->>N: Contact (or create new)

  Note over N: Step 3 — Store inbound message
  N->>API: POST /messages (X-Service-Key + X-Tenant-Id)
  API-->>N: message_id

  Note over N: Step 4 — AI Agent processes
  N->>OL: Invoke model (system prompt + history + tools)
  OL-->>N: Tool call: search_properties("La Carolina")
  N->>API: GET /properties?search=La Carolina
  API-->>N: Properties list
  N->>OL: Tool result + continue
  OL-->>N: "Tengo un departamento de 2BR a $125k. ¿Deseas visitarlo?"

  Note over N: Step 5 — Reply
  N->>M: Send message via WhatsApp Cloud API
  M->>C: "Tengo un departamento..."
  N->>API: POST /messages (store outbound)
```

Key design decisions:
- Meta sends webhooks directly to n8n (no Lambda in between) for simplicity
- One n8n workflow handles all tenants — tenant config is loaded dynamically per message
- The AI Agent uses Ollama (self-hosted) with tool calling for properties, contacts, and lead scoring.
- Service key auth (`X-Service-Key` + `X-Tenant-Id`) enables n8n to act on behalf of any tenant
- Tenant resolution uses Meta's `phone_number_id` (stable, unique per business phone)

---

## DynamoDB Single-Table Design

All entities share one table. The partition key (`pk`) is always `TENANT#<tenant_id>`, ensuring all of a tenant's data is co-located for efficient queries.

```mermaid
erDiagram
  TABLE {
    string pk "TENANT#<tenant_id>"
    string sk "Entity-specific sort key"
    string gsi1pk "Optional GSI1 partition"
    string gsi1sk "Optional GSI1 sort"
    number ttl "TTL epoch (optional)"
  }
```

### Access Patterns

| Access Pattern                       | PK                          | SK / Key Condition                    | Index    |
| ------------------------------------ | --------------------------- | ------------------------------------- | -------- |
| Get tenant                           | `TENANT#<tid>`              | `TENANT#<tid>`                        | Table    |
| List all properties                  | `TENANT#<tid>`              | `begins_with(PROPERTY#)`              | Table    |
| Get one property                     | `TENANT#<tid>`              | `PROPERTY#<pid>`                      | Table    |
| List users in tenant                 | `TENANT#<tid>`              | `begins_with(USER#)`                  | Table    |
| Get one user                         | `TENANT#<tid>`              | `USER#<uid>`                          | Table    |
| Resolve tenant from phone_number_id  | `PHONE_NUMBER_ID`           | `<phone_number_id>`                   | Table    |
| Cross-entity query by SK             | --                          | SK as partition key                   | GSI2     |

### Entity Key Patterns

Properties use a composite SK when needed, enabling efficient queries and natural ordering.

---

## Authentication Flow

### Signup (Tenant Onboarding)

```mermaid
sequenceDiagram
  participant B as Browser
  participant AG as API Gateway
  participant OB as Onboarding Lambda
  participant C as Cognito
  participant DB as DynamoDB

  B->>AG: POST /onboarding/tenant (no auth)
  AG->>OB: Invoke (no JWT required)
  OB->>C: AdminCreateUser(email, custom:tenant_id, custom:role=owner)
  C-->>OB: User created
  OB->>C: AdminSetUserPassword(permanent=true)
  C-->>OB: Password set
  OB->>DB: PutItem(TENANT#<tid>, TENANT#<tid>) -- tenant record
  DB-->>OB: OK
  OB-->>AG: 201 {tenant_id, message}
  AG-->>B: Tenant created

  Note over B: Auto sign-in after signup
  B->>C: InitiateAuth (SRP)
  C-->>B: JWT tokens

  B->>AG: POST /onboarding/setup (with JWT)
  AG->>OB: Invoke
  OB->>DB: Update tenant settings
  OB-->>AG: 200 {message: "Setup complete"}
  AG-->>B: Workspace ready
```

### Sign In

```mermaid
sequenceDiagram
  participant B as Browser
  participant C as Cognito

  B->>C: InitiateAuth (USER_SRP_AUTH)
  C-->>B: Challenge
  B->>C: RespondToAuthChallenge (SRP proof)
  C-->>B: AuthResult (IdToken, AccessToken, RefreshToken)

  Note over B: IdToken contains custom:tenant_id and custom:role
  Note over B: Token stored in memory, attached to API requests
```

The frontend uses `amazon-cognito-identity-js` for SRP authentication. JWTs are stored in memory (not localStorage) and attached as `Authorization: Bearer <token>` on every API call.

---

## AI Insights Pipeline

```mermaid
sequenceDiagram
  participant B as Browser
  participant AG as API Gateway
  participant AI as AI Insights Lambda
  participant DB as DynamoDB
  participant GM as Google Gemini API

  B->>AG: POST /insights/generate
  AG->>AI: Invoke

  Note over AI: Step 1 -- Gather data
  AI->>DB: Query all properties (PROPERTY#)
  DB-->>AI: Property listings
  AI->>DB: Query transactions (TXN#, last 30 days)
  DB-->>AI: Transaction history

  Note over AI: Step 2 -- Build prompt
  AI->>AI: Calculate revenue, top properties, market trends
  AI->>AI: Construct structured prompt with business data

  Note over AI: Step 3 -- Call Gemini
  AI->>GM: generateContent (Gemini 2.5 Flash)
  GM-->>AI: JSON response (summary, forecasts, trends, revenue)

  Note over AI: Step 4 -- Cache result
  AI->>DB: PutItem(INSIGHT#<today>, TTL=7 days)
  DB-->>AI: OK

  AI-->>AG: 201 {insight object}
  AG-->>B: AI insights

  Note over B: Subsequent GET /insights returns cached result
  B->>AG: GET /insights
  AG->>AI: Invoke
  AI->>DB: GetItem(INSIGHT#<today>)
  DB-->>AI: Cached insight
  AI-->>AG: 200 {insight}
  AG-->>B: Cached AI insights
```

Key design decisions:
- Insights are generated on-demand (not scheduled) to minimize API costs
- Results are cached in DynamoDB with a 7-day TTL for automatic cleanup
- The prompt includes structured business data (inventory stats, transaction summaries) for grounded analysis
- Gemini 2.5 Flash is used for cost efficiency (free tier available in Google AI Studio)

---

## Multi-User Tenant Model

Each tenant supports multiple users with a role hierarchy:

| Role      | Level | Can Invite       | Can Manage       |
| --------- | ----- | ---------------- | ---------------- |
| `owner`   | 3     | managers + staff | managers + staff |
| `manager` | 2     | staff only       | staff only       |
| `staff`   | 1     | nobody           | nobody           |

Users are created in both Cognito (for authentication) and DynamoDB (for tenant-scoped queries). The `custom:tenant_id` and `custom:role` JWT claims ensure data isolation and role enforcement at every API call.

---

## Cost Architecture

```mermaid
graph LR
  subgraph free_tier [AWS Free Tier Coverage]
    Lambda["Lambda\n1M requests/mo"]
    APIGW["API Gateway\n1M calls/mo"]
    Dynamo["DynamoDB\n25GB + 25 RCU/WCU"]
    S3free["S3\n5GB storage"]
    CogFree["Cognito\n50K MAU"]
    CFfree["CloudFront\n1TB transfer"]
  end

  subgraph paid [Pay-per-use Only]
    GeminiCost["Gemini API\n(free tier in AI Studio)"]
  end

  free_tier --> paid
```

At 0-50 customers, estimated monthly cost is $5-25. AI Insights uses Gemini (free tier covers most usage). Caching insights daily per tenant keeps API calls minimal.
