# Railway.com Hobby Plan Deployment Assessment

## Executive Summary

**Status: ⚠️ NOT FULLY COMPATIBLE**

While most services can be deployed on Railway's Hobby plan, there is a **critical blocker** that prevents the current architecture from working without modifications.

---

## Current Infrastructure Requirements

### Services Breakdown

| Service       | RAM     | vCPU | Notes                                    |
| ------------- | ------- | ---- | ---------------------------------------- |
| **API**       | 1 GB    | 1.0  | ElysiaJS API server                      |
| **Worker**    | 2 GB    | 2.0  | ⚠️ **Requires Docker socket access**     |
| **Redis**     | 512 MB  | 0.5  | Queue management                         |
| **Fetcher**   | 512 MB  | 0.5  | Ephemeral containers (spawned by worker) |
| **Dashboard** | ~512 MB | 0.5  | Next.js app (not in docker-compose)      |

**Total Resources (if all running):** ~4.5 GB RAM, 4.5 vCPU

---

## Railway Hobby Plan Limits

✅ **Within Limits:**

- **Per Service:** Up to 8 GB RAM / 8 vCPU ✅
- **Total Resources:** All services fit within per-service limits ✅
- **Projects:** Up to 50 projects ✅
- **Services per Project:** Up to 50 services ✅
- **Volume Storage:** 5 GB (sufficient for Redis persistence) ✅
- **Ephemeral Disk:** 100 GB per service ✅

⚠️ **Pricing:**

- $5/month includes $5 of usage credits
- Pay-as-you-go after credits are exhausted
- Estimated monthly cost: **$10-20** (depending on usage)

---

## Critical Blocker: Docker Socket Access

### The Problem

Your **Worker service** requires direct access to the Docker socket (`/var/run/docker.sock`) to:

1. Spawn ephemeral `fetcher` containers dynamically
2. Execute isolated URL fetching and analysis
3. Clean up containers after execution

**Railway does NOT support Docker socket access** for security reasons. This is a fundamental limitation that prevents your current worker architecture from working.

### Current Worker Architecture

```typescript
// From apps/worker/src/container/manager.ts
// Worker spawns containers like this:
const container = await docker.createContainer({
  Image: "safeurl-fetcher:latest",
  // ... container config
});
```

This requires:

- Docker daemon access
- Ability to create/run/remove containers
- Network isolation for containers

---

## Solutions & Workarounds

### Option 1: Refactor Worker to Use Railway's Container API ⭐ **RECOMMENDED**

**Approach:** Instead of spawning containers via Docker socket, use Railway's service deployment model:

1. **Deploy Fetcher as a Separate Service** (but don't run it continuously)
2. **Use Railway's API** to trigger fetcher jobs
3. **Or:** Use Railway's "one-off" service runs (if supported)

**Pros:**

- Works within Railway's constraints
- Maintains isolation
- Uses Railway's native features

**Cons:**

- Requires significant refactoring
- May have slower startup times
- Less control over container lifecycle

**Effort:** Medium (2-3 days of refactoring)

---

### Option 2: Use Railway's Docker-in-Docker (if available)

**Approach:** Check if Railway supports Docker-in-Docker (DinD) or similar features.

**Status:** ❌ Railway does not support Docker-in-Docker for security reasons.

---

### Option 3: External Container Orchestration

**Approach:** Deploy worker on a different platform that supports Docker socket access (e.g., DigitalOcean, AWS ECS, Fly.io), while keeping other services on Railway.

**Pros:**

- Minimal changes to worker code
- Can use Railway for API/Dashboard
- Worker can still spawn containers

**Cons:**

- Split infrastructure (higher complexity)
- Additional costs
- Network latency between services

**Effort:** Low (just deployment config changes)

**Cost:** ~$5-10/month additional for worker service

---

### Option 4: Refactor to Serverless Functions

**Approach:** Convert fetcher to serverless functions (e.g., Railway's functions, or external like Cloudflare Workers, AWS Lambda).

**Pros:**

- No Docker socket needed
- Better scalability
- Pay-per-execution model

**Cons:**

- Major architectural change
- May have execution time limits
- Cold start latency

**Effort:** High (1-2 weeks)

---

## Recommended Deployment Strategy

### Hybrid Approach (Best Balance) ⭐ **UPDATED FOR VERCEL**

1. **Vercel** (Free - $20/month):
   - ✅ Dashboard service (Next.js) - optimized hosting
   - Free tier: 100 GB bandwidth, unlimited requests
   - Pro: $20/month for team features, more bandwidth

2. **Railway Hobby Plan** ($5-7/month):
   - ✅ API service (1 GB RAM, 1 vCPU)
   - ✅ Redis service (512 MB RAM, 0.5 vCPU) - or use Railway Redis addon (~$3/month)

3. **Alternative Platform for Worker** (~$4-5/month):
   - Deploy worker on **Hetzner + CapRover** (supports Docker socket)
   - Worker can spawn fetcher containers as needed
   - Connect to same Redis/Turso database

**Total Cost:** ~$9-11/month (with Vercel free tier) or ~$29-31/month (with Vercel Pro)

---

## Resource Usage Estimates

### Updated Architecture (Vercel + Railway + VPS)

| Service   | Platform      | RAM    | vCPU | Estimated Cost   |
| --------- | ------------- | ------ | ---- | ---------------- |
| Dashboard | Vercel        | N/A    | N/A  | Free - $20/month |
| API       | Railway       | 1 GB   | 1.0  | ~$2-3/month      |
| Redis     | Railway Addon | 512 MB | 0.5  | ~$3/month        |
| Worker    | Hetzner VPS   | 2 GB   | 2.0  | ~€4/month        |
| **Total** |               |        |      | **~$9-11/month** |

**Note:**

- Dashboard on Vercel (optimized for Next.js)
- Worker cannot run on Railway due to Docker socket requirement
- Worker runs on VPS with Docker socket access

---

## Alternative: Railway Pro Plan

If you want everything on Railway:

**Railway Pro Plan** ($20/month):

- Same resource limits per service
- Still no Docker socket support ❌
- Better support and features

**Verdict:** Pro plan doesn't solve the Docker socket issue.

---

## Database & External Services

✅ **Compatible:**

- **Turso Database:** Cloud-hosted, works from anywhere
- **Clerk Auth:** External service, no issues
- **OpenRouter API:** External service, no issues

---

## Next Steps

### Immediate Actions

1. **Decision Point:** Choose one of the solutions above
2. **If Option 1 (Refactor):**
   - Research Railway's service triggering API
   - Design new worker architecture
   - Refactor container manager
3. **If Option 3 (Hybrid):**
   - Set up worker on Fly.io or DigitalOcean
   - Keep API/Dashboard on Railway
   - Test connectivity

### Testing Checklist

- [ ] Verify Redis connectivity from Railway services
- [ ] Test Turso database connections
- [ ] Verify API → Worker communication
- [ ] Test dashboard → API communication
- [ ] Load test to estimate actual costs
- [ ] Monitor resource usage during peak times

---

## Conclusion

**Railway Hobby Plan is viable for:**

- ✅ API service
- ✅ Redis (or use Railway Redis addon)

**Vercel is ideal for:**

- ✅ Dashboard service (Next.js) - optimized hosting, free tier available

**Railway Hobby Plan is NOT viable for:**

- ❌ Worker service (requires Docker socket)
- ❌ Dashboard (better on Vercel for Next.js)

**Recommendation:** Use hybrid deployment:

- **Vercel** for Dashboard (Next.js optimized, free tier)
- **Railway** for API + Redis (easy deployment, $5-7/month)
- **Hetzner VPS** for Worker (Docker socket access, ~€4/month)

---

## Cost Summary

| Scenario                            | Monthly Cost | Notes                                                               |
| ----------------------------------- | ------------ | ------------------------------------------------------------------- |
| **Vercel Free + Railway + Hetzner** | $9-11        | Dashboard (Vercel free) + API/Redis (Railway) + Worker (Hetzner)    |
| **Vercel Pro + Railway + Hetzner**  | $29-31       | Dashboard (Vercel Pro) + API/Redis (Railway) + Worker (Hetzner)     |
| **Railway Only (Partial)**          | $5-7         | API + Redis (Worker excluded, Dashboard not recommended)            |
| **Railway Pro**                     | $20          | Still doesn't solve Docker socket issue, Dashboard better on Vercel |

**Best Value:** Hybrid approach with Vercel (free) + Railway + Hetzner at ~$9-11/month gives you full functionality with optimized hosting for each service.
