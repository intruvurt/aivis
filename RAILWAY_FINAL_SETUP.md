# 🔧 FINAL RAILWAY SETUP - STEP BY STEP

**The database certificate is KEY'S NOT SET. Do this NOW**, exactly as written:

---

## ✅ STEP 1: Open Railway Dashboard

**URL:** https://railway.app

Log in with your account.

---

## ✅ STEP 2: Navigate to aivis Service

1. You should see your project (it's named something like "aivis" or your project name)
2. Click on the project
3. You'll see services listed (look for the backend service)
4. Click on **aivis** (the Express backend service, NOT the database or redis)

---

## ✅ STEP 3: Open Variables Tab

On the aivis service page:

- You'll see tabs at the top: **Logs**, **Variables**, **Settings**, **Deploy**
- Click on **Variables** tab

---

## ✅ STEP 4: Check Current Variables

You should see existing variables like:

- `DATABASE_URL` (connection string)
- `OPEN_ROUTER_API_KEY`
- `FRONTEND_URL` (should be `https://aivis.biz`)
- `NODE_ENV` (should be `production`)

---

## ✅ STEP 5: Add DATABASE_CA_CERT Variable

### 5a: Click "New Variable" or "+" Button

This creates a new empty variable row.

### 5b: Set the Name

In the **"Name"** or **"Key"** field, type exactly:

```
DATABASE_CA_CERT
```

### 5c: Paste the Certificate Value

In the **"Value"** field, paste everything below (copy ALL of it, including the BEGIN and END lines):

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

✅ **IMPORTANT:**

- Make sure you copy the ENTIRE certificate from `-----BEGIN` to `-----END`
- Include those lines
- Don't add any extra spaces or line breaks before/after

### 5d: Save

Look for a **Save** button or **Add** button and click it.

Railway should show the variable is saved.

---

## ✅ STEP 6: Redeploy

**Option A: Automatic (Recommended)**

- Just wait 30 seconds
- Railway detects the variable change and redeploys automatically
- You'll see logs update in real-time

**Option B: Manual**

- Look for the three-dot menu (**⋯**) on the aivis service
- Select **Redeploy**
- Railway starts a new build

---

## ✅ STEP 7: Watch the Logs

1. Go back to the **Logs** tab on the aivis service
2. Scroll to the bottom to see the latest logs
3. Wait for new deployment logs (you'll see "Starting Container" again)
4. **Look for these success messages:**

```
✅ [Startup] Database ready
✅ [Startup] Running 15 migrations...
✅ [Startup] Citation scheduler bootstrap complete
✅ Server running on http://0.0.0.0:3001 (production)
```

**If you still see:**

```
❌ [DB] Migration error: self-signed certificate in certificate chain
```

Then the certificate wasn't set correctly. Try again.

---

## ✅ STEP 8: Test It Works

Once you see "Database ready" in logs:

1. **Test health endpoint:**

   ```bash
   curl https://api.aivis.biz/api/health
   ```

   Should return:

   ```json
   {
     "status": "ok",
     "database": true,
     "redis": true
   }
   ```

2. **Try login:**
   - Go to https://aivis.biz
   - Click "Sign up with Google"
   - See if it redirects correctly (CORS error should be gone)

---

## ❓ Still Not Working?

**If you still see SSL errors after 2 minutes:**

1. **Double-check in Railroad:**
   - Go to Variables tab
   - Find `DATABASE_CA_CERT`
   - Click on it to view the value
   - Make sure it starts with `-----BEGIN CERTIFICATE-----` and ends with `-----END CERTIFICATE-----`
   - If it looks cut off or wrong, delete it and paste again

2. **Clear browser cache:**
   - The old CORS error might be cached
   - Try: `Ctrl+Shift+Delete` (hard refresh)
   - Or use Incognito window

3. **Check the exact error:**
   - In Railway logs, search for `[DB]`
   - Copy the exact error message
   - Tell me what it says

---

## 📋 Checklist Before Asking for Help

- [ ] Went to https://railway.app
- [ ] Clicked on aivis service
- [ ] Opened Variables tab
- [ ] Clicked "New Variable"
- [ ] Name: `DATABASE_CA_CERT` (exact spelling)
- [ ] Value: Pasted full certificate (BEGIN + END)
- [ ] Clicked Save
- [ ] Waited 30 seconds for redeploy
- [ ] Checked logs for "Database ready"

If all checked ✅, tell me what the logs show NOW.
