# pg-admin-tool

PostgreSQL Integrated Management Tool - A monorepo for monitoring, managing, and administering PostgreSQL databases.

## Project Structure

```
japgadmin/
├── apps/
│   ├── api/          # NestJS backend API server
│   ├── web/          # Next.js frontend web UI
│   └── agent/        # PostgreSQL monitoring agent
├── packages/
│   ├── shared/       # Shared types and utilities
│   └── ui/           # Shared UI components
└── docker-compose.yml
```

## Tech Stack

- **API**: NestJS 10, Prisma ORM, PostgreSQL (pg driver)
- **Web**: Next.js 14, React 18, TailwindCSS, React Query, Chart.js
- **Agent**: TypeScript, pg driver, Axios
- **Database**: PostgreSQL 15, TimescaleDB (for metrics storage)
- **Testing**: Jest

## Development Commands

```bash
# Install dependencies (from root)
npm install

# Run services
npm run dev:api      # Start API server (NestJS --watch)
npm run dev:web      # Start web UI (Next.js dev)
npm run dev:agent    # Start monitoring agent

# Build
npm run build:api
npm run build:web
npm run build:agent

# Test & Lint
npm run test         # Run tests in all workspaces
npm run lint         # Lint all workspaces

# API-specific (run from apps/api)
npm run prisma:generate   # Generate Prisma client
npm run prisma:migrate    # Run database migrations
npm run prisma:studio     # Open Prisma Studio
```

## Database Setup

Start Docker containers for development databases:

```bash
docker-compose up -d
```

This creates:
- **target-db**: PostgreSQL 15 sample database (port 5434) with pg_stat_statements
- **metrics-db**: TimescaleDB for storing metrics (port 5433)

## Environment Variables

The API requires a `METRICS_DB_URL` environment variable for Prisma to connect to the metrics database.

## Key Modules

### API Modules (`apps/api/src/modules/`)
- **monitoring**: Database metrics collection and retrieval
- **alert**: Alert configuration and notification system
- **query**: Query history and analysis
- **vacuum**: Vacuum operations and history

### Prisma Schema (`apps/api/prisma/schema.prisma`)
- `Metric`: Time-series metrics data (activity, database, wait events, table sizes)
- `VacuumHistory`: Vacuum operation logs
- `QueryHistory`: Query execution history
- `AlertConfig`: Alert threshold configurations
- `AlertHistory`: Alert event logs

## Code Style

- TypeScript strict mode
- ESLint + Prettier for formatting
- NestJS conventions for backend (modules, controllers, services)
- Next.js App Router patterns for frontend

## UI/UX Guidelines

- **기본 언어**: 한국어 (Korean)
- 모든 UI 텍스트, 레이블, 메시지는 한국어로 작성
- 날짜/시간 형식: 한국 표준 (YYYY년 MM월 DD일, HH:mm:ss)
- 숫자 형식: 한국 표준 (천 단위 구분자 콤마 사용)
