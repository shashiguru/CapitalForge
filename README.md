# CapitalForge - Portfolio Capital Deployment System

A production-ready rule-based capital allocation and dip-buy strategy engine inspired by institutional portfolio management.

## Architecture

```
CapitalForge/
├── backend/          # NestJS API server
│   ├── src/
│   │   ├── auth/           # JWT authentication
│   │   ├── portfolio/      # Portfolio CRUD
│   │   ├── allocation/     # Bucket-based allocation
│   │   ├── market-data/    # Yahoo Finance integration
│   │   ├── strategy/       # Core strategy engine
│   │   ├── budget/         # Weekly budget management
│   │   ├── transaction/    # Transaction ledger
│   │   └── analytics/      # Portfolio analytics
│   └── prisma/       # Database schema & migrations
└── frontend/         # Next.js App Router
    ├── src/
    │   ├── app/           # Pages (Dashboard, Allocation, Strategy, etc.)
    │   ├── components/    # UI components (shadcn/ui)
    │   ├── contexts/      # Auth & Portfolio state
    │   └── lib/           # API client & utilities
```

## Tech Stack

### Backend
- **Framework**: NestJS (TypeScript)
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Authentication**: JWT + Passport.js
- **Market Data**: yahoo-finance2

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Styling**: TailwindCSS
- **Components**: shadcn/ui
- **Charts**: Recharts
- **State**: React Context

## Prerequisites

- Node.js 18+
- **Database**: Choose one:
  - **Supabase** (Recommended - Free tier available) - [Setup Guide](./SUPABASE_SETUP.md)
  - PostgreSQL 14+ (Local installation)
- npm or yarn
- **Optional**: Excel file (`Stocks Strategy.xlsx`) for importing your real portfolio data

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd CapitalForge
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials
```

**Choose Your Database:**

#### Option A: Supabase (Recommended)
Follow the detailed [Supabase Setup Guide](./SUPABASE_SETUP.md) for step-by-step instructions.

Quick setup:
1. Create a Supabase project at https://supabase.com
2. Get your connection strings from Settings → Database
3. Update `.env` with your Supabase credentials:
   ```env
   DATABASE_URL="postgresql://postgres.[ref]:[password]@...pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.[ref]:[password]@...pooler.supabase.com:5432/postgres"
   ```

#### Option B: Local PostgreSQL
```env
DATABASE_URL="postgresql://user:password@localhost:5432/capitalforge?schema=public"
DIRECT_URL="postgresql://user:password@localhost:5432/capitalforge?schema=public"
```

**Other Environment Variables:**
```env
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRATION="7d"
CORE_BUCKET_RATIO="0.6"
DIP_BUCKET_RATIO="0.3"
CRASH_BUCKET_RATIO="0.1"
```

### 3. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations (creates all tables)
npx prisma migrate dev --name init

# Seed data
npx prisma db seed
```

**📊 Import Your Real Portfolio Data:**

The seed script automatically imports from `Stocks Strategy.xlsx` if present in the project root. It will import:
- Stock allocations with target percentages
- Current positions (shares owned, avg cost)
- All historical transactions
- Bucket strategy configuration

If you don't have an Excel file, demo data will be created instead.

See [EXCEL_IMPORT_COMPLETE.md](./EXCEL_IMPORT_COMPLETE.md) for details on the import process.

### 4. Start Backend Server

```bash
npm run start:dev
```

Backend runs on `http://localhost:3001`

### 5. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install
```

**Environment Variables (frontend/.env.local)**:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### 6. Start Frontend Server

```bash
npm run dev
```

Frontend runs on `http://localhost:3000`

## Demo Credentials

After seeding the database:
- **Email**: demo@capitalforge.com
- **Password**: password123

## Core Features

### Bucket-Based Allocation
Capital is split into three buckets:
- **Core Bucket (60%)**: Normal DCA purchases
- **Dip Bucket (30%)**: Triggered at 15-30% dips
- **Crash Bucket (10%)**: Reserved for 30%+ crashes

### Dip Level Classification
| Dip % | Level | Bucket Used |
|-------|-------|-------------|
| 0-10% | Normal DCA | Core |
| 10-15% | Light Dip | Core |
| 15-20% | Moderate Dip | Core + Dip |
| 20-30% | Dip Bucket | Dip |
| 30%+ | Crash Bucket | Crash |

### Strategy Generation
1. Sync market data from Yahoo Finance
2. Calculate dip % from 52-week high
3. Classify dip levels
4. Generate buy plans ranked by dip %
5. Validate against weekly budget

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/profile` - Get current user

### Portfolio
- `GET /api/portfolios` - List portfolios
- `POST /api/portfolios` - Create portfolio
- `GET /api/portfolios/:id` - Get portfolio
- `PATCH /api/portfolios/:id` - Update portfolio
- `DELETE /api/portfolios/:id` - Delete portfolio

### Allocation
- `GET /api/portfolios/:id/allocations` - List allocations
- `POST /api/portfolios/:id/allocations` - Create allocation
- `PATCH /api/allocations/:id` - Update allocation
- `DELETE /api/allocations/:id` - Delete allocation

### Market Data
- `POST /api/market-data/sync` - Sync all portfolio symbols
- `GET /api/market-data/prices/:symbol` - Get price history

### Strategy
- `POST /api/portfolios/:id/strategy/generate` - Generate buy plans
- `GET /api/portfolios/:id/strategy/snapshots` - List snapshots
- `POST /api/buy-plans/:id/execute` - Execute buy plan

### Budget
- `GET /api/portfolios/:id/budgets` - List budgets
- `POST /api/portfolios/:id/budgets` - Create budget
- `PATCH /api/budgets/:id` - Update budget

### Transaction
- `GET /api/portfolios/:id/transactions` - List transactions
- `POST /api/portfolios/:id/transactions` - Create transaction
- `POST /api/portfolios/:id/transactions/import` - Import CSV

### Analytics
- `GET /api/portfolios/:id/analytics` - Get portfolio analytics
- `GET /api/portfolios/:id/analytics/performance` - Get performance data

## Development

### Running Tests
```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

### Database Commands
```bash
# View database in browser
npx prisma studio

# Reset database
npx prisma migrate reset

# Create new migration
npx prisma migrate dev --name <migration-name>
```

## License

MIT
