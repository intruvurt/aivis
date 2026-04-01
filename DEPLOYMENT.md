# 🚀 Production Deployment Guide

## Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] OpenRouter API key verified and working
- [ ] Sentry DSN configured (recommended)
- [ ] Tests passing (`npm test`)
- [ ] Build successful (`npm run build`)
- [ ] Security audit clean (`npm audit`)

## Deployment Options

### Option 1: Vercel (Recommended for Frontend)

#### Frontend Deployment

1. Install Vercel CLI:

```bash
npm i -g vercel
```

1. Configure `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://your-backend-url.com/api/$1"
    }
  ]
}
```

1. Deploy:

```bash
vercel --prod
```

1. Set environment variables in Vercel dashboard:

   - `VITE_API_URL` - Your backend API URL
   - `VITE_SENTRY_DSN` - Your Sentry DSN

#### Backend Deployment

Deploy to Vercel Serverless Functions or separate hosting.

**For Vercel Serverless:**

- Convert `server.ts` to serverless functions
- Place in `api/` directory
- Deploy with `vercel --prod`

### Option 2: Railway (Easy Full-Stack Deployment)

1. Install Railway CLI:

```bash
npm i -g @railway/cli
```

1. Initialize:

```bash
railway init
```

1. Add environment variables:

```bash
railway variables set OPEN_ROUTER_API_KEY=your_key_here
railway variables set PORT=3001
railway variables set NODE_ENV=production
```

1. Deploy:

```bash
railway up
```

### Option 3: Docker Deployment

#### Build Docker Images

**Backend Dockerfile:**

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY server.ts ./
COPY services ./services

EXPOSE 3001

CMD ["node", "server.ts"]
```

**Frontend Dockerfile:**

```dockerfile
FROM node:18-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  backend:
    build: .
    environment:
      - OPEN_ROUTER_API_KEY=${OPEN_ROUTER_API_KEY}
      - PORT=3001
      - NODE_ENV=production
    ports:
      - "3001:3001"
    restart: unless-stopped

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    environment:
      - VITE_API_URL=http://backend:3001
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped
```

Deploy:

```bash
docker-compose up -d
```

### Option 4: Traditional VPS (DigitalOcean, AWS EC2, etc.)

1. **SSH into your server:**

```bash
ssh user@your-server-ip
```

1. **Install Node.ts:**

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

1. **Install PM2:**

```bash
sudo npm install -g pm2
```

1. **Clone and setup:**

```bash
git clone <your-repo>
cd ai-visible-engine
npm install
```

1. **Configure environment:**

```bash
nano .env.local
# Add your environment variables
```

1. **Build frontend:**

```bash
npm run build
```

1. **Start with PM2:**

```bash
pm2 start server.ts --name ai-visibility-api
pm2 startup
pm2 save
```

1. **Setup Nginx reverse proxy:**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /path/to/ai-visible-engine/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass https://api.aivis.biz;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

1. **Enable and restart Nginx:**

```bash
sudo ln -s /etc/nginx/sites-available/ai-visibility /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

1. **Setup SSL with Let's Encrypt:**

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Post-Deployment

### 1. Verify Health Check

```bash
curl https://your-domain.com/health
```

### 2. Test Analysis Endpoint

```bash
curl -X POST https://your-domain.com/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

### 3. Monitor Logs

**PM2:**

```bash
pm2 logs ai-visibility-api
```

**Docker:**

```bash
docker-compose logs -f
```

**Railway:**

```bash
railway logs
```

### 4. Setup Monitoring

- Configure Sentry alerts
- Setup uptime monitoring (UptimeRobot, Pingdom)
- Enable analytics (Google Analytics, Plausible)

## Performance Optimization

### 1. Enable Redis Caching (Optional)

Replace `node-cache` with Redis:

```bash
npm install redis
```

Update `server.ts`:

```javascript
import {'createClient '} from 'redis';

const redis = createClient({
  url: process.env.REDIS_URL
});

await redis.connect();

// Use redis.get/set instead of cache
```

### 2. CDN Configuration

Use Cloudflare or AWS CloudFront:

- Cache static assets
- Enable Brotli compression
- Setup DDoS protection

### 3. Database (Optional)

For persistent storage of analyses:

```bash
npm install pg
```

Store results in PostgreSQL for historical tracking.

## Scaling

### Horizontal Scaling

Use load balancer (Nginx, HAProxy) across multiple instances:

```nginx
upstream backend {
    least_conn;
    server backend1:3001;
    server backend2:3001;
    server backend3:3001;
}
```

### Auto-scaling

Configure auto-scaling on your platform:

- **AWS**: Auto Scaling Groups
- **Railway**: Auto-scaling enabled by default
- **Kubernetes**: HPA (Horizontal Pod Autoscaler)

## Troubleshooting

### High Memory Usage

- Increase Node.ts memory: `NODE_OPTIONS=--max-old-space-size=4096`
- Check for memory leaks with Chrome DevTools
- Implement request queuing

### API Rate Limits

- Increase OpenRouter API quota if needed
- Implement request queuing
- Add multiple API keys rotation (server-side only)

### Slow Response Times

- Enable Redis caching
- Optimize scraping timeout
- Use CDN for static assets

## Security Hardening

1. **Enable HTTPS only**
2. **Setup firewall rules**
3. **Regular security audits**: `npm audit`
4. **Rotate API keys regularly**
5. **Enable rate limiting per user (not just IP)**
6. **Implement request signing**
7. **Add CAPTCHA for public endpoints**

## Backup Strategy

### Database Backups (if using)

```bash
# Daily backup cron job
0 2 * * * pg_dump database_name > backup_$(date +\%Y\%m\%d).sql
```

### Configuration Backups

```bash
# Backup environment variables
tar -czf config-backup.tar.gz .env.local .env
```

## Rollback Plan

1. Keep previous version:

```bash
pm2 save
pm2 resurrect
```

1. Git rollback:

```bash
git revert <commit-hash>
git push
```

1. Container rollback:

```bash
docker tag current:latest current:rollback
docker run -d current:previous-version
```

## Support

For production issues:

1. Check Sentry error logs
2. Review server logs
3. Verify API quotas
4. Test health endpoints
5. Contact support channels

---

**Remember:** Always test in staging before deploying to production!
