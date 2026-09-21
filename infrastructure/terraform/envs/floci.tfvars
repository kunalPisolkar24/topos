# Floci — local AWS emulator. Mirrors the docker topology (single Postgres + Redis).
# Keep costs and emulation load minimal: single-AZ, no replicas, no deletion protection.

project     = "topos"
environment = "floci"

vpc_id             = "vpc-default-ap-south-1"
private_subnet_ids = ["subnet-default-ap-south-1-a", "subnet-default-ap-south-1-b"]
allowed_cidr_blocks = ["172.31.0.0/16"]

# RDS — single-AZ micro, no proxy on Floci
postgres_engine_version       = "16.3"
postgres_instance_class       = "db.t4g.micro"
postgres_allocated_storage    = 20
postgres_multi_az             = false
postgres_deletion_protection  = false
postgres_backup_retention_period = 1
postgres_db_name              = "topos_users"
postgres_username             = "topos_user"

# ElastiCache — single node, no replica
redis_engine_version             = "7.0"
redis_node_type                  = "cache.t4g.micro"
redis_num_cache_clusters         = 1
redis_automatic_failover_enabled = false
redis_multi_az_enabled           = false
redis_snapshot_retention_limit   = 0

name_prefix = "topos-user-floci"

aws_region       = "ap-south-1"
aws_endpoint_url = "http://localhost:4566"

tags = {
  Owner = "kunal"
}
