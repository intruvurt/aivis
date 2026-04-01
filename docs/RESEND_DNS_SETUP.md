# Resend DNS Setup for aivis.biz

## Quick Start

1. **Sign up at [resend.com](https://resend.com)** (free tier: 100 emails/day, 3,000/month)

2. **Add your domain** in Resend Dashboard → Domains → Add Domain → `aivis.biz`

3. **Add these DNS records** to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)

---

## How AiVis Sends Email

AiVis uses **Resend SMTP** (not REST API) for better deliverability:

| Setting | Value |
|---------|-------|
| Host | `smtp.resend.com` |
| Port | `465` (TLS) |
| User | `resend` |
| Password | Your `RESEND_API_KEY` |

The same API key works for both SMTP and REST—we just send via SMTP.

---

## Required DNS Records

### SPF Record (Sender Policy Framework)
Tells email servers that Resend is allowed to send on your behalf.

| Type | Host/Name | Value |
|------|-----------|-------|
| TXT | `@` or `aivis.biz` | `v=spf1 include:_spf.resend.com ~all` |

If you already have an SPF record, merge it:
```
v=spf1 include:_spf.resend.com include:_spf.google.com ~all
```

### DKIM Record (DomainKeys Identified Mail)
Cryptographic signature that proves emails are legit.

| Type | Host/Name | Value |
|------|-----------|-------|
| TXT | `resend._domainkey` | (Copy the long value from Resend dashboard) |

The value looks like:
```
v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEB...
```

### DMARC Record (Domain-based Message Authentication)
Policy telling receivers what to do with failed checks.

| Type | Host/Name | Value |
|------|-----------|-------|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:support@aivis.biz` |

Start with `p=none` (monitoring only), then move to `p=quarantine` or `p=reject` after confirming deliverability.

---

## Environment Variables

Once DNS is verified (can take 10 min to 48 hrs), add to `server/.env`:

```env
# Email Service (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=AiVis <noreply@aivis.biz>

# Make sure FRONTEND_URL matches your deployed frontend
FRONTEND_URL=https://app.aivis.biz
```

---

## Testing Deliverability

1. **Send to yourself first** - Register with your personal email

2. **Check spam folder** - First emails often land there until reputation builds

3. **Use mail-tester.com** - Forward a test email to their address for a score (aim for 9+/10)

4. **Check headers** - Look for `spf=pass`, `dkim=pass`, `dmarc=pass`

---

## Common Issues

### Emails going to spam?
- Make sure all 3 DNS records are set (SPF, DKIM, DMARC)
- Wait 24-48 hours for DNS propagation
- Dont send too many emails at once initially (warm up the domain)
- Avoid spam trigger words in subject line

### DNS not propagating?
- Use [dnschecker.org](https://dnschecker.org) to verify records
- Some registrars have TTL delays
- Try flushing local DNS: `ipconfig /flushdns` (Windows)

### Resend showing "Pending"?
- Double check the exact record values
- Some registrars add the domain automatically (use just `resend._domainkey` not `resend._domainkey.aivis.biz`)

---

## Production Checklist

- [ ] Domain added in Resend dashboard
- [ ] SPF record added and verified
- [ ] DKIM record added and verified  
- [ ] DMARC record added
- [ ] `RESEND_API_KEY` set in production env
- [ ] `FROM_EMAIL` set with proper format
- [ ] `FRONTEND_URL` points to production frontend
- [ ] Test email sent and received (not in spam)
- [ ] Check email score at mail-tester.com (9+)

---

## Support Contacts

- Resend docs: https://resend.com/docs
- AiVis support: support@aivis.biz
