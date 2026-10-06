# Topos dev container — toolchains only, no infra.
#
# Infra (postgres, mongo, redis, kafka, qdrant) stays in the existing local
# compose stack (infrastructure/docker/local/compose.yml) and is reached over
# the host Docker socket. This image only pins the build tools so a fresh
# checkout can run every service natively without installing runtimes.
FROM mcr.microsoft.com/devcontainers/base:ubuntu

ARG TERRAFORM_VERSION=1.9.8

RUN apt-get update && apt-get install -y --no-install-recommends \
        protobuf-compiler \
        libprotobuf-dev \
        unzip \
    && rm -rf /var/lib/apt/lists/* \
    && ARCH="$(dpkg --print-architecture)" \
    && curl -fsSL -o /tmp/terraform.zip \
        "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_${ARCH}.zip" \
    && unzip -o /tmp/terraform.zip -d /usr/local/bin \
    && rm /tmp/terraform.zip \
    && terraform version \
    && protoc --version
