# Terraform config (prod)

Single deployment: **prod** only.

| File | Purpose |
|------|--------|
| `config/prod/backend.tfvars` | Backend: S3 state bucket + S3-native lock (`use_lockfile = true`), no DynamoDB |
| `config/prod/variables.tfvars` | Variable values (environment, app DynamoDB table name, etc.) — not committed |
| `config/prod/secrets.tfvars` | Secrets: `gemini_api_key`, `service_api_key` — **not committed**. Copy from `secrets.tfvars.example`. |

Locking uses a `.tflock` file in the same S3 bucket (Terraform 1.8+). The `dynamodb_table_name` in `variables.tfvars` is the **application** DynamoDB table used by Lambdas (not for state).

---

## Init (from `terraform/`)

```bash
cd terraform
terraform init -reconfigure -backend-config=config/prod/backend.tfvars
```

---

## Plan / Apply

**One-time:** copy the secrets example and fill in (file is gitignored):

```bash
cd terraform
cp config/prod/secrets.tfvars.example config/prod/secrets.tfvars
# Edit config/prod/secrets.tfvars: set gemini_api_key and service_api_key
```

Then from `terraform/`:

```bash
terraform plan  -var-file=config/prod/variables.tfvars -var-file=config/prod/secrets.tfvars
terraform apply -var-file=config/prod/variables.tfvars -var-file=config/prod/secrets.tfvars
```

**Using the deploy script** (from repo root): `./scripts/deploy.sh` loads both var-files automatically. Ensure `config/prod/variables.tfvars` and `config/prod/secrets.tfvars` exist.

| In secrets.tfvars | Purpose |
|-------------------|---------| 
| `service_api_key` | n8n → API auth (X-Service-Key) |
| `gemini_api_key` | Google AI Studio API key for Gemini vision ([aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)) |

---

## One-time: create state bucket (no DynamoDB needed)

With `use_lockfile = true`, only an S3 bucket is needed. From `terraform/config/bootstrap/`:

```bash
cd terraform/config/bootstrap
cp terraform.tfvars.example terraform.tfvars   # edit state_bucket_name (globally unique)
terraform init
terraform apply
```

Then set the same `bucket` in `config/prod/backend.tfvars`. You can skip creating the DynamoDB table in bootstrap if you only use `use_lockfile`.

---

## AWS SSO (profiles: clienta / prod)

If you use **AWS SSO** and have profiles in `~/.aws/config` (e.g. `[profile clienta]`, `[profile prod]`), log in then set the profile when running Terraform:

**Login (once per session):**
```bash
aws sso login --profile prod     # or --profile clienta
```

**Bash:**
```bash
export AWS_PROFILE=prod
cd terraform
terraform init -reconfigure -backend-config=config/prod/backend.tfvars
terraform plan -var-file=config/prod/variables.tfvars -var-file=config/prod/secrets.tfvars
```

---

## BR-Specific Resources

This stack provisions the real estate (Bienes Raíces) module on top of the CRM:

| Resource | Purpose |
|----------|---------|
| S3 Vectors bucket + index | Property embeddings via Titan Embed V2 (512-dim cosine) |
| Properties Lambda | CRUD + AI endpoints (Bedrock, Gemini, RAG) |
| Bedrock IAM | InvokeModel for Titan Embed V2 + Claude 3.5 Sonnet |
| S3 Vectors IAM | Vector CRUD for RAG |
