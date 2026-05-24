# CapitalForge — Development Guide

> **Version:** 1.0 · **Last updated:** 2026-05-24

---

## How AI Agents Should Use This Document

- Follow setup steps exactly before running commands.
- Use the build/test commands listed here — do not invent alternatives.
- Reference env vars from this doc; never commit secrets.
- Follow branch and PR conventions for all changes.

---

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 18+ | `node -v` |
| npm | 9+ | `npm -v` |
| Git | 2.x | `git --version` |
| PostgreSQL | 14+ (or Supabase account) | — |

**Optional:** Place `Stocks Strategy.xlsx` in repo root for seed import.

---

## Local Setup

### 1. Clone and install

```bash
git clone <repository-url>
cd CapitalForge

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Backend environment

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
# Supabase (recommended)
DATABASE_URL="postgresql://postgres.[ref]:[password]@...pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@...pooler.supabase.com:5432/postgres"

# Or local PostgreSQL
# DATABASE_URL="postgresql://user:password@localhost:5432/capitalforge?schema=public"
# DIRECT_URL="postgresql://user:password@localhost:5432/capitalforge?schema=public"

JWT_SECRET="dev-secret-change-in-production"
JWT_EXPIRATION="7d"
PORT=3001
NODE_ENV=development
CORS_ORIGINS="http://localhost:3000"
```

> **Note:** Bucket ratios are per-portfolio in DB (defaults 0.60/0.30/0.10), not env vars.

### 3. Database setup

```bash
cd backend
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

### 4. Frontend environment

```bash
cd frontend
cp .env.example .env.local
```

Edit `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### 5. Start development servers

**Terminal 1 — Backend:**
```bash
cd backend
npm run start:dev
# → http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# → http://localhost:3000
```

### Demo credentials

After seeding:
- **Email:** `demo@capitalforge.com`
- **Password:** `password123`

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | Pooled PostgreSQL connection |
| `DIRECT_URL` | Yes | — | Direct connection for migrations |
| `JWT_SECRET` | Yes | — | JWT signing key |
| `JWT_EXPIRATION` | No | `7d` | Token TTL |
| `PORT` | No | `3001` | Server port |
| `NODE_ENV` | No | `development` | Environment |
| `CORS_ORIGINS` | No | localhost:3000 | Comma-separated allowed origins |
| `YAHOO_RETRY_ATTEMPTS` | No | `3` | Market data retry count |
| `YAHOO_RETRY_DELAY` | No | `1000` | Retry delay ms |

### Frontend (`frontend/.env.local`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | — | Backend API base URL |
| `NEXT_PUBLIC_SUPABASE_URL` | No | — | Supabase project URL (future) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | — | Supabase anon key (future) |

---

## Build Commands

### Backend

| Command | Purpose |
|---------|---------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start:prod` | Run compiled production build |
| `npm run start:dev` | Watch mode development |
| `npm run lint` | ESLint with auto-fix |
| `npm run format` | Prettier format |

### Frontend

| Command | Purpose |
|---------|---------|
| `npm run build` | Production Next.js build |
| `npm run start` | Serve production build |
| `npm run dev` | Development server |
| `npm run lint` | ESLint |

### Database

| Command | Purpose |
|---------|---------|
| `npx prisma generate` | Regenerate Prisma client |
| `npx prisma migrate dev --name <name>` | Create + apply migration |
| `npx prisma migrate deploy` | Apply migrations (production) |
| `npx prisma db seed` | Run seed script |
| `npx prisma studio` | Visual DB browser |
| `npx prisma migrate reset` | Reset DB (destructive) |

---

## Test Commands

### Backend

```bash
cd backend

# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov

# E2E
npm run test:e2e
```

### Frontend

```bash
cd frontend
npm run lint   # Primary quality gate (no test suite yet)
npm run build  # Catches TypeScript/build errors
```

### Manual verification checklist

After changes, verify:

```
□ Backend starts without errors (npm run start:dev)
□ Frontend builds (npm run build)
□ Login works with demo credentials
□ Strategy page loads for seeded portfolio
□ Market sync returns prices
□ No unrelated modules modified
```

---

## Debugging Steps

### Backend not starting

1. Check `DATABASE_URL` connectivity: `npx prisma db pull`
2. Verify migrations applied: `npx prisma migrate status`
3. Check port 3001 not in use

### Frontend API errors

1. Verify `NEXT_PUBLIC_API_URL` matches backend port
2. Check browser Network tab for 401/CORS errors
3. Confirm JWT token in localStorage (Application tab)

### Strategy amounts wrong

1. Compare against PRD derivation chain (§3.1)
2. Check Portfolio `totalCapital`, ratios, `dcaWeeksPerYear`
3. Verify StrategyRule has multipliers not quantities
4. Run `recalculateBuckets` via allocation API

### Market data sync fails

1. Check Yahoo Finance connectivity
2. Review backend logs for retry attempts
3. Verify symbol format (e.g., `NVDA`, not `NVDA.US`)

### Database issues

```bash
npx prisma studio          # Inspect data
npx prisma migrate reset   # Nuclear option (dev only)
node dist/prisma/verify-data.js  # If available
```

See also: [debugging-skill.md](../skills/debugging-skill.md)

---

## PR Workflow

### Branch naming

```
feature/F-001-multiplier-strategy
fix/F-007-bucket-decrement
docs/update-api-contracts
chore/upgrade-nestjs
```

Format: `<type>/<ticket-or-feature-id>-<short-description>`

### Commit naming

Follow conventional commits:

```
feat(strategy): use multiplier-based buy amounts
fix(transaction): reverse bucket usage on delete
docs(pos): add feature backlog entry for F-004
refactor(allocation): extract recalculateBuckets helper
test(strategy): add Excel parity unit tests
```

### PR checklist

```
□ Branch from latest main
□ Focused diff — one feature/fix per PR
□ FEATURE_BACKLOG.md updated
□ TIME_LOG.md entry added
□ DECISION_LOG.md updated (if architectural)
□ No secrets committed
□ Backend builds + starts
□ Frontend builds
□ Manual test steps documented in PR description
```

### PR description template

```markdown
## Summary
[1-2 sentences on what and why]

## Feature
F-0XX — [Feature name]

## Test plan
- [ ] [Specific verification step]
- [ ] [Another step]

## Screenshots
[If UI change]
```

---

## Release Workflow

See [RELEASE_NOTES.md](./RELEASE_NOTES.md) and [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).

Quick release steps:

1. Merge all PRs to `main`
2. Update `RELEASE_NOTES.md` with version entry
3. Tag: `git tag v1.x.x && git push origin v1.x.x`
4. Deploy backend (Render auto-deploy from main)
5. Deploy frontend (Vercel auto-deploy from main)
6. Run `npx prisma migrate deploy` on production if schema changed
7. Verify health check: `GET /api/health`

---

## Branch Naming Conventions

| Prefix | Use |
|--------|-----|
| `feature/` | New functionality |
| `fix/` | Bug fixes |
| `docs/` | Documentation only |
| `refactor/` | Code restructuring, no behavior change |
| `chore/` | Tooling, deps, CI |
| `test/` | Test additions |

---

## Related Documents

- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) — Production deployment
- [API_CONTRACTS.md](./API_CONTRACTS.md) — API reference
- [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) — Business context
- [git-workflow.mdc](../.cursor/rules/git-workflow.mdc) — Git rules
