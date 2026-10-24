# Deployment & Operations Guide

_Brolf Tech Remote Internship Challenge 2026 · AI & Automation Track · PROJECT 3_

This document provides clear runnable setup and production deployment instructions for the **AI Clinic Front-Desk Assistant**.

---

## 1. Quick Runnable Setup Options

### Option A: Docker Compose (Zero Pre-Installed PostgreSQL Required)

The repository provides a complete containerized setup with PostgreSQL 16 and Next.js 16.

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd ai-clinic-assistant-project

# 2. Launch PostgreSQL and the Application
docker compose up --build -d

# 3. View status and logs
docker compose ps
docker compose logs -f app
```

- Web Application: [http://localhost:3000](http://localhost:3000)
- Database: `postgres://clinic_admin:clinic_password@localhost:5432/clinic_db`
- Self-Healing Auto-Boot: On container startup, `src/instrumentation.ts` automatically runs migrations and seeds synthetic demo data if tables are empty.

### Option B: Local Node.js Development

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# Edit DATABASE_URL in .env to point to your PostgreSQL instance

# 3. Push schema migrations & seed synthetic records
npx drizzle-kit push
npx tsx -r dotenv/config src/db/seed.ts

# 4. Start local development server
npm run dev
```

App runs on [http://localhost:3000](http://localhost:3000).

---

## 2. Environment Variables Checklist

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | `postgres://localhost:5432/clinic` | PostgreSQL connection string |
| `AI_PROVIDER` | No | `mock` | `mock` for deterministic testable runs, `openai-compatible` for live LLM |
| `AI_API_KEY` | If live | `""` | API key for OpenAI-compatible endpoint |
| `AI_BASE_URL` | If live | `https://api.openai.com/v1` | Base URL for LLM provider API |
| `AI_MODEL` | If live | `gpt-4o-mini` | LLM model identifier |
| `AI_TIMEOUT_MS` | No | `8000` | Timeout threshold for AI responses (fail-safe) |
| `AI_MAX_RETRIES` | No | `2` | Bounded retries for transient HTTP errors |
| `SEED_DEMO_PASSWORD`| No | `demo1234` | Default password for seeded synthetic demo accounts |

---

## 3. Production Cloud Deployment Options

### Vercel + Neon / Supabase PostgreSQL

1. Push your repository to GitHub.
2. In Vercel, import the repository as a Next.js project.
3. Provision a serverless PostgreSQL database (e.g., Neon or Supabase).
4. Configure environment variables in Vercel Project Settings:
   - `DATABASE_URL`: Your pooled PostgreSQL connection string.
   - `AI_PROVIDER`: `mock` (or `openai-compatible` with API keys).
5. Deploy. The Next.js application will build and deploy on Vercel's edge network.
6. The self-healing boot hook (`src/instrumentation.ts`) will automatically run Drizzle migrations and seed demo accounts on initial cold start.

### Render / Railway (Docker Deployment)

1. Connect your GitHub repository to Render or Railway.
2. Select **Docker** deployment mode using the included `Dockerfile`.
3. Attach a managed PostgreSQL database addon.
4. Set environment variable `DATABASE_URL` to the internal connection URL.
5. Set `PORT=3000`.

---

## 4. Health Checks & Verification

- **System Health Endpoint**:
  ```bash
  curl -s http://localhost:3000/api/health
  # Expected Response: {"ok":true}
  ```

- **Run Automated Test Suite (42 tests)**:
  ```bash
  npx vitest run
  ```

- **Run Safety Evaluation Suite (44 cases)**:
  ```bash
  npx tsx scripts/run-eval.ts
  ```

- **Typecheck & Production Build**:
  ```bash
  npm run typecheck
  npm run build
  ```
