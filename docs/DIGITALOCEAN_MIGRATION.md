# DigitalOcean Migration Guide — Render → DO

> Generated 2026-04-08. Fresh DB backup verified: `backups/aivis-backup-2026-04-08T15-54-59.sql` (27.4 MB, 102 tables, 52 users, 404 audits).

---

## 1. What You're Moving

| Component | Current Host | Migration Path |
|-----------|-------------|----------------|
| **Backend API** (Express + Puppeteer) | Render Web Service (`aivis`, Ohio) | DO Droplet or DO App Platform |
| **Frontend** (Vite static) | Render Static Site (`aivis-web`) | DO Spaces + CDN, or nginx on same Droplet |
| **Database** | Neon Postgres (external) | Keep on Neon **or** move to DO Managed Postgres |
| **DNS** | aivis.biz → Render | Update A/CNAME to DO IPs |
| **CI/CD** | GitHub Actions → Render deploy hooks | GitHub Actions → SSH/rsync to DO (or DO App auto-deploy) |

---

## 2. Pre-Migration Checklist

- [x] Fresh database backup (`backups/aivis-backup-2026-04-08T15-54-59.sql`)
- [x] Full env var reference documented (`server/.env.example` — 60+ vars)
- [x] Render-specific code identified (see §6)
- [ ] Export all live env values from Render dashboard (both services)
- [ ] Export Render dashboard domain/SSL config
- [ ] Set up DO account + project
- [ ] Decide: Droplet (full control) vs App Platform (managed PaaS)
- [ ] Decide: Keep Neon DB or migrate to DO Managed Postgres

---

## 3. Recommended DO Architecture

### Option A: Single Droplet (cheapest, full control)
```
Droplet (Ubuntu 24.04, 2 GB RAM minimum for Puppeteer)
├─ nginx (reverse proxy + static files)
│   ├─ aivis.biz → serve client/dist/ (static)
│   └─ api.aivis.biz → proxy_pass http://127.0.0.1:3001
├─ Node.js 22 (Express server on :3001)
├─ Chrome/Chromium (for Puppeteer scraping)
├─ PM2 or systemd (process manager)
└─ Let's Encrypt (certbot for SSL)
```

### Option B: DO App Platform (managed, like Render)
```
App Platform
├─ Web Service: server/ (Node.js component, auto-deploy from GitHub)
├─ Static Site: client/ (auto-deploy, built-in CDN)
└─ Managed Postgres (optional, replaces Neon)
```

---

## 4. Environment Variables to Transfer

Export ALL of these from Render dashboard. The full reference is in `server/.env.example`.

### Critical (server won't start without these)
```
DATABASE_URL          # Postgres connection string (Neon or new DO Postgres)
JWT_SECRET            # Auth tokens break if this changes
FRONTEND_URL          # CORS + email links + Stripe redirects
OPEN_ROUTER_API_KEY   # AI provider auth (or OPENROUTER_API_KEY)
```

### Payments (Stripe)
```
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET          # Must re-create webhook endpoint in Stripe for new URL
STRIPE_ALIGNMENT_MONTHLY_PRICE_ID
STRIPE_ALIGNMENT_YEARLY_PRICE_ID
STRIPE_SIGNAL_MONTHLY_PRICE_ID
STRIPE_SIGNAL_YEARLY_PRICE_ID
STRIPE_SCAN_PACK_*_PRICE_ID   # All scan pack price IDs
```

### Auth (OAuth)
```
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
GSC_GOOGLE_CLIENT_ID / GSC_GOOGLE_CLIENT_SECRET / GSC_OAUTH_CALLBACK_URL
```

### Email
```
RESEND_API_KEY
FROM_EMAIL
RESEND_WEBHOOK_SECRET
```

### Security / Encryption
```
APP_ENCRYPTION_KEY
PUBLIC_REPORT_SIGNING_SECRET
API_KEY_PEPPER
SESSION_SECRET
RECAPTCHA_SECRET_KEY
GSC_TOKEN_ENCRYPTION_KEY
GSC_OAUTH_STATE_SECRET
LICENSE_ENCRYPTION_SECRET
```

### Monitoring
```
SENTRY_DSN
ADMIN_KEY
```

### Client (.env)
```
VITE_API_URL=https://api.aivis.biz
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_SENTRY_DSN=...
```

---

## 5. Migration Steps

### Step 1: Provision DO Resources
1. Create Droplet: Ubuntu 24.04, **minimum 2 GB RAM** (Puppeteer needs headless Chrome)
2. SSH in, install: Node.js 22, nginx, certbot, Chrome/Chromium, PM2
3. Create deploy user + SSH key for GitHub Actions

### Step 2: Configure nginx
Create two server blocks matching `render.yaml` headers:

```nginx
# /etc/nginx/sites-available/aivis.biz
server {
    listen 443 ssl http2;
    server_name aivis.biz www.aivis.biz;

    ssl_certificate /etc/letsencrypt/live/aivis.biz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/aivis.biz/privkey.pem;

    root /var/www/aivis/client/dist;
    index index.html;

    # Security headers (from render.yaml)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
    add_header Cross-Origin-Opener-Policy "same-origin-allow-popups" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://api.aivis.biz https://www.google-analytics.com https://www.googletagmanager.com; frame-src 'self' https://www.google.com https://js.stripe.com; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests" always;

    # Cache: immutable hashed assets
    location /assets/ {
        expires max;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Cache: images/icons
    location ~* \.(png|webp|ico)$ {
        add_header Cache-Control "public, max-age=604800, stale-while-revalidate=86400";
    }

    # Cache: manifest
    location ~* \.webmanifest$ {
        add_header Cache-Control "public, max-age=3600";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}

# API reverse proxy
server {
    listen 443 ssl http2;
    server_name api.aivis.biz;

    ssl_certificate /etc/letsencrypt/live/api.aivis.biz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.aivis.biz/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;  # AI pipeline can take up to 57s
    }
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name aivis.biz www.aivis.biz api.aivis.biz;
    return 301 https://$host$request_uri;
}
```

### Step 3: Install Chrome for Puppeteer
```bash
# On the Droplet
apt-get update && apt-get install -y \
  chromium-browser fonts-liberation libasound2 libatk-bridge2.0-0 \
  libdrm2 libgbm1 libnss3 libxss1 libx11-xcb1

# Or install via Puppeteer
npx puppeteer browsers install chrome

# Set env var
export PUPPETEER_CACHE_DIR=/home/deploy/.cache/puppeteer
```

### Step 4: Deploy Code
```bash
# Clone repo on server
git clone git@github.com:YOUR_ORG/aivis.git /var/www/aivis
cd /var/www/aivis

# Install + build server
cd server && npm install --include=dev && npm run build

# Install + build client
cd ../client && npm install --include=dev && npm run build
```

### Step 5: Process Manager (PM2)
```bash
npm install -g pm2

# Start server
cd /var/www/aivis/server
pm2 start "node --import ./dist/server/src/instrument.js dist/server/src/server.js" \
  --name aivis-api \
  --env production

# Auto-restart on reboot
pm2 startup
pm2 save
```

### Step 6: Update DNS
```
A    aivis.biz        → <DO_DROPLET_IP>
A    api.aivis.biz    → <DO_DROPLET_IP>
A    www.aivis.biz    → <DO_DROPLET_IP>
```

### Step 7: SSL Certificates
```bash
certbot --nginx -d aivis.biz -d www.aivis.biz -d api.aivis.biz
```

### Step 8: Update External Services
- **Stripe**: Update webhook endpoint URL (api.aivis.biz stays same, but verify)
- **Google OAuth**: Verify redirect URIs still point to api.aivis.biz
- **GitHub OAuth**: Same
- **Resend**: Verify webhook URL
- **Google reCAPTCHA**: Verify domain list

### Step 9: Update CI/CD
Replace Render deploy hooks in `.github/workflows/ci.yml` (lines 203–213):

```yaml
  deploy:
    needs: [build, test-client, test-server, security]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to DigitalOcean
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DO_HOST }}
          username: deploy
          key: ${{ secrets.DO_SSH_KEY }}
          script: |
            cd /var/www/aivis
            git pull origin main
            cd server && npm install --include=dev && npm run build
            npx puppeteer browsers install chrome
            cd ../client && npm install --include=dev && npm run build
            pm2 restart aivis-api
```

New GitHub secrets needed:
- `DO_HOST` — Droplet IP or hostname
- `DO_SSH_KEY` — Private SSH key for deploy user

Remove old secrets:
- `RENDER_DEPLOY_HOOK_API`
- `RENDER_DEPLOY_HOOK_WEB`

---

## 6. Render-Specific Code to Update

These files contain Render-specific references (comments/config only — no functional changes needed for the app to run on DO):

| File | Line(s) | What | Action |
|------|---------|------|--------|
| `render.yaml` | all | Render service definition | Keep as reference; not used by DO |
| `.github/workflows/ci.yml` | 144 | Comment: "mirrors Render build commands" | Update comment |
| `.github/workflows/ci.yml` | 203–213 | Deploy hooks `curl` to Render | Replace with SSH deploy (see §5.9) |
| `api/audits/index.ts` | 2, 25 | Comments mentioning Render | Update comments |
| `client/.env.example` | 9 | "set this in Render dashboard" | Update comment |
| `server/.puppeteerrc.cjs` | 3–6 | Comment mentioning Render paths | Update comment (code is already portable via env var) |
| `render.yaml` | 14 | `PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer` | Set to DO path in server .env |

**Important**: The actual application code is fully portable. Only comments and CI/CD config reference Render.

---

## 7. Database Decision

### Option A: Keep Neon Postgres (recommended for now)
- No data migration needed
- Same `DATABASE_URL` works from DO
- Potential latency if Neon region ≠ DO region (check both are US-East)

### Option B: Migrate to DO Managed Postgres
1. Create DO Managed Postgres cluster
2. Restore from backup: `psql $NEW_DATABASE_URL < backups/aivis-backup-2026-04-08T15-54-59.sql`
3. Update `DATABASE_URL` in server env
4. App auto-runs migrations on startup (`server/src/services/postgresql.ts`)

---

## 8. Rollback Plan

1. DNS TTL: Set to 300s (5 min) before migration for fast rollback
2. Keep Render services running during DNS propagation (24–48 hr overlap)
3. If anything breaks: revert DNS to Render IPs
4. Database: if staying on Neon, both Render and DO can read from same DB simultaneously

---

## 9. Post-Migration Verification

- [ ] `https://aivis.biz` loads frontend correctly
- [ ] `https://api.aivis.biz/api/health` returns 200 + DB connected
- [ ] Sign in works (JWT + Google OAuth + GitHub OAuth)
- [ ] Run a test audit (POST /api/analyze)
- [ ] Stripe checkout flow works (test mode first)
- [ ] GSC OAuth connect works
- [ ] Email verification sends (Resend)
- [ ] SSL certificates valid for all domains
- [ ] Security headers present (check via securityheaders.com)
- [ ] PM2 auto-restarts on crash
- [ ] PM2 survives server reboot
- [ ] GitHub Actions deploy pipeline succeeds
- [ ] Old Render services can be shut down
