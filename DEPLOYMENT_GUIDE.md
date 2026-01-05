# Pronto Checkout Router - Deployment Guide

**Purpose:** Step-by-step instructions for deploying the Checkout Router to production  
**Recommended Platform:** Railway (easiest and most reliable for this use case)

---

## Pre-Deployment Checklist

Before deploying, ensure you have:

- [ ] Stripe account with API keys (test and production)
- [ ] Stripe Products and Prices created for your services
- [ ] Domain name for your website (for success/cancel URLs)
- [ ] Railway account (or chosen hosting platform)
- [ ] GitHub account (optional, but recommended for auto-deploy)

---

## Option 1: Deploy to Railway (Recommended)

### Why Railway?

- ✅ Automatic HTTPS
- ✅ Free tier available
- ✅ Auto-deploy from GitHub
- ✅ Built-in logging and monitoring
- ✅ Environment variable management
- ✅ Zero-config Node.js support

### Step 1: Prepare Your Code

1. **Create a GitHub repository:**
   ```bash
   cd /home/ubuntu/pronto-checkout-router
   git init
   git add .
   git commit -m "Initial commit - Pronto Checkout Router"
   ```

2. **Push to GitHub:**
   ```bash
   # Create a new repo on GitHub first, then:
   git remote add origin https://github.com/yourusername/pronto-checkout-router.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Sign up or log in
3. Click **"New Project"**
4. Select **"Deploy from GitHub repo"**
5. Authorize Railway to access your GitHub account
6. Select your `pronto-checkout-router` repository
7. Railway will automatically detect it's a Node.js app and start deploying

### Step 3: Configure Environment Variables

1. In your Railway project, click on your service
2. Go to the **"Variables"** tab
3. Click **"Add Variable"** and add each of these:

   ```
   STRIPE_SECRET_KEY=sk_live_your_production_stripe_key
   SUCCESS_URL=https://yourdomain.com/thank-you
   CANCEL_URL=https://yourdomain.com/checkout-cancelled
   ```

   **Important:** Use your **production** Stripe key (`sk_live_...`), not test key.

4. Click **"Deploy"** to restart with new variables

### Step 4: Get Your Service URL

1. In Railway, go to **"Settings"** tab
2. Scroll to **"Domains"**
3. Click **"Generate Domain"**
4. Railway will provide a URL like:
   ```
   https://pronto-checkout-router-production.up.railway.app
   ```

5. **Optional:** Add a custom domain:
   - Click **"Add Custom Domain"**
   - Enter your subdomain (e.g., `checkout.yourdomain.com`)
   - Add the CNAME record to your DNS provider as instructed
   - Wait for DNS propagation (5-30 minutes)

### Step 5: Test Your Deployment

1. **Test health endpoint:**
   ```bash
   curl https://your-railway-url.up.railway.app/health
   ```
   
   Should return:
   ```json
   {
     "status": "ok",
     "service": "pronto-checkout-router",
     "version": "1.0.0"
   }
   ```

2. **Test checkout endpoint (manual):**
   ```bash
   curl "https://your-railway-url.up.railway.app/checkout?sid=TEST123&services=SVC-002,SVC-003"
   ```
   
   Should redirect you to a Stripe Checkout page.

3. **Verify Stripe session metadata:**
   - Complete the test checkout
   - Go to Stripe Dashboard → Payments → Sessions
   - Find your test session
   - Check that metadata includes:
     - `project_intake_submission_id: TEST123`
     - `selected_service_skus: SVC-002,SVC-003`

### Step 6: Configure Tally Redirect

1. Go to your Tally form
2. Open **Settings** → **Redirect on completion**
3. Enable the toggle
4. Set redirect URL to:
   ```
   https://your-railway-url.up.railway.app/checkout?sid=@SubmissionID&services=@SelectedServicesSKUs
   ```

5. Save and test by submitting your Tally form

### Step 7: Monitor Logs

View logs in Railway:
- Click on your service
- Go to **"Deployments"** tab
- Click on the latest deployment
- View real-time logs

Or use Railway CLI:
```bash
npm install -g @railway/cli
railway login
railway link
railway logs
```

---

## Option 2: Deploy to Vercel

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Deploy

```bash
cd /home/ubuntu/pronto-checkout-router
vercel
```

Follow the prompts:
- Link to existing project? **No**
- Project name? **pronto-checkout-router**
- Directory? **./  (current directory)**
- Override settings? **No**

### Step 3: Set Environment Variables

```bash
vercel env add STRIPE_SECRET_KEY production
vercel env add SUCCESS_URL production
vercel env add CANCEL_URL production
```

### Step 4: Deploy to Production

```bash
vercel --prod
```

Vercel will provide a URL like:
```
https://pronto-checkout-router.vercel.app
```

---

## Option 3: Deploy to Render

### Step 1: Create Render Account

Go to [render.com](https://render.com) and sign up.

### Step 2: Create New Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:
   - **Name:** pronto-checkout-router
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free (or paid for production)

### Step 3: Add Environment Variables

In the Render dashboard:
1. Go to **"Environment"** tab
2. Add:
   ```
   STRIPE_SECRET_KEY=sk_live_...
   SUCCESS_URL=https://yourdomain.com/thank-you
   CANCEL_URL=https://yourdomain.com/checkout-cancelled
   ```

### Step 4: Deploy

Render will automatically deploy. Your URL will be:
```
https://pronto-checkout-router.onrender.com
```

---

## Post-Deployment Configuration

### 1. Update Tally Form

Set redirect URL to your deployed service:
```
https://your-deployed-url.com/checkout?sid=@SubmissionID&services=@SelectedServicesSKUs
```

### 2. Update Thank You Page

Ensure your thank you page can handle these query parameters:
- `session_id` (from Stripe after successful payment)
- `sid` (from router if all services are free)
- `free=true` (from router if all services are free)

### 3. Update Cancel Page

Ensure your cancellation page can handle:
- `sid` (original submission ID)

### 4. Configure Stripe Webhooks (for Zap 2)

In Stripe Dashboard:
1. Go to **Developers** → **Webhooks**
2. Add endpoint for `checkout.session.completed`
3. Point it to your Zapier webhook URL (not the Checkout Router)

---

## Testing End-to-End Flow

### Test 1: Paid Services

1. Fill out Tally form
2. Select paid services (e.g., Interior Formatting, Cover Design)
3. Submit form
4. Verify redirect to Stripe Checkout
5. Complete payment (use test card: `4242 4242 4242 4242`)
6. Verify redirect to thank you page
7. Check Stripe Dashboard for session with correct metadata
8. Verify Zap 2 marks Services as Paid in Airtable

### Test 2: Free Services Only

1. Fill out Tally form
2. Select only free services (e.g., Manuscript Processing)
3. Submit form
4. Verify direct redirect to thank you page (no Stripe)
5. Verify `free=true` parameter in URL

### Test 3: Mixed Services

1. Fill out Tally form
2. Select both paid and free services
3. Submit form
4. Verify redirect to Stripe with only paid services
5. Complete payment
6. Verify all services (paid and free) are created in Airtable

---

## Monitoring & Maintenance

### Health Checks

Set up automated health checks:
- **UptimeRobot:** Free service to ping `/health` endpoint every 5 minutes
- **Railway:** Built-in health checks (configure in settings)

### Log Monitoring

Check logs regularly for:
- `[CHECKOUT] Error` messages
- Unknown SKU errors
- Stripe API errors
- Rate limit hits

### Updating Services

When adding new services:
1. Update `PRICE_BY_SKU` in `index.js`
2. Commit and push to GitHub
3. Railway auto-deploys (or manually deploy on other platforms)
4. Update Tally form calculated field
5. Test new service flow

---

## Rollback Procedure

If something goes wrong:

### Railway
1. Go to **"Deployments"** tab
2. Find previous working deployment
3. Click **"Redeploy"**

### Vercel
```bash
vercel rollback
```

### Render
1. Go to **"Deploys"** tab
2. Find previous working deploy
3. Click **"Redeploy"**

---

## Security Best Practices

1. **Never commit `.env` file** (it's in `.gitignore`)
2. **Use production Stripe keys** in production environment
3. **Use HTTPS only** (all platforms provide this)
4. **Monitor rate limits** in logs
5. **Rotate Stripe keys** if compromised
6. **Set up alerts** for failed deployments

---

## Troubleshooting

### Deployment fails
- Check Node.js version (should be 18+)
- Verify `package.json` is valid
- Check platform logs for specific errors

### Environment variables not working
- Verify variables are set in platform dashboard
- Check for typos in variable names
- Redeploy after adding variables

### Stripe errors
- Verify `STRIPE_SECRET_KEY` is correct
- Check that Price IDs exist and are active in Stripe
- Ensure you're using the right key (test vs. production)

### Redirect not working
- Verify Tally redirect URL is correct
- Check that `@SubmissionID` and `@SelectedServicesSKUs` are available in Tally
- Test manually with curl to isolate the issue

---

## Support Resources

- **Railway Docs:** https://docs.railway.app
- **Stripe API Docs:** https://stripe.com/docs/api
- **Tally Help Center:** https://tally.so/help
- **Node.js Docs:** https://nodejs.org/docs

---

## Next Steps After Deployment

1. ✅ Deploy Checkout Router
2. ✅ Configure Tally redirect
3. ✅ Test end-to-end flow
4. ⏭️ Build/update Zap 2 (Stripe webhook → Airtable)
5. ⏭️ Build execution Zaps (trigger workers)
6. ⏭️ Build workers (if not already done)
7. ⏭️ Test complete system with real customer flow

---

**Congratulations!** Your Checkout Router is now live and ready to handle customer payments. 🎉
