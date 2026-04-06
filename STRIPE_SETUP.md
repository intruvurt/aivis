# 💳 Stripe Setup Guide - Correct Pricing

## ✅ PRICING FIXED - CORRECT MATH

### **What Was Fixed:**
1. ✅ Yearly pricing now shows annual total, not monthly
2. ✅ Display shows monthly equivalent when yearly selected
3. ✅ Savings calculation is correct
4. ✅ Billing period (monthly/yearly) passed to Stripe
5. ✅ New tier names added (observer, alignment, signal)
6. ✅ Competitor & citation limits displayed in features

---

## 📊 Correct Pricing Structure

### **Alignment Tier:**
- **Monthly:** $49/month
- **Yearly:** $348/year ($38.22month billed annually)
- **Savings:** $10.78/year (~22% off)
- **Features:**
  - 60 scans/month
  - Track 1 competitor
  - 50 citation queries/test
  - CSV & PDF exports
  - Force-refresh, report history

### **Signal Tier:**
- **Monthly:** $149/month
- **Yearly:** $1300/year ($110/month billed annually)
- **Savings:** $393/year (~22% off)
- **Features:**
  - 110 scans/month
  - Track 5 competitors
  - 100 citation queries/test
  - AI Citation Tracker access
  - API access, white-label reports
  - Multi-page deep crawl

---

## 🔧 Stripe Configuration Steps

### **Step 1: Create Stripe Products**

Log into https://dashboard.stripe.com and create products:

#### **Alignment - Monthly**
1. Go to Products → Create product
2. Name: `Alignment - Monthly`
3. Price: `$49.00 USD` recurring monthly
4. Copy the Price ID (starts with `price_`)
5. Save as: `STRIPE_ALIGNMENT_MONTHLY_PRICE_ID`

#### **Alignment - Yearly**
1. Products → Find Alignment product
2. Add another price: `$348.00 USD` recurring yearly
3. Copy the Price ID
4. Save as: `STRIPE_ALIGNMENT_YEARLY_PRICE_ID`

#### **Signal - Monthly**
1. Products → Create product
2. Name: `Signal - Monthly`
3. Price: `$149.00 USD` recurring monthly
4. Copy the Price ID
5. Save as: `STRIPE_SIGNAL_MONTHLY_PRICE_ID`

#### **Signal - Yearly**
1. Products → Find Signal product
2. Add another price: `$1300.00 USD` recurring yearly
3. Copy the Price ID
4. Save as: `STRIPE_SIGNAL_YEARLY_PRICE_ID`

---

## 🔑 Environment Variables

### **Server (.env file)**

```bash
# Required for all Stripe functionality
STRIPE_SECRET_KEY=sk_test_...          # Get from Stripe Dashboard > API keys
STRIPE_WEBHOOK_SECRET=whsec_...         # Get from Stripe Webhooks > Signing secret

# Alignment tier pricing
STRIPE_ALIGNMENT_MONTHLY_PRICE_ID=price_...   # Create in Stripe Products
STRIPE_ALIGNMENT_YEARLY_PRICE_ID=price_...

# Signal tier pricing
STRIPE_SIGNAL_MONTHLY_PRICE_ID=price_...
STRIPE_SIGNAL_YEARLY_PRICE_ID=price_...

# Optional: Legacy tier names (for backward compatibility)
# STRIPE_PRO_PRICE_ID=price_...
# STRIPE_BUSINESS_PRICE_ID=price_...
# STRIPE_ENTERPRISE_PRICE_ID=price_...
# STRIPE_WHITELABEL_MONTHLY_PRICE_ID=price_...
# STRIPE_WHITELABEL_SETUP_PRICE_ID=price_...
# STRIPE_BUYOUT_PRICE_ID=price_...

# Frontend URL (for CORS and redirects)
FRONTEND_URL=https://yourdomain.com
# OR for development
FRONTEND_URL=https://aivis.biz  # Ai Search Visibility & Monitoring frontend
```

---

## 🔄 Webhook Setup

### **Step 1: Create Webhook Endpoint**

1. Go to: https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://yourdomain.com/api/payment/webhook`
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`

5. Copy the **Signing secret** (starts with `whsec_`)
6. Add to your `.env` as `STRIPE_WEBHOOK_SECRET`

### **Step 2: Test Webhook (Development)**

```bash
# Install Stripe CLI
stripe listen --forward-to https://api.aivis.biz/api/payment/webhook

# This will give you a webhook secret starting with whsec_
# Add it to your .env file
```

---

## ✅ Testing Checklist

### **Test Monthly Checkout:**

1. Start servers:
   ```bash
   cd server && npm run dev
   cd client && npm run dev
   ```

2. Go to: `https://aivis.biz/pricing`

3. Select "Monthly" billing period

4. Click "Upgrade" on Alignment tier

5. Verify Stripe checkout shows:
   - Price: $49.00/month
   - Description: "Alignment - Monthly"

6. Use test card: `4242 4242 4242 4242`
   - Any future expiry date
   - Any CVC

7. Complete checkout

8. Verify:
   - Redirected to success page
   - User tier updated to "alignment"
   - Subscription created in Stripe dashboard

### **Test Yearly Checkout:**

1. Go to: `https://aivis.biz/pricing`

2. Select "Yearly" billing period

3. Verify pricing shows:
   - Alignment: $38.22month (Billed annually at $348/year)
   - Savings: 💰 Save $10.78/year
   - Signal: $110/month (Billed annually at $1300/year)
   - Savings: 💰 Save $72/year

4. Click "Upgrade" on Signal tier

5. Verify Stripe checkout shows:
   - Price: $1300.00/year
   - Description: "Signal - Yearly"

6. Complete checkout with test card

7. Verify subscription created with yearly interval

---

## 🐛 Common Issues & Fixes

### **Issue: "Missing price ID"**
**Fix:** Make sure all environment variables are set in `server/.env`:
```bash
STRIPE_ALIGNMENT_MONTHLY_PRICE_ID=price_xxx
STRIPE_ALIGNMENT_YEARLY_PRICE_ID=price_xxx
STRIPE_SIGNAL_MONTHLY_PRICE_ID=price_xxx
STRIPE_SIGNAL_YEARLY_PRICE_ID=price_xxx
```

### **Issue: "Invalid tier: alignment"**
**Fix:** This is fixed! We added observer/alignment/signal to ALLOWED_TIERS.

### **Issue: Webhook signature verification fails**
**Fix:**
1. Make sure `STRIPE_WEBHOOK_SECRET` is set
2. For development, use Stripe CLI: `stripe listen --forward-to https://api.aivis.biz/api/payment/webhook`
3. For production, create webhook in Stripe Dashboard

### **Issue: Wrong price displayed**
**Fix:** We fixed this!
- Monthly: Shows actual monthly price
- Yearly: Shows monthly equivalent + "Billed annually at $X/year"
- Savings: Correct calculation (monthly * 12 - yearly_total)

---

## 💰 Revenue Tracking

After setup, you can track revenue in Stripe Dashboard:

1. **MRR (Monthly Recurring Revenue):**
   - Dashboard → Analytics → MRR

2. **Active Subscriptions:**
   - Dashboard → Customers → Subscriptions

3. **Churn Rate:**
   - Dashboard → Analytics → Churn

4. **Revenue by Tier:**
   - Dashboard → Reports → Create custom report
   - Filter by product name (Alignment / Signal)

---

## 🎯 Production Deployment Checklist

Before going live:

- [ ] All STRIPE_* env vars set in production
- [ ] Webhook endpoint created in Stripe Dashboard
- [ ] STRIPE_WEBHOOK_SECRET added to production .env
- [ ] Test card payments work in test mode
- [ ] Switch to live mode API keys
- [ ] Test real card payment (small amount)
- [ ] Verify webhook receives events
- [ ] Check user tier updates correctly
- [ ] Monitor Stripe Dashboard for errors

---

## 📊 Expected Stripe Dashboard View

After users subscribe, you'll see:

**Products:**
```
Alignment
├─ Monthly: $49.00/month (X active)
└─ Yearly: $348.00/year (Y active)

Signal
├─ Monthly: $149.00/month (X active)
└─ Yearly: $1,068.00/year (Y active)
```

**Revenue:**
```
MRR: $XXX
Active Subscriptions: XX
Churn Rate: X%
```

---

## 🚀 You're Ready!

**Pricing is now correct and Stripe is wired properly!**

Just add your Stripe Price IDs to the environment variables and you're ready to accept payments! 💰

**Test Mode:**
- Use test API keys (start with `sk_test_`)
- Use test card: 4242 4242 4242 4242
- No real charges

**Live Mode:**
- Use live API keys (start with `sk_live_`)
- Real charges to real cards
- Real money! 💸
