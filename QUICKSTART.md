# Checkout Router - Quick Start Guide

**Get up and running in 5 minutes**

---

## Local Testing (Right Now)

### 1. Set Up Environment

```bash
cd /home/ubuntu/pronto-checkout-router
cp .env.example .env
```

Edit `.env` and add your Stripe test key:
```bash
STRIPE_SECRET_KEY=sk_test_your_test_key_here
SUCCESS_URL=http://localhost:3000/thank-you
CANCEL_URL=http://localhost:3000/checkout-cancelled
```

### 2. Start the Server

```bash
npm start
```

You should see:
```
🚀 Pronto Checkout Router running on port 3000
📋 Service Catalog loaded with 6 services
🔒 Rate limiting enabled: 100 requests per 15 minutes per IP
✅ Ready to accept checkout requests
```

### 3. Test Health Check

Open a new terminal:
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "pronto-checkout-router",
  "version": "1.0.0",
  "timestamp": "2026-01-04T18:30:00.000Z"
}
```

### 4. Test Checkout (Manual)

```bash
curl -L "http://localhost:3000/checkout?sid=TEST123&services=SVC-002,SVC-003"
```

This should output a Stripe Checkout URL. Copy and paste it into your browser.

### 5. Complete Test Payment

On the Stripe Checkout page:
- Email: `test@example.com`
- Card: `4242 4242 4242 4242`
- Expiry: Any future date
- CVC: Any 3 digits
- Name: Any name

Click "Pay" and you'll be redirected to your success URL.

### 6. Verify Metadata in Stripe

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/payments)
2. Find your test payment
3. Click on it
4. Scroll to "Metadata"
5. Verify:
   - `project_intake_submission_id: TEST123`
   - `selected_service_skus: SVC-002,SVC-003`

---

## Deploy to Railway (10 minutes)

### 1. Push to GitHub

```bash
cd /home/ubuntu/pronto-checkout-router
git init
git add .
git commit -m "Initial commit"
```

Create a new repo on GitHub, then:
```bash
git remote add origin https://github.com/yourusername/pronto-checkout-router.git
git branch -M main
git push -u origin main
```

### 2. Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your `pronto-checkout-router` repo
4. Railway auto-deploys

### 3. Add Environment Variables

In Railway:
1. Click on your service
2. Go to "Variables" tab
3. Add:
   ```
   STRIPE_SECRET_KEY=sk_live_your_production_key
   SUCCESS_URL=https://yourdomain.com/thank-you
   CANCEL_URL=https://yourdomain.com/checkout-cancelled
   ```

### 4. Get Your URL

1. Go to "Settings" tab
2. Scroll to "Domains"
3. Click "Generate Domain"
4. Copy the URL (e.g., `https://pronto-checkout-router-production.up.railway.app`)

### 5. Test Production

```bash
curl https://your-railway-url.up.railway.app/health
```

---

## Configure Tally (5 minutes)

### 1. Create Calculated Field

In your Tally form:
1. Type `/calculated`
2. Name: `SelectedServicesSKUs`
3. Type: `Text`
4. Use conditional logic to output SKUs based on selections

Example output: `SVC-002,SVC-003,SVC-004`

### 2. Set Redirect URL

In Tally form settings:
1. Go to "Settings" → "Redirect on completion"
2. Enable toggle
3. Set URL:
   ```
   https://your-railway-url.up.railway.app/checkout?sid=@SubmissionID&services=@SelectedServicesSKUs
   ```

### 3. Test End-to-End

1. Fill out your Tally form
2. Select services
3. Submit
4. Verify redirect to Stripe
5. Complete payment
6. Verify redirect to thank you page

---

## Troubleshooting

### "Cannot find module 'express'"
```bash
npm install
```

### "Missing submission ID"
- Check Tally redirect URL includes `?sid=@SubmissionID`

### "No services selected"
- Check Tally calculated field outputs SKUs correctly
- Verify no spaces or trailing commas

### Stripe error
- Verify `STRIPE_SECRET_KEY` is set
- Check Price IDs match your Stripe account

---

## What's Next?

- ✅ Router deployed and working
- ⏭️ Build Zap 2 (Stripe webhook → mark Services Paid)
- ⏭️ Build execution Zaps (trigger workers)
- ⏭️ Test complete customer flow

---

**Need help?** Check `README.md` for full documentation or `DEPLOYMENT_GUIDE.md` for detailed deployment instructions.
