# =============================================================================
# API Gateway HTTP API
# =============================================================================

resource "aws_apigatewayv2_api" "main" {
  name          = "${local.name_prefix}-api"
  protocol_type = "HTTP"
  description   = "Clienta BR API Gateway"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization", "X-Service-Key", "X-Tenant-Id"]
  }

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# Cognito JWT Authorizer
# -----------------------------------------------------------------------------

resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-jwt-authorizer"

  jwt_configuration {
    audience = [var.cognito_client_id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${var.cognito_user_pool_id}"
  }
}

# -----------------------------------------------------------------------------
# Lambda Integrations
# -----------------------------------------------------------------------------

resource "aws_apigatewayv2_integration" "onboarding" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.services["onboarding"].invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "users" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.services["users"].invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "contacts" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.services["contacts"].invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "messages" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.services["messages"].invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "agents" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.services["agents"].invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "properties" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.properties.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------

# --- Contacts ---
resource "aws_apigatewayv2_route" "contacts_list" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /contacts"
  target    = "integrations/${aws_apigatewayv2_integration.contacts.id}"
}

resource "aws_apigatewayv2_route" "contacts_create" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /contacts"
  target    = "integrations/${aws_apigatewayv2_integration.contacts.id}"
}

resource "aws_apigatewayv2_route" "contacts_get" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /contacts/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.contacts.id}"
}

resource "aws_apigatewayv2_route" "contacts_update" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "PUT /contacts/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.contacts.id}"
}

resource "aws_apigatewayv2_route" "contacts_delete" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "DELETE /contacts/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.contacts.id}"
}

resource "aws_apigatewayv2_route" "contacts_patch" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "PATCH /contacts/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.contacts.id}"
}

resource "aws_apigatewayv2_route" "contacts_stats" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /contacts/stats"
  target    = "integrations/${aws_apigatewayv2_integration.contacts.id}"
}

resource "aws_apigatewayv2_route" "contacts_messages" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /contacts/{id}/messages"
  target    = "integrations/${aws_apigatewayv2_integration.messages.id}"
}

# --- Messages / Conversations ---
resource "aws_apigatewayv2_route" "messages_list" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /messages"
  target    = "integrations/${aws_apigatewayv2_integration.messages.id}"
}

resource "aws_apigatewayv2_route" "conversations_list" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /conversations"
  target    = "integrations/${aws_apigatewayv2_integration.messages.id}"
}

resource "aws_apigatewayv2_route" "conversations_messages" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /conversations/{phone}/messages"
  target    = "integrations/${aws_apigatewayv2_integration.messages.id}"
}

resource "aws_apigatewayv2_route" "messages_create" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /messages"
  target    = "integrations/${aws_apigatewayv2_integration.messages.id}"
}

resource "aws_apigatewayv2_route" "messages_send" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /messages/send"
  target    = "integrations/${aws_apigatewayv2_integration.messages.id}"
}

resource "aws_apigatewayv2_route" "messages_mark_conversation" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /messages/mark-conversation"
  target    = "integrations/${aws_apigatewayv2_integration.messages.id}"
}

resource "aws_apigatewayv2_route" "messages_flags" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "PATCH /messages/{id}/flags"
  target    = "integrations/${aws_apigatewayv2_integration.messages.id}"
}

# --- Onboarding ---
resource "aws_apigatewayv2_route" "onboarding_tenant" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /onboarding/tenant"
  target    = "integrations/${aws_apigatewayv2_integration.onboarding.id}"
}

resource "aws_apigatewayv2_route" "contact_landing" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /contact"
  target    = "integrations/${aws_apigatewayv2_integration.onboarding.id}"
}

resource "aws_apigatewayv2_route" "onboarding_setup" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /onboarding/setup"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
  target             = "integrations/${aws_apigatewayv2_integration.onboarding.id}"
}

resource "aws_apigatewayv2_route" "onboarding_config" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /onboarding/config"
  target    = "integrations/${aws_apigatewayv2_integration.onboarding.id}"
}

resource "aws_apigatewayv2_route" "onboarding_resolve_phone" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /onboarding/resolve-phone"
  target    = "integrations/${aws_apigatewayv2_integration.onboarding.id}"
}

# --- Users ---
resource "aws_apigatewayv2_route" "users_list" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /users"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
  target             = "integrations/${aws_apigatewayv2_integration.users.id}"
}

resource "aws_apigatewayv2_route" "users_invite" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /users"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
  target             = "integrations/${aws_apigatewayv2_integration.users.id}"
}

# --- AI Agents ---
resource "aws_apigatewayv2_route" "agents_run" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /agents/{agent_type}/run"
  target    = "integrations/${aws_apigatewayv2_integration.agents.id}"
}

# --- Properties (Clienta BR) ---
resource "aws_apigatewayv2_route" "properties_list" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /properties"
  target    = "integrations/${aws_apigatewayv2_integration.properties.id}"
}


resource "aws_apigatewayv2_route" "properties_create" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /properties"
  target    = "integrations/${aws_apigatewayv2_integration.properties.id}"
}

resource "aws_apigatewayv2_route" "properties_get" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /properties/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.properties.id}"
}

resource "aws_apigatewayv2_route" "properties_update" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "PUT /properties/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.properties.id}"
}

resource "aws_apigatewayv2_route" "properties_delete" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "DELETE /properties/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.properties.id}"
}

resource "aws_apigatewayv2_route" "properties_stats" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /properties/stats"
  target    = "integrations/${aws_apigatewayv2_integration.properties.id}"
}

resource "aws_apigatewayv2_route" "properties_extract_flyer" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /properties/extract-flyer"
  target    = "integrations/${aws_apigatewayv2_integration.properties.id}"
}

resource "aws_apigatewayv2_route" "properties_process_doc" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /properties/process-doc"
  target    = "integrations/${aws_apigatewayv2_integration.properties.id}"
}

resource "aws_apigatewayv2_route" "properties_query" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /properties/query"
  target    = "integrations/${aws_apigatewayv2_integration.properties.id}"
}

resource "aws_apigatewayv2_route" "properties_score_lead" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /properties/score-lead"
  target    = "integrations/${aws_apigatewayv2_integration.properties.id}"
}

resource "aws_apigatewayv2_route" "properties_upload_url" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /properties/{id}/upload-url"
  target    = "integrations/${aws_apigatewayv2_integration.properties.id}"
}

resource "aws_apigatewayv2_route" "properties_import" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /properties/import"
  target    = "integrations/${aws_apigatewayv2_integration.properties.id}"
}

resource "aws_apigatewayv2_route" "properties_template" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /properties/export/template"
  target    = "integrations/${aws_apigatewayv2_integration.properties.id}"
}

# -----------------------------------------------------------------------------
# Deployment & Stage
# -----------------------------------------------------------------------------

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gw.arn
    format          = jsonencode({
      requestId               = "$context.requestId"
      sourceIp                = "$context.identity.sourceIp"
      requestTime             = "$context.requestTime"
      httpMethod              = "$context.httpMethod"
      routeKey                = "$context.routeKey"
      status                  = "$context.status"
      protocol                = "$context.protocol"
      responseLength          = "$context.responseLength"
      error                   = "$context.error.message"
      integrationErrorMessage = "$context.integrationErrorMessage"
    })
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "api_gw" {
  name              = "/aws/api-gw/${aws_apigatewayv2_api.main.name}"
  retention_in_days = 7
  tags              = local.common_tags
}

# -----------------------------------------------------------------------------
# Lambda Permissions
# -----------------------------------------------------------------------------

resource "aws_lambda_permission" "api_gateway_services" {
  for_each      = aws_lambda_function.services
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = each.value.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_properties" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.properties.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
