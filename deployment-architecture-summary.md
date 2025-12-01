# SafeURL Deployment Architecture Summary

## Final Architecture (Vercel + Railway + Hetzner)

### Service Distribution

| Service       | Platform      | Why This Platform                 | Cost                |
| ------------- | ------------- | --------------------------------- | ------------------- |
| **Dashboard** | Vercel        | Optimized for Next.js, free tier  | Free - $20/month    |
| **API**       | Railway       | Easy deployment, good pricing     | ~$2-3/month         |
| **Redis**     | Railway Addon | Managed service, easy integration | ~$3/month           |
| **Worker**    | Hetzner VPS   | Docker socket access required     | ~€4/month           |
| **Database**  | Turso         | Cloud-hosted, works from anywhere | Free tier available |

**Total Monthly Cost:** ~$9-11/month (with Vercel free tier)

---

## Why This Architecture?

### ✅ Dashboard on Vercel

**Benefits:**

- Optimized for Next.js (zero-config deployment)
- Free tier: 100 GB bandwidth, unlimited requests
- Automatic SSL, CDN, edge functions
- Excellent developer experience
- Perfect for static/SSR Next.js apps

**Limitations:**

- Free tier has bandwidth limits (100 GB/month)
- Pro tier ($20/month) for team features

---

### ✅ API on Railway

**Benefits:**

- Easy deployment from Git
- Automatic HTTPS
- Environment variable management
- Good pricing for hobby projects
- Supports your ElysiaJS API

**Resource Limits:**

- 1 GB RAM, 1 vCPU (sufficient for API)
- Within Railway Hobby plan limits

---

### ✅ Redis on Railway Addon

**Benefits:**

- Managed Redis service
- Easy integration with Railway services
- Automatic backups
- No manual setup required

**Alternative:** Could use Upstash Redis (serverless) for similar cost

---

### ✅ Worker on Hetzner VPS

**Why VPS is Required:**

- Worker needs Docker socket access (`/var/run/docker.sock`)
- Spawns ephemeral fetcher containers dynamically
- Railway/Render/Vercel don't support Docker socket access

**Why Hetzner:**

- Best price-to-performance ratio (€3.92/month)
- 2 vCPU, 4 GB RAM (meets worker requirements: 2 vCPU, 2 GB RAM)
- European data centers (GDPR compliance)
- Full root access for Docker setup

**Setup Options:**

1. **CapRover** (recommended): PaaS-like experience on VPS
2. **Docker Compose**: Direct Docker management

---

## Network Architecture

```
┌─────────────┐
│   Vercel    │  Dashboard (Next.js)
│  (Frontend) │
└──────┬──────┘
       │ HTTPS
       │
┌──────▼──────┐
│   Railway   │  API Service (ElysiaJS)
│   (Backend) │
└──────┬──────┘
       │
       ├──► Redis (Railway Addon)
       │
       ├──► Turso Database (Cloud)
       │
       └──► Worker (Hetzner VPS)
              │
              └──► Spawns Fetcher Containers (Docker)
```

---

## Cost Breakdown

### Option 1: Free Tier (Recommended for Start)

| Service   | Cost             |
| --------- | ---------------- |
| Vercel    | Free             |
| Railway   | $5-7/month       |
| Hetzner   | €4/month         |
| **Total** | **~$9-11/month** |

### Option 2: Pro Tier (For Production)

| Service    | Cost              |
| ---------- | ----------------- |
| Vercel Pro | $20/month         |
| Railway    | $5-7/month        |
| Hetzner    | €4/month          |
| **Total**  | **~$29-31/month** |

---

## Deployment Checklist

### 1. Dashboard (Vercel)

- [ ] Connect GitHub repository
- [ ] Configure environment variables (API URL, Clerk keys)
- [ ] Set up custom domain (optional)
- [ ] Verify API connectivity

### 2. API (Railway)

- [ ] Create new Railway project
- [ ] Connect GitHub repository
- [ ] Configure environment variables:
  - `TURSO_CONNECTION_URL`
  - `TURSO_AUTH_TOKEN`
  - `REDIS_HOST` (Railway Redis addon)
  - `REDIS_PASSWORD`
  - `CLERK_SECRET_KEY`
  - `CLERK_PUBLISHABLE_KEY`
- [ ] Deploy and verify health endpoint

### 3. Redis (Railway Addon)

- [ ] Add Redis addon to Railway project
- [ ] Note connection details
- [ ] Update API environment variables

### 4. Worker (Hetzner VPS)

- [ ] Create Hetzner Cloud account
- [ ] Deploy CX22 instance (2 vCPU, 4 GB RAM)
- [ ] Install Docker
- [ ] Install CapRover (or use Docker Compose)
- [ ] Deploy worker service
- [ ] Configure environment variables:
  - `REDIS_HOST` (Railway Redis)
  - `REDIS_PASSWORD`
  - `TURSO_CONNECTION_URL`
  - `TURSO_AUTH_TOKEN`
  - `OPENROUTER_API_KEY`
  - `DOCKER_SOCKET_PATH=/var/run/docker.sock`
  - `FETCHER_IMAGE=safeurl-fetcher:latest`
- [ ] Verify container spawning works

### 5. Database (Turso)

- [ ] Create Turso database
- [ ] Run migrations
- [ ] Configure replication (if needed)
- [ ] Set up backups

---

## Environment Variables Reference

### Dashboard (Vercel)

```env
NEXT_PUBLIC_API_URL=https://your-api.railway.app
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
```

### API (Railway)

```env
PORT=8080
TURSO_CONNECTION_URL=libsql://...
TURSO_AUTH_TOKEN=...
REDIS_HOST=redis.railway.internal
REDIS_PORT=6379
REDIS_PASSWORD=...
CLERK_SECRET_KEY=sk_...
CLERK_PUBLISHABLE_KEY=pk_...
CORS_ORIGIN=https://your-dashboard.vercel.app
```

### Worker (Hetzner VPS)

```env
REDIS_HOST=redis.railway.internal  # Or external Redis URL
REDIS_PORT=6379
REDIS_PASSWORD=...
TURSO_CONNECTION_URL=libsql://...
TURSO_AUTH_TOKEN=...
OPENROUTER_API_KEY=...
DOCKER_SOCKET_PATH=/var/run/docker.sock
FETCHER_IMAGE=safeurl-fetcher:latest
WORKER_CONCURRENCY=5
CONTAINER_TIMEOUT_MS=30000
CONTAINER_MEMORY_LIMIT_MB=512
CONTAINER_CPU_LIMIT=0.5
```

---

## Security Considerations

### Vercel

- Automatic HTTPS
- DDoS protection
- Environment variables encrypted
- No server management needed

### Railway

- Automatic HTTPS
- Private networking between services
- Environment variables encrypted
- Redis addon uses private network

### Hetzner VPS

- Configure firewall (UFW)
- Use SSH keys (disable password auth)
- Keep system updated
- Secure Docker socket (if exposing)
- Regular backups

---

## Monitoring & Alerts

### Recommended Tools

1. **Vercel Analytics** (built-in)
   - Page views, performance metrics
   - Free tier available

2. **Railway Metrics** (built-in)
   - CPU, memory usage
   - Request metrics

3. **Hetzner Monitoring** (optional)
   - Server metrics
   - Uptime monitoring

4. **External Monitoring**
   - UptimeRobot (free tier)
   - Better Uptime
   - Custom health checks

---

## Scaling Considerations

### When to Scale

**Vercel:**

- Free tier: 100 GB bandwidth/month
- Upgrade to Pro if exceeding bandwidth
- Consider Vercel Enterprise for high traffic

**Railway:**

- Monitor API resource usage
- Upgrade plan if CPU/memory limits hit
- Consider horizontal scaling (multiple API instances)

**Hetzner:**

- Monitor worker resource usage
- Upgrade to larger VPS if needed
- Consider multiple worker instances for high concurrency

**Redis:**

- Railway addon scales automatically
- Consider Upstash for serverless Redis if needed

---

## Backup Strategy

1. **Database (Turso)**
   - Configure automatic backups
   - Regular snapshot exports

2. **Redis**
   - Railway addon includes backups
   - Export data periodically if needed

3. **VPS (Worker)**
   - Regular server snapshots (Hetzner)
   - Backup Docker images
   - Document configuration

---

## Troubleshooting

### Dashboard Issues

- Check Vercel deployment logs
- Verify API URL is correct
- Check environment variables

### API Issues

- Check Railway deployment logs
- Verify database connectivity
- Check Redis connectivity
- Monitor resource usage

### Worker Issues

- Check VPS logs (CapRover or Docker)
- Verify Docker socket access
- Check Redis connectivity
- Verify container spawning works
- Monitor resource usage

---

## Next Steps

1. **Set up Vercel deployment** for dashboard
2. **Set up Railway deployment** for API
3. **Add Railway Redis addon**
4. **Set up Hetzner VPS** with CapRover
5. **Deploy worker service** on VPS
6. **Test end-to-end** functionality
7. **Set up monitoring** and alerts
8. **Configure backups**

---

## Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [Hetzner Cloud](https://www.hetzner.com/cloud)
- [CapRover Documentation](https://caprover.com/docs/get-started.html)
- [Turso Documentation](https://docs.turso.tech)
