# Pronto Checkout Router

**Version:** 1.0.0  
**Purpose:** Redirect layer between Tally form submissions and Stripe Checkout  
**Architecture:** Microservice following Pronto's canonical separation of concerns

---

## What This Service Does

The Checkout Router is a lightweight service that:

1. Receives intake submission data from Tally (via redirect)
2. Maps service SKUs to Stripe Price IDs
3. Creates a Stripe Checkout Session
4. Redirects the customer to Stripe's hosted checkout page

**What it does NOT do:**
- Touch Airtable
- Wait for Zap 1
- Run workers
- Make business logic decisions

This service is **pure**: it turns intent into a payment page.

---

## Architecture Position

```
Customer fills Tally form
         ↓
Tally redirects to Checkout Router
         ↓
Router creates Stripe Checkout Session
         ↓
Router redirects to Stripe
         ↓
Customer pays on Stripe
         ↓
Stripe redirects to Thank You page
```

Meanwhile, asynchronously:
- **Zap 1** creates Airtable records (Services = Pending)
- **Zap 2** marks Services as Paid when Stripe webhook fires
- **Execution Zaps** trigger workers when Services are ready

---

## Service Catalog (Current)

| SKU | Service Name | Price | Stripe Price ID |
|-----|-------------|-------|-----------------|
| `SVC-001` | Manuscript Processing | $0.00 | (free) |
| `SVC-002` | Interior Formatting | $1.00 | `price_1Sku587uZCk6xNoP3Kmujdxi` |
| `SVC-003` | Cover Design | $1.00 | `price_1Sku677uZCk6xNoP7kwzbTKE` |
| `SVC-004` | KDP Upload Preparation | $1.00 | `price_1Sku787uZCk6xNoP7PbsdNnw` |
| `SVC-005` | Delivery Package | $0.00 | (free) |
| `TEST-SVC-0005` | Test Service Type 5 | $0.00 | (test) |

**Note:** Free services (price = $0.00) are automatically filtered out. If all selected services are free, the router redirects directly to the thank you page without creating a Stripe session.

---

## API Endpoints

### `GET /health`

Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "ok",
  "service": "pronto-checkout-router",
  "version": "1.0.0",
  "timestamp": "2026-01-04T18:30:00.000Z"
}
```

### `GET /checkout`

Main checkout endpoint. Receives Tally submission data and redirects to Stripe.

**Query Parameters:**
- `sid` (required): Tally submission ID
- `services` (required): Comma-separated SKUs (e.g., `SVC-002,SVC-003,SVC-004`)
- `email` (optional): Customer email to pre-fill in Stripe checkout

**Example Request:**
```
GET /checkout?sid=abc123&services=SVC-002,SVC-003
```

**Success Response:**
- HTTP 303 redirect to Stripe Checkout URL

**Error Responses:**
- `400 Bad Request`: Missing or invalid parameters
- `500 Internal Server Error`: Stripe API error or unknown SKU

---

## Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here

# Success URL (where customers land after successful payment)
SUCCESS_URL=https://yourdomain.com/thank-you

# Cancel URL (where customers land if they cancel payment)
CANCEL_URL=https://yourdomain.com/checkout-cancelled

# Port (optional, defaults to 3000)
PORT=3000
```

---

## Installation & Local Development

### Prerequisites
- Node.js 18+ (or 22+)
- npm or pnpm
- Stripe account with API keys

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create `.env` file:**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your actual values.

3. **Run locally:**
   ```bash
   npm start
   ```
   
   Or with auto-reload during development:
   ```bash
   npm run dev
   ```

4. **Test the health endpoint:**
   ```bash
   curl http://localhost:3000/health
   ```

5. **Test the checkout endpoint:**
   ```bash
   curl "http://localhost:3000/checkout?sid=TEST123&services=SVC-002,SVC-003"
   ```
   
   This should redirect you to a Stripe Checkout page.

---

## Deployment to Railway

### Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Choose "Deploy from GitHub repo" (or "Empty Project" if deploying manually)

### Step 2: Configure Environment Variables

In Railway project settings, add these environment variables:

```
STRIPE_SECRET_KEY=sk_live_your_production_key
SUCCESS_URL=https://yourdomain.com/thank-you
CANCEL_URL=https://yourdomain.com/checkout-cancelled
```

**Note:** Railway automatically sets `PORT`, so you don't need to set it manually.

### Step 3: Deploy

**Option A: GitHub Integration (Recommended)**
1. Push this code to a GitHub repository
2. Connect Railway to your GitHub repo
3. Railway will auto-deploy on every push to `main`

**Option B: Railway CLI**
1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Link project: `railway link`
4. Deploy: `railway up`

### Step 4: Get Your Service URL

After deployment, Railway will provide a URL like:
```
https://pronto-checkout-router-production.up.railway.app
```

Use this URL in your Tally redirect configuration.

---

## Deployment to Other Platforms

### Vercel

1. Install Vercel CLI: `npm install -g vercel`
2. Run: `vercel`
3. Set environment variables in Vercel dashboard
4. Deploy: `vercel --prod`

### Render

1. Create new "Web Service" on Render
2. Connect your GitHub repo
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variables in Render dashboard

### Fly.io

1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Run: `fly launch`
3. Set secrets: `fly secrets set STRIPE_SECRET_KEY=sk_...`
4. Deploy: `fly deploy`

---

## Tally Configuration

In your Tally form settings:

1. Go to **Settings** → **Redirect on completion**
2. Enable the toggle
3. Set redirect URL to:
   ```
   https://your-router-domain.com/checkout?sid=@SubmissionID&services=@SelectedServicesSKUs
   ```

Where:
- `@SubmissionID` is Tally's built-in submission ID variable
- `@SelectedServicesSKUs` is your calculated field that outputs SKUs like `SVC-002,SVC-003`

### Creating the Calculated Field in Tally

1. In your Tally form, type `/calculated`
2. Name it: `SelectedServicesSKUs`
3. Type: `Text`
4. Use conditional logic to build the comma-separated SKU string based on which services the customer selected

**Example logic:**
- If "Interior Formatting" is checked → include `SVC-002`
- If "Cover Design" is checked → include `SVC-003`
- If "KDP Upload Preparation" is checked → include `SVC-004`

**Important rules:**
- No spaces in the output
- No trailing comma
- If only one service: `SVC-002` (not `SVC-002,`)
- If nothing selected: return `NONE` or use Tally validation to prevent submission

---

## Stripe Webhook Configuration

The Checkout Router does **not** handle webhooks. Webhooks are handled by **Zap 2**.

However, for reference, here's what Zap 2 needs:

**Webhook Event:** `checkout.session.completed`

**Metadata in Session:**
- `project_intake_submission_id`: The Tally submission ID
- `selected_service_skus`: Comma-separated SKUs (e.g., `SVC-002,SVC-003`)

Zap 2 uses this metadata to:
1. Find the Project in Airtable by submission ID
2. Find Services linked to that Project
3. Mark Services with matching SKUs as `Paid`

---

## Adding New Services

To add a new service (e.g., "Author Bio Writing" with SKU `SVC-006`):

1. **In Airtable:** Add row to Service Catalog
2. **In Stripe:** Create Product + Price, note the Price ID
3. **In this router:** Edit `index.js` and add to `PRICE_BY_SKU`:
   ```javascript
   'SVC-006': 'price_abc123xyz',
   ```
4. **In this router:** Add to `SERVICE_NAMES` (optional, for logging):
   ```javascript
   'SVC-006': 'Author Bio Writing',
   ```
5. **Redeploy** the router
6. **In Tally:** Add checkbox for new service, update calculated field
7. **In Zapier:** Create execution Zap for the new service

That's it. No other components need to change.

---

## Testing Checklist

### Local Testing

- [ ] Health endpoint returns 200 OK
- [ ] Checkout with valid SKUs redirects to Stripe
- [ ] Checkout with invalid SKU returns 400 error
- [ ] Checkout with missing `sid` returns 400 error
- [ ] Checkout with all free services redirects to thank you page
- [ ] Stripe session includes correct metadata

### Production Testing

- [ ] Deploy to Railway (or chosen platform)
- [ ] Health endpoint accessible at public URL
- [ ] Configure Tally redirect URL
- [ ] Submit test form from Tally
- [ ] Verify redirect to Stripe works
- [ ] Complete test payment on Stripe
- [ ] Verify redirect to thank you page
- [ ] Check Stripe dashboard for session metadata
- [ ] Verify Zap 2 marks Services as Paid in Airtable

---

## Monitoring & Logs

### Railway Logs

View logs in Railway dashboard or via CLI:
```bash
railway logs
```

### Key Log Messages

**Successful checkout:**
```
[CHECKOUT] Request received - sid: abc123, services: SVC-002,SVC-003
[CHECKOUT] Parsed SKUs: SVC-002, SVC-003
[CHECKOUT] Creating Stripe session with 2 paid line items
[CHECKOUT] Success - Session created: cs_test_abc123 (234ms)
```

**Free services only:**
```
[CHECKOUT] All selected services are free - redirecting to thank you page
```

**Error:**
```
[CHECKOUT] Error: Unknown service SKU: SVC-999
```

---

## Security Features

1. **Rate Limiting:** 100 requests per 15 minutes per IP
2. **Input Validation:** All parameters are validated before processing
3. **Error Handling:** Errors are logged but user-friendly messages are returned
4. **No Secrets in Code:** All sensitive data in environment variables
5. **HTTPS Only:** Use HTTPS in production (Railway provides this automatically)

---

## Troubleshooting

### "Missing submission ID" error
- Check that Tally is passing `sid` parameter
- Verify Tally redirect URL includes `?sid=@SubmissionID`

### "No services selected" error
- Check that Tally calculated field is outputting SKUs correctly
- Verify no spaces or trailing commas in SKU string

### "Unknown service SKU" error
- Check that SKU exists in `PRICE_BY_SKU` mapping in `index.js`
- Verify SKU spelling matches exactly (case-insensitive)

### Stripe session not created
- Check `STRIPE_SECRET_KEY` is set correctly
- Verify Stripe Price IDs are correct and active
- Check Stripe dashboard for API errors

### Customer not redirected
- Verify `SUCCESS_URL` and `CANCEL_URL` are set correctly
- Check that URLs are publicly accessible
- Verify Stripe success/cancel URLs in dashboard

---

## Support & Maintenance

### Updating Stripe Price IDs

If you change prices in Stripe, update the `PRICE_BY_SKU` mapping in `index.js` and redeploy.

### Updating Service Names

Service names in `SERVICE_NAMES` are only for logging. They don't affect functionality.

### Version History

- **1.0.0** (2026-01-04): Initial production release

---

## License

UNLICENSED - Proprietary to Pronto Publishing
