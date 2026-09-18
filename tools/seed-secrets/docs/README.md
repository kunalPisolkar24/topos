# Seed Secrets Documentation

Welcome to the Seed Secrets documentation. This tool reads an allowlisted subset of keys from a `.env` file and upserts them as JSON blobs into AWS Secrets Manager.

## New to This Tool?

Start here:

1. **[Quick Start](getting-started/quickstart.md)** - Seed your first secrets in minutes
2. **[Architecture](concepts/architecture.md)** - Understand how the tool is built
3. **[Configuration](getting-started/configuration.md)** - Set up AWS credentials and endpoints

## Documentation by Topic

### Getting Started

| Document | What You'll Learn | When to Read |
|----------|-------------------|--------------|
| [Quick Start](getting-started/quickstart.md) | Install, configure, and seed secrets locally | First time using the tool |
| [Configuration](getting-started/configuration.md) | All settings, env vars, and endpoints | Setting up credentials or troubleshooting |

### Concepts

| Document | What You'll Learn | When to Read |
|----------|-------------------|--------------|
| [Architecture](concepts/architecture.md) | How the tool is structured and why | Understanding the codebase |
| [Seeding Flow](concepts/seeding-flow.md) | Step-by-step what happens when you seed | Understanding the lifecycle |

### Components

| Document | What You'll Learn | When to Read |
|----------|-------------------|--------------|
| [CLI Reference](components/cli.md) | All command-line arguments and examples | Running the tool |
| [Validation & Guards](components/validation.md) | Safety guards and allowlist rules | Debugging guard errors |
| [Secrets Mapping](components/secrets-mapping.md) | Which env keys go to which secret name | Understanding the secret structure |

### Testing

| Document | What You'll Learn | When to Read |
|----------|-------------------|--------------|
| [Testing Overview](testing/overview.md) | How to run and write tests | Contributing or debugging |

## Reading Order for Different Roles

### New Developers
1. [Quick Start](getting-started/quickstart.md) - Get it running
2. [Architecture](concepts/architecture.md) - Understand the big picture
3. [Secrets Mapping](components/secrets-mapping.md) - Know what gets seeded where
4. [Configuration](getting-started/configuration.md) - Set up your environment

### DevOps / Release Managers
1. [Quick Start](getting-started/quickstart.md) - Get it running
2. [Configuration](getting-started/configuration.md) - Configure endpoints and regions
3. [CLI Reference](components/cli.md) - Learn all command options
4. [Validation & Guards](components/validation.md) - Understand safety guards

### Contributors
1. [Architecture](concepts/architecture.md) - Understand the codebase structure
2. [Testing Overview](testing/overview.md) - How to run and write tests
3. [Seeding Flow](concepts/seeding-flow.md) - Understand the full lifecycle
4. [Validation & Guards](components/validation.md) - Input rules and constraints

## Related Files

- **Main README**: [`../../README.md`](../../README.md) - Project overview
- **Makefile**: [`../../Makefile`](../../Makefile) - Root build and seed commands
- **CI Pipeline**: [`../../.github/workflows/tools-seed-secrets.yaml`](../../.github/workflows/tools-seed-secrets.yaml) - GitHub Actions workflow
- **Example Env**: [`../../.env.example`](../../.env.example) - Environment template
