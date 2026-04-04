# =============================================================================
# S3 Vectors — Bienes Raíces RAG Vector Store
# =============================================================================
# Stores property embeddings (Amazon Titan Embed V2, 512 dimensions) for
# semantic search via the RAG query engine. Each tenant's data is isolated
# by metadata filtering within a shared index.

resource "aws_s3vectors_vector_bucket" "br_properties" {
  vector_bucket_name = "${local.name_prefix}-br-vectors"
}

resource "aws_s3vectors_index" "br_properties" {
  index_name         = "property-embeddings"
  vector_bucket_name = aws_s3vectors_vector_bucket.br_properties.vector_bucket_name

  data_type       = "float32"
  dimension       = 512 # Amazon Titan Embed V2 output dimension
  distance_metric = "cosine"
}
