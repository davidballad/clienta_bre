# =============================================================================
# Outputs
# =============================================================================

output "api_endpoint" {
  description = "API Gateway HTTP API endpoint URL"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID (managed by main clientaai repo)"
  value       = var.cognito_user_pool_id
}

output "cognito_client_id" {
  description = "Cognito User Pool Client ID for the BR SPA"
  value       = var.cognito_client_id
}

output "frontend_bucket" {
  description = "S3 bucket name for frontend static hosting"
  value       = aws_s3_bucket.frontend.id
}

output "data_bucket" {
  description = "S3 bucket name for receipts and exports"
  value       = aws_s3_bucket.data.id
}

output "cloudfront_domain" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "cloudfront_url" {
  description = "CloudFront distribution URL (https)"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (for cache invalidation)"
  value       = aws_cloudfront_distribution.frontend.id
}

output "dynamodb_table_name" {
  description = "DynamoDB table name"
  value       = aws_dynamodb_table.main.name
}

# BR outputs
output "s3v_bucket_name" {
  description = "S3 Vectors bucket name for BR property embeddings"
  value       = aws_s3vectors_vector_bucket.br_properties.vector_bucket_name
}

output "s3v_index_name" {
  description = "S3 Vectors index name for property embeddings"
  value       = aws_s3vectors_index.br_properties.index_name
}

output "properties_lambda_name" {
  description = "Properties Lambda function name"
  value       = aws_lambda_function.properties.function_name
}
