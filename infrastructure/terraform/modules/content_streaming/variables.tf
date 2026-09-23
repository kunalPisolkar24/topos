variable "project" { type = string }
variable "environment" { type = string }
variable "name_prefix" { type = string }

variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "allowed_cidr_blocks" { type = list(string) }

variable "kafka_version" { type = string }
variable "instance_type" { type = string }
variable "number_of_broker_nodes" { type = number }
variable "ebs_volume_size" { type = number }

variable "aws_endpoint_url" { type = string }
variable "aws_region" { type = string }

variable "tags" { type = map(string) }
