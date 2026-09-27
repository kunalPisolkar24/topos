# =============================================================================
# Content Streaming — MSK (single broker, Floci-compatible)
# =============================================================================

module "security_group" {
  source = "../security_group"

  name                = "${var.name_prefix}-msk-sg"
  description         = "Content MSK access"
  vpc_id              = var.vpc_id
  allowed_cidr_blocks = var.allowed_cidr_blocks
  ingress_rules = [
    {
      from_port = 9092
      to_port   = 9092
      protocol  = "tcp"
    },
    {
      from_port = 9098
      to_port   = 9098
      protocol  = "tcp"
    },
  ]
  tags = var.tags
}

resource "aws_msk_cluster" "content" {
  cluster_name           = "${var.name_prefix}-msk"
  kafka_version          = var.kafka_version
  number_of_broker_nodes = var.number_of_broker_nodes

  broker_node_group_info {
    instance_type   = var.instance_type
    client_subnets  = slice(var.private_subnet_ids, 0, min(var.number_of_broker_nodes, length(var.private_subnet_ids)))
    security_groups = [module.security_group.id]

    storage_info {
      ebs_storage_info {
        volume_size = var.ebs_volume_size
      }
    }
  }

  # Floci provisions the broker as TLS_PLAINTEXT; pin it so the provider
  # default ("TLS") doesn't cause a perpetual diff whose UpdateSecurity
  # call Floci rejects (405). Real AWS keeps the provider default.
  encryption_info {
    encryption_in_transit {
      client_broker = var.aws_endpoint_url != "" ? "TLS_PLAINTEXT" : "TLS"
    }
  }

  tags = var.tags
}
