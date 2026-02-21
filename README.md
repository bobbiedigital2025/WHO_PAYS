# WHO_PAYS — Household Income & Expense Tracker 💖

A detailed money tracker for households living on disability/social security, savings, and shared expenses.

## What this app does
- Track multiple people in one home (Mom, Boyfriend, etc.)
- Track **every income source** (SSA, disability, savings transfer)
- Track **every expense** (utilities, laundromat, groceries, nails, medical, rent)
- Show totals, net amount, and spending rollups by person/category/business
- Save data locally in browser + export/import backups

## UI/UX and usability
- Pink and yellow “girly” theme
- Cancer-awareness ribbon panel in header (including breast cancer ribbon 🎀)
- Quick navigation links for each app section
- Accessible skip-link and responsive layout
- Link/dropdown verification checklist: `LINK_DROPDOWN_CHECKLIST.md`

## Security hardening included
- Static app served by Node/Express with `helmet` security headers
- CSP, HSTS, frame protections, form-action and base-uri restrictions
- Input validation and output escaping in front-end app
- Basic rate-limiting middleware on server
- Non-root Docker user

## Performance and production-readiness
- Event delegation for delete actions in transaction table
- `Intl.NumberFormat` currency rendering
- PWA support via `manifest.webmanifest` + `sw.js` (offline caching of static assets)
- Containerized deployment and health-check monitoring

## Full DevOps package included
- `Dockerfile` for containerized deployment
- `docker-compose.yml` with:
  - app service
  - monitor service for health checks
- Health endpoint: `/health`
- Health alert monitor sends failure email to:
  - `admin@bodigicom.com` (default recipient)
- GitHub Actions CI workflow:
  - install deps
  - JS syntax checks
  - Docker build validation

## Local development
```bash
npm install
npm run start
```
Open: `http://localhost:4173`

## Run with Docker Compose (recommended)
1. Configure SMTP env vars for health alert emails:
```bash
export SMTP_HOST="smtp.yourprovider.com"
export SMTP_PORT="587"
export SMTP_USER="your-user"
export SMTP_PASS="your-pass"
export ALERT_FROM="alerts@yourdomain.com"
```

2. Start app + monitor:
```bash
docker compose up --build -d
```

3. Open app:
`http://localhost:4173`

4. Health check URL:
`http://localhost:4173/health`

## Deploy and add custom domain
Use any Docker-capable host (DigitalOcean, Linode, AWS EC2, etc.):
1. Copy project to server.
2. Set SMTP environment variables.
3. Start with `docker compose up -d --build`.
4. Put Nginx/Caddy in front for TLS and domain routing.
5. Point your DNS `A` record to your server IP.
6. Issue HTTPS cert (Let’s Encrypt).

## Marketplace-ready free distribution options
You can publish this app as a free offering on multiple marketplaces/platforms:
- **GitHub**: public repo with Releases and README setup guide
- **Docker Hub**: free public container image
- **Render / Fly.io / Railway**: free tier deployments for demos
- **Netlify/Vercel** (static-only mode): host front-end for free (without server monitor)

## Backup routine suggestion
- Export JSON weekly and store a copy in cloud storage.
- At month-end, export CSV for reporting/review.


## MCP fetch and discovery (BODIGI MCP server)
This app now includes an **MCP Discovery & Fetch** panel in the UI. Configure these env vars:

```bash
export BODIGI_MCP_SERVER="https://your-bodigi-mcp-server.example.com"
export BODIGI_MCP_API_KEY="your-mcp-api-key"
```

Server endpoints exposed by this app:
- `GET /api/mcp/discover` → proxies to `${BODIGI_MCP_SERVER}/discover`
- `POST /api/mcp/fetch` with `{ "uri": "..." }` → proxies to `${BODIGI_MCP_SERVER}/fetch`

This keeps API keys server-side and avoids exposing them in browser code.
