# System Architecture

## Product

Service Business Website Engine

## Architecture Style

The platform follows a modular Service-Oriented Architecture (SOA) approach.

The system is designed as a multi-tenant SaaS platform where businesses operate independently within the same application infrastructure.

## Core Layers

### Presentation Layer
Next.js / React UI.

### API Layer
Authenticated API endpoints responsible for receiving requests and returning structured responses.

### Service Layer
Business logic and domain operations.

### Data Layer
Prisma ORM.

### Database
PostgreSQL hosted through Supabase.

### Authentication
Supabase Auth.

## Multi-Tenancy

Each business represents a tenant.

Business-owned records must be scoped to the appropriate business.

Authorization must be enforced server-side.

## Future Architecture

V2 introduces the website generation layer.

V3 introduces payments and subscriptions.

V4 introduces advanced automation.

V5 focuses on scale and infrastructure.