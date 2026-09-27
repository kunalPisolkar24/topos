variable "name" {
  description = "Security group name."
  type        = string
}

variable "description" {
  description = "Security group description."
  type        = string
}

variable "vpc_id" {
  description = "VPC in which to create the security group."
  type        = string
}

variable "allowed_cidr_blocks" {
  description = "CIDRs allowed to reach each ingress rule."
  type        = list(string)
}

variable "ingress_rules" {
  description = "TCP/UDP ingress port ranges."
  type = list(object({
    from_port = number
    to_port   = number
    protocol  = string
  }))
}

variable "tags" {
  description = "Resource tags."
  type        = map(string)
}
