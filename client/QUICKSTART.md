#  Quick Start Guide

##  Automated Setup (Recommended)

### Windows

```cmd
setup.bat
```

### macOS/Linux

```bash
chmod +x setup.sh
./setup.sh
```

##  Manual Setup

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Configure Environment

1. **Copy environment templates:**

   ```bash
   cp .env.example .env.local
   cp .env.client.example .env
   ```

2. **Get an OpenRouter API Key:**
   - Visit: https://openrouter.ai/keys
   - Create/login to your account
   - Click "Create Key"
   - Copy the generated key

3. **Update `.env.local`:**

   ```env
   OPEN_ROUTER_API_KEY=your_actual_api_key_here
   PORT=3001
   FRONTEND_URL=https://aivis.biz
   NODE_ENV=development
   ```

4. **Update `.env` (optional):**
   ```env
   VITE_API_URL=https://api.aivis.biz
   VITE_ENV=development
   ```

### Step 3: Start Development

```bash
# Start both client and server
npm run dev

# Or start separately:
npm run dev:client  # Frontend: http://https://aivis.biz
npm run dev:server  # Backend: https://api.aivis.biz
```

### Step 4: Verify Installation

1. **Check health endpoint:**

   ```bash
   curl https://api.aivis.biz/health
   ```

   Expected response:

   ```json
   {
     "status": "healthy",
     "timestamp": "2025-12-17T...",
     "version": "1.0.0"
   }
   ```

2. **Test analysis:**
   - Open http://https://aivis.biz
   - Enter a URL (e.g., `stripe.com`)
   - Click "Analyze"
   - Wait for results

##  Run Tests

```bash
npm test
```

##  Troubleshooting

### Issue: "Cannot find module"

**Solution:**

```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: "API Key not found"

**Solution:**

- Verify `.env.local` has correct `OPEN_ROUTER_API_KEY`
- Restart the server: `npm run dev:server`

### Issue: "Port already in use"

**Solution:**

```bash
# Find process on port 3000/3001
lsof -ti:3000 # macOS/Linux
netstat -ano | findstr :3000 # Windows

# Kill process
kill -9 <PID> # macOS/Linux
taskkill /PID <PID> /F # Windows

# Or change port in .env.local
```

### Issue: "CORS error"

**Solution:**

- Ensure backend is running on port 3001
- Check `FRONTEND_URL` in `.env.local` matches your frontend port

### Issue: "Rate limit exceeded"

**Solution:**

- Wait 60 seconds
- Or adjust rate limit in `server.ts` (line 58)

##  Next Steps

1. **Read the documentation:**
   - [README.md](README.md) - Full documentation
   - [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment
   - [CONTRIBUTING.md](CONTRIBUTING.md) - Contributing guide

2. **Explore the code:**
   - `server/server.ts` - Backend API
   - `services/scraper.ts` - Web scraping
   - `services/openrouter.ts` - AI integration
   - `views/AnalyzePage.tsx` - Main UI

3. **Customize:**
   - Adjust rate limits
   - Add custom styling
   - Extend API endpoints

##  Common Commands

| Command              | Description        |
| -------------------- | ------------------ |
| `npm run dev`        | Start both servers |
| `npm run dev:client` | Frontend only      |
| `npm run dev:server` | Backend only       |
| `npm test`           | Run tests          |
| `npm run lint`       | Check code quality |
| `npm run format`     | Format code        |
| `npm run build`      | Production build   |

##  Security Checklist

- [ ] Changed default API key
- [ ] Configured Sentry DSN (optional)
- [ ] Set strong ADMIN_KEY (optional)
- [ ] Reviewed CORS settings
- [ ] Checked rate limits

##  Tips

1. **Use trending URLs** for quick testing:
   - stripe.com
   - vercel.com
   - linear.app

2. **Monitor logs** during development:
   - Backend logs show in terminal
   - Frontend logs in browser console

3. **Clear cache** if needed:
   - Restart server to clear node-cache
   - Or implement admin cache clear endpoint

##  Getting Help

If you encounter issues:

1. Check this guide first
2. Review error messages carefully
3. Search existing GitHub issues
4. Open a new issue with:
   - Error message
   - Steps to reproduce
   - Environment details (OS, Node version)

##  Success Indicators

You've successfully set up when:

-  Health endpoint returns "healthy"
-  Frontend loads without errors
-  Can analyze a URL successfully
-  Results display with charts and recommendations
-  Tests pass (`npm test`)

---

**Congratulations! You're ready to start analyzing websites! **
