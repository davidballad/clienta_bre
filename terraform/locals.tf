# =============================================================================
# Locals
# =============================================================================

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  name_suffix = "${var.project_name}-${var.environment}"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  # Lambda functions deployed via for_each
  lambda_functions = {
    onboarding = {
      memory_size = 256
      timeout     = 30
    }
    users = {
      memory_size = 256
      timeout     = 30
    }
    contacts = {
      memory_size = 256
      timeout     = 30
    }
    messages = {
      memory_size = 256
      timeout     = 30
    }
    agents = {
      memory_size = 512
      timeout     = 60
    }
    properties = {
      memory_size = 512
      timeout     = 120
    }
  }


  packages_dir = "${path.module}/packages"
}
