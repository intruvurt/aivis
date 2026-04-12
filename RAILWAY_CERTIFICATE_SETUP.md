# 🚀 SET DATABASE_CA_CERT IN RAILWAY - FINAL STEP

## You have the certificate! ✅

The certificate has been saved. Now set it in Railway to unblock the database.

---

## Step 1: Go to Railway Dashboard

**URL:** https://railway.app

1. Log in with your account
2. Select your **aivis** project
3. Click on the **aivis** service (the backend)
4. Click the **Variables** tab

---

## Step 2: Add the Certificate Variable

In the **Variables** section:

1. Click **New Variable** (or the + button)
2. Fill in:
   - **Key/Name:** `DATABASE_CA_CERT`
   - **Value:** Paste the certificate below (starts with `-----BEGIN` and ends with `-----END`)

**Value to paste:**

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

3. Click **Save**

---

## Step 3: Redeploy

After saving, railway will automatically redeploy within **30 seconds**.

**Option A: Auto-redeploy (recommended)**

- Just wait 30 seconds
- Railway detects variable change and redeploys

**Option B: Manual redeploy**

- Click the three-dot menu on your service
- Select **Redeploy**

---

## Step 4: Verify in Logs

1. Go to the **aivis** service → **Logs** tab
2. Wait for new deployment logs
3. Look for:
   ```
   ✅ [Startup] Database ready
   ✅ [Startup] Running migrations
   ✅ Server running on http://0.0.0.0:3001
   ```

---

## ✅ Once Verified

Once you see those success messages:

1. **Run this to test health endpoint:**

   ```bash
   curl https://api.aivis.biz/api/health
   ```

   Expected response:

   ```json
   {
     "status": "ok",
     "database": true,
     "redis": true,
     "timestamp": "2026-04-12T..."
   }
   ```

2. **Re-run pre-production audit:**

   ```bash
   # From /workspaces/aivis repo
   cat PRE_PRODUCTION_AUDIT.md
   # All items should now be passing ✅
   ```

3. **Test OAuth login:**
   - Visit https://aivis.biz
   - Click "Sign up with Google" or login
   - Should create user in database

---

## 🎯 What This Fixes

Once the certificate is set and deployed:

- ✅ Database connects successfully
- ✅ Migrations run automatically
- ✅ All tables created (users, audits, sessions, etc.)
- ✅ OAuth login enabled
- ✅ All API endpoints work
- ✅ Health check passes
- ✅ Pre-production audit passes

---

## 📝 Need Help?

If logs still show SSL errors after 2 minutes:

1. Verify the certificate was pasted completely (should start with `-----BEGIN` and end with `-----END`)
2. Check that there are no extra spaces/newlines in the variable value
3. Try manual redeploy by clicking the three-dot menu
4. Check Railway logs for the exact error

**Once confirmed working, let me know and I'll run the full audit suite again!** 🚀
