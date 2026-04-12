# 🔒 Railway SSL Certificate Setup - PRODUCTION FIX

## What's Fixed
The database connection code in `server/src/services/postgresql.ts` has been repaired to:
- ✅ Resolve merge conflicts in SSL mode handling
- ✅ Always use `sslmode=require` in the connection URL
- ✅ Load the CA certificate from `DATABASE_CA_CERT` environment variable
- ✅ Enable certificate verification when the certificate is present
- ✅ Gracefully handle missing certificates (for non-Supabase databases)

## What You Need To Do

### Step 1: Go to Railway Dashboard
1. Open https://railway.app
2. Log in with your account
3. Click your **aivis** project
4. Click the **aivis** service (Express backend, NOT database/redis)

### Step 2: Open Variables Tab
- Click **Variables** tab
- Look for existing variables (DATABASE_URL, OPEN_ROUTER_API_KEY, etc.)

### Step 3: Add the CA Certificate
1. Click **New Variable** or **+** button
2. Set the **Key** to: `DATABASE_CA_CERT`
3. Paste the full certificate value below (copy everything including `-----BEGIN` and `-----END`):

```
-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----
```

4. Click **Save** or **Add**

### Step 4: Wait for Redeploy
- Railway automatically redeploys within 30 seconds when variables change
- Or manually click the three-dot menu and select **Redeploy**

### Step 5: Verify in Logs
1. Go to the **aivis** service → **Logs** tab
2. Look for success indicators (should appear within 2 minutes):
   ```
   [DB] Connected
   [DB] Migrations running...
   ✓ Creating tables...
   Server running on http://0.0.0.0:3001
   ```

### Step 6: Test the Connection
Once deployed, verify the database is working:

```bash
# Health check (should include "database": true)
curl https://api.aivis.biz/api/health

# Should return JSON with database: true
```

## Troubleshooting

### Still seeing "self-signed certificate in certificate chain" error?

1. **Check the certificate was fully copied** - ensure both `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----` lines are present
2. **No extra spaces** - paste exactly as shown; don't add any whitespace before/after
3. **Wait longer** - Railway redeploys can take 2-3 minutes sometimes
4. **Manual redeploy** - Click the three-dot menu on the aivis service and select "Redeploy"

### Database shows as unavailable but no SSL error?

- Check `DATABASE_URL` is set correctly in the Variables tab
- Ensure all required environment variables are present (`OPEN_ROUTER_API_KEY`, `JWT_SECRET`, etc.)
- Check the full logs for any other error messages

## Code Changes Made

**File:** `server/src/services/postgresql.ts`

- ✅ Resolved merge conflict in `normalizeDatabaseUrl()`
- ✅ Standardized to always use `sslmode=require` in URL
- ✅ Certificate verification is handled by the `DATABASE_CA_CERT` environment variable
- ✅ When `DATABASE_CA_CERT` is present: uses `rejectUnauthorized: true` + CA cert
- ✅ When `DATABASE_CA_CERT` is missing: allows connection (for non-Supabase DBs)

## Next Steps After Certificate is Set

1. ✅ Database migrations will run automatically
2. ✅ All tables will be created (users, audits, sessions, etc.)
3. ✅ OAuth login will work
4. ✅ Run the full pre-production audit: `cat PRE_PRODUCTION_AUDIT.md`

---

**Questions?** Check the logs in Railway dashboard or review `RAILWAY_CERTIFICATE_SETUP.md` for more details.
