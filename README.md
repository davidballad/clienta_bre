# Clienta BR

AI-powered Real Estate platform (CRM + WhatsApp Agent) designed for real estate brokers and developers to manage properties, leads, and automated RAG-based customer interactions.

## Key Features

- **AI WhatsApp Agent**: Handles property inquiries using RAG (Retrieval-Augmented Generation) with a specialized property knowledge base.
- **Lead Scoring & Intent**: Automated lead qualification and probability scoring based on customer interactions.
- **Property Management**: Specialized CRUD for real estate listings, including document processing (flyers, deeds) via AI.
- **Multi-Tenant Architecture**: Robust tenant isolation for independent real estate offices.
- **Analytics Dashboard**: Real-time insights into lead activity, property popularity, and conversion rates.

## Architecture

- **Frontend**: React + Vite SPA (HeroUI, Framer Motion) deployed to S3 + CloudFront.
- **Auth**: AWS Cognito (User Pools + JWT).
- **API**: API Gateway (HTTP API) + Lambda (Python 3.12).
- **Database**: DynamoDB (Single-table design).
- **AI / RAG**: 
    - **LLM**: Anthropic Claude 3.5 Sonnet (AWS Bedrock).
    - **Embeddings**: Amazon Titan Text Embeddings v2 (AWS Bedrock).
    - **Vector DB**: AWS S3 Vectors (Native vector search on property data).
- **Orchestration**: n8n for WhatsApp workflow management.
- **IaC**: Terraform.

## Project Structure

```
clienta-br/
  terraform/               # Infrastructure as Code (AWS)
    config/prod/           # Production environment configuration
  backend/
    functions/             # Lambda functions (Python)
      properties/          # Property CRUD, RAG, and AI extraction
      contacts/            # Real estate lead management & scoring
      onboarding/          # Tenant & user provisioning
      users/               # Multi-user management
      agents/              # AI-powered real estate assistant kit
      messages/            # WhatsApp chat history & thread management
    shared/                # Shared utilities (models, auth, db)
  frontend/
    src/
      pages/               # BRDashboard, BRELanding, PropertyForm, etc.
      components/          # BR-specific layouts and UI elements
  docs/                    # Technical documentation
```

## Getting Started

### Local Development

```bash
# Backend (Local Testing)
cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

# Frontend
cd frontend && npm install && npm run dev
```

### Infrastructure Deployment

See `terraform/config/README.md` for detailed commands.

```bash
cd terraform
terraform init -reconfigure -backend-config=config/prod/backend.tfvars
terraform plan -var-file=config/prod/variables.tfvars
```

## Data Model (DynamoDB)

| Entity            | PK                | SK                          | GSI1PK                          |
| ----------------- | ----------------- | --------------------------- | ------------------------------- |
| Tenant            | `TENANT#<id>`     | `TENANT#<id>`               | --                              |
| Property          | `TENANT#<id>`     | `PROPERTY#<id>`             | --                              |
| User              | `TENANT#<id>`     | `USER#<id>`                 | --                              |
| Contact / Lead    | `TENANT#<id>`     | `CONTACT#<id>`              | --                              |
| WhatsApp Message  | `TENANT#<id>`     | `MESSAGE#<id>`              | --                              |
| Conv. Summary     | `TENANT#<id>`     | `CONVO#<phone>`             | --                              |

## License

Proprietary - All rights reserved.
