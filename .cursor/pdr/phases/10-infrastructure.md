# Phase 10: Infrastructure & DevOps

**Status:** Not Started  
**Dependencies:** Phase 1, Phase 5, Phase 6, Phase 7, Phase 8  
**Estimated Time:** 3-4 days

## Overview

Set up Docker configurations, Tilt for local development, and optional Kubernetes manifests for production deployment.

---

## 10.1 Docker Configuration (`infra/docker`)

### API Dockerfile

- [ ] **Multi-stage Build**:
  - [ ] Base stage with Bun
  - [ ] Dependencies stage
  - [ ] Production stage
- [ ] **Bun Runtime**:
  - [ ] Use official Bun image
  - [ ] Set up working directory
  - [ ] Copy package files
- [ ] **Production Optimizations**:
  - [ ] Minimize image size
  - [ ] Set up non-root user
  - [ ] Configure health checks
  - [ ] Set resource limits

### Worker Dockerfile

- [ ] **Bun Runtime**:
  - [ ] Use Bun base image
  - [ ] Install dependencies
- [ ] **Docker SDK Access**:
  - [ ] Mount Docker socket (or use Docker-in-Docker)
  - [ ] Install Docker client if needed
  - [ ] Configure Docker access
- [ ] **Production Settings**:
  - [ ] Set up health checks
  - [ ] Configure logging
  - [ ] Set resource limits

### Fetcher Dockerfile

- [ ] **Minimal Base Image**:
  - [ ] Use minimal Bun image
  - [ ] Keep image small for fast startup
- [ ] **Bun Runtime**:
  - [ ] Install Bun
  - [ ] Copy fetcher code
- [ ] **Puppeteer/Playwright Dependencies** (if needed):
  - [ ] Install browser dependencies
  - [ ] Configure headless browser
  - [ ] Set up sandboxing
- [ ] **Security**:
  - [ ] Run as non-root user
  - [ ] Set up read-only filesystem where possible
  - [ ] Configure network isolation

### Docker Compose

- [ ] **Local Development Setup**:
  - [ ] API service
  - [ ] Worker service
  - [ ] Dashboard service (or run locally)
- [ ] **Redis Service**:
  - [ ] Redis container
  - [ ] Persistence volume
  - [ ] Port mapping
- [ ] **Turso Local Instance**:
  - [ ] Turso local database
  - [ ] Data volume
  - [ ] Port mapping
- [ ] **Service Networking**:
  - [ ] Internal network
  - [ ] Service discovery
  - [ ] Environment variables

---

## 10.2 Tilt Configuration (`infra/tilt`)

### Tiltfile Setup

- [ ] **API Service Configuration**:
  - [ ] Build configuration
  - [ ] Hot reload setup
  - [ ] Port forwarding (8080)
  - [ ] Environment variables
- [ ] **Worker Service Configuration**:
  - [ ] Build configuration
  - [ ] Hot reload setup
  - [ ] Docker socket access
  - [ ] Environment variables
- [ ] **Dashboard Service Configuration**:
  - [ ] Build configuration
  - [ ] Hot reload setup
  - [ ] Port forwarding (3000)
  - [ ] Environment variables
- [ ] **Hot Reload Configuration**:
  - [ ] Watch file changes
  - [ ] Restart services on change
  - [ ] Exclude node_modules
- [ ] **Port Forwarding**:
  - [ ] API: 8080
  - [ ] Dashboard: 3000
  - [ ] Redis: 6379
  - [ ] Turso: (if needed)

### Local Development

- [ ] **Service Dependencies**:
  - [ ] Define service order
  - [ ] Wait for dependencies
  - [ ] Health checks
- [ ] **Environment Variable Injection**:
  - [ ] Load from .env files
  - [ ] Override for local dev
  - [ ] Secure secret handling
- [ ] **Log Aggregation**:
  - [ ] Aggregate logs from all services
  - [ ] Color-coded by service
  - [ ] Filter and search

---

## 10.3 Kubernetes (Optional, `infra/k8s`)

### Deployment Manifests

- [ ] **API Deployment**:
  - [ ] Deployment spec
  - [ ] Replica count
  - [ ] Resource requests/limits
  - [ ] Health checks
- [ ] **Worker Deployment**:
  - [ ] Deployment spec
  - [ ] Replica count (scalable)
  - [ ] Resource requests/limits
  - [ ] Docker socket access
- [ ] **Dashboard Deployment**:
  - [ ] Deployment spec
  - [ ] Static asset serving
  - [ ] Resource requests/limits

### Service Definitions

- [ ] **API Service**:
  - [ ] ClusterIP service
  - [ ] Port mapping
  - [ ] Selector labels
- [ ] **Worker Service**:
  - [ ] Headless service (if needed)
  - [ ] Internal communication
- [ ] **Dashboard Service**:
  - [ ] ClusterIP service
  - [ ] Port mapping

### ConfigMaps and Secrets

- [ ] **ConfigMaps**:
  - [ ] Application configuration
  - [ ] Non-sensitive settings
- [ ] **Secrets**:
  - [ ] API keys
  - [ ] Database credentials
  - [ ] LLM provider keys
  - [ ] Use Kubernetes secrets or external secret manager

### Horizontal Pod Autoscaling

- [ ] **API HPA**:
  - [ ] CPU-based scaling
  - [ ] Request rate scaling
  - [ ] Min/max replicas
- [ ] **Worker HPA**:
  - [ ] Queue depth scaling
  - [ ] CPU-based scaling
  - [ ] Min/max replicas

### Ingress Configuration

- [ ] **API Ingress**:
  - [ ] Route /v1/* to API service
  - [ ] TLS configuration
  - [ ] Rate limiting
- [ ] **Dashboard Ingress**:
  - [ ] Route /* to dashboard service
  - [ ] TLS configuration
  - [ ] Authentication (via Clerk)

---

## Success Criteria

- [ ] Docker images build correctly
- [ ] Docker Compose starts all services
- [ ] Tilt provides hot reload
- [ ] Services communicate correctly
- [ ] Kubernetes manifests work (if implemented)
- [ ] Health checks work
- [ ] Logging is configured
- [ ] Secrets are handled securely

---

## Notes

- Keep Docker images minimal
- Use multi-stage builds for production
- Test Docker Compose locally
- Document all environment variables
- Keep Kubernetes configs simple initially
- Use external secret management in production
- Set up monitoring and alerting

