# CapitalForge — Deployment Guide

> **Version:** 1.0 · **Last updated:** 2026-05-24

---

## How AI Agents Should Use This Document

- Follow deployment steps for production changes involving schema migrations.
- Never deploy with unapplied migrations or auth bypass enabled.
- Update this doc if deployment targets or env vars change.

---

## Deployment Architecture

```mermaid
flowchart LR
    Dev[Developer] -->|git push main| GitHub[GitHub Repo]
    GitHub -->|auto deploy| Vercel[Vercel\nFrontend]
    GitHub -->|auto deploy| Render[Render\nBackend]
    Render --> Supabase[(Supabase\nPostgreSQL)]
    Render --> Yahoo[Yahoo Finance]
    User[Browser] --> Vercel
    Vercel -->|API calls| Render
```

| Component | Platform | URL Pattern |
|-----------|----------|-------------|
| Frontend | Vercel | `https://capitalforge.vercel.app` (or custom domain) |
| Backend | Render | `https://capitalforge.onrender.com` |
| Database | Supabase | `*.supabase.co` |
| Health check | Render probe | `GET /api/health` |

---

## Environment Matrix

| Variable | Local | Production Backend | Production Frontend |
|----------|-------|-------------------|---------------------|
| `DATABASE_URL` | Local/Supabase | Supabase pooled | — |
| `DIRECT_URL` | Local/Supabase | Supabase direct | — |
| `JWT_SECRET` | dev secret | Strong random secret | — |
| `NODE_ENV` | development | production | production |
| `PORT` | 3001 | Render assigned | — |
| `CORS_ORIGINS` | localhost:3000 | Vercel domain | — |
| `NEXT_PUBLIC_API_URL` | localhost:3001/api | Render URL/api | Set in Vercel |

---

## Backend Deployment (Render)

### Initial setup

1. Create Render Web Service connected to GitHub repo
2. **Root directory:** `backend`
3. **Build command:** `npm install && npm run build`
4. **Start command:** `npm run start:prod`
5. **Health check path:** `/api/health`

### Environment variables (Render dashboard)

```
DATABASE_URL=<supabase-pooled-url>
DIRECT_URL=<supabase-direct-url>
JWT_SECRET=<strong-random-secret>
JWT_EXPIRATION=7d
NODE_ENV=production
CORS_ORIGINS=https://your-frontend.vercel.app
```

### Database migrations (production)

Run after schema changes:

```bash
# From local machine with production DIRECT_URL
cd backend
DATABASE_URL="<direct-url>" npx prisma migrate deploy
```

Or add to Render build command (if DIRECT_URL available):

```bash
npm install && npx prisma migrate deploy && npm run build
```

### Seed (production — one time only)

```bash
DATABASE_URL="<direct-url>" npx prisma db seed
```

> Do not re-seed production — it may overwrite data.

---

## Frontend Deployment (Vercel)

### Initial setup

1. Import GitHub repo to Vercel
2. **Root directory:** `frontend`
3. **Framework preset:** Next.js
4. **Build command:** `npm run build` (default)

### Environment variables (Vercel dashboard)

```
NEXT_PUBLIC_API_URL=https://capitalforge.onrender.com/api
```

### Post-deploy verification

```
□ Homepage loads
□ Login works
□ API calls reach Render (check Network tab)
□ No CORS errors
□ PWA manifest loads
```

---

## Database Deployment (Supabase)

### Setup

1. Create project at [supabase.com](https://supabase.com)
2. Copy connection strings from Settings → Database
3. Use **Transaction pooler** (port 6543) for `DATABASE_URL`
4. Use **Direct connection** (port 5432) for `DIRECT_URL`

### Connection string format

```
# Pooled (runtime)
postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true

# Direct (migrations)
postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
```

---

## Release Deployment Checklist

```markdown
## Pre-deploy
- [ ] All tests pass locally
- [ ] Frontend builds (`npm run build`)
- [ ] Backend builds (`npm run build`)
- [ ] RELEASE_NOTES.md updated
- [ ] No AuthBypassMiddleware in production build
- [ ] Secrets not in code

## Deploy
- [ ] Merge PR to main
- [ ] Tag release: git tag vX.Y.Z
- [ ] Verify Render deploy succeeded
- [ ] Verify Vercel deploy succeeded
- [ ] Run prisma migrate deploy (if schema changed)

## Post-deploy
- [ ] GET /api/health returns 200
- [ ] Login + dashboard load
- [ ] Strategy generate works
- [ ] Market sync works
- [ ] Check Render logs for errors
```

---

## Rollback Procedure

### Frontend (Vercel)

1. Vercel Dashboard → Deployments → select previous deployment → Promote to Production

### Backend (Render)

1. Render Dashboard → Manual Deploy → select previous commit
2. Or: `git revert` + push to main

### Database

- **Schema rollback:** Create a new forward migration that reverses changes — never delete applied migrations
- **Data rollback:** Restore from Supabase backup (Settings → Database → Backups)

---

## Monitoring

| Check | Method | Frequency |
|-------|--------|-----------|
| API health | `GET /api/health` | Render auto (30s) |
| Error logs | Render dashboard → Logs | On incident |
| DB connections | Supabase dashboard | Weekly |
| Cold starts | Render free tier spins down | Expected; first request slow |

---

## Security Checklist (Production)

```
□ JWT_SECRET is strong and unique
□ AuthBypassMiddleware removed/disabled
□ CORS_ORIGINS restricted to frontend domain
□ DATABASE_URL not exposed to frontend
□ HTTPS enforced (platform default)
□ Demo credentials changed or disabled
```

---

## Related Documents

- [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) — Local setup
- [RELEASE_NOTES.md](./RELEASE_NOTES.md) — Version history
- [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) — G-16 auth bypass
