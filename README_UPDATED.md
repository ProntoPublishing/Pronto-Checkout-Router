# Pronto Checkout Router v1.0.1

**Version:** 1.0.1 (Updated)  
**Purpose:** Redirect layer between Tally form submissions and Stripe Checkout  
**Architecture:** Microservice following Pronto's canonical separation of concerns

---

## What Changed in v1.0.1

### ✅ Fixed SKU Alignment
- Changed SKU format from `SVC-001`, `SVC-002` to `MANUSCRIPT`, `INTFMT`, `COVER`, `KDPPREP`, `DELIVERY`
- Now matches what Tally will send in the `services` parameter

### ✅ Added Real Stripe Price IDs
- All services now use actual Stripe Price IDs from your account
- All services priced at $1.00 for MVP testing

### ✅ Improved Success URL
- Success URL now includes both `sid` and `session_id`
- Format: `?sid=abc123&session_id=cs_test_...`
- Makes thank you page easier to build and debug

### ✅ Added Security Improvements
- Maximum services string length: 500 characters
- Maximum SKUs per order: 20
- Automatic duplicate SKU removal
- Submission ID length validation

---

## Current Service Catalog

| SKU | Service Name | Price | Stripe Price ID |
|-----|-------------|-------|-----------------|
| `MANUSCRIPT` | Manuscript Processing | $1.00 | `price_1Sku587uZCk6xNoP3Kmujdxi` |
| `INTFMT` | Interior Formatting | $1.00 | `price_1Sku587uZCk6xNoP3Kmujdxi` |
| `COVER` | Cover Design | $1.00 | `price_1Sku677uZCk6xNoP7kwzbTKE` |
| `KDPPREP` | KDP Upload Preparation | $1.00 | `price_1Sku787uZCk6xNoP7PbsdNnw` |
| `DELIVERY` | Delivery Package | $1.00 | `price_1Sku587uZCk6xNoP3Kmujdxi` |

**Note:** All services are $1.00 for MVP. You'll be the only customer for testing. Update prices in Stripe when ready for production.

---

## API Endpoints

### `GET /health`

Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "ok",
  "service": "pronto-checkout-router",
  "version": "1.0.1",
  "timestamp": "2026-01-04T18:30:00.000Z",
  "services_configured": 5
}
```

### `GET /checkout`

Main checkout endpoint. Receives Tally submission data and redirects to Stripe.

**Query Parameters:**
- `sid` (required): Tally submission ID
- `services` (required): Comma-separated SKUs (e.g., `INTFMT,COVER,KDPPREP`)
- `email` (optional): Customer email to pre-fill in Stripe checkout

**Example Request:**
```
GET /checkout?sid=abc123&services=INTFMT,COVER
```

**Success Response:**
- HTTP 303 redirect to Stripe Checkout URL

**Success URL Format:**
```
https://yourdomain.com/thank-you?sid=abc123&session_id=cs_test_abc123xyz
```

**Error Responses:**
- `400 Bad Request`: Missing or invalid parameters
- `500 Internal Server Error`: Stripe API error or unknown SKU

---

## Testing the Router

### Test 1: Health Check

```bash
curl http://localhost:3000/health
```

Expected response shows version 1.0.1 and 5 services configured.

### Test 2: Single Service

```bash
curl -L "http://localhost:3000/checkout?sid=TEST123&services=INTFMT"
```

Should redirect to Stripe with one $1.00 line item.

### Test 3: Multiple Services

```bash
curl -L "http://localhost:3000/checkout?sid=TEST456&services=INTFMT,COVER,KDPPREP"
```

Should redirect to Stripe with three $1.00 line items (total $3.00).

### Test 4: Duplicate SKUs (Auto-Fixed)

```bash
curl -L "http://localhost:3000/checkout?sid=TEST789&services=INTFMT,INTFMT,COVER"
```

Should automatically deduplicate to `INTFMT,COVER` (two line items, $2.00 total).

### Test 5: Invalid SKU

```bash
curl "http://localhost:3000/checkout?sid=TEST999&services=INVALID"
```

Should return 500 error with message "Unknown service SKU: INVALID".

### Test 6: Verify Metadata in Stripe

After completing a test checkout:
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/payments)
2. Find your test session
3. Verify metadata includes:
   - `project_intake_submission_id: TEST123`
   - `selected_service_skus: INTFMT,COVER`

---

## Tally Configuration

In your Tally form settings:

1. Go to **Settings** → **Redirect on completion**
2. Enable the toggle
3. Set redirect URL to:
   ```
   https://your-router-domain.com/checkout?sid=@SubmissionID&services=@SelectedServicesSKUs
   ```

### Creating the Calculated Field in Tally

1. In your Tally form, type `/calculated`
2. Name it: `SelectedServicesSKUs`
3. Type: `Text`
4. Use conditional logic to build the comma-separated SKU string

**Example output:**
- If Interior Formatting selected: `INTFMT`
- If Interior + Cover selected: `INTFMT,COVER`
- If all services selected: `MANUSCRIPT,INTFMT,COVER,KDPPREP,DELIVERY`

**Important rules:**
- Use the exact SKU names: `MANUSCRIPT`, `INTFMT`, `COVER`, `KDPPREP`, `DELIVERY`
- No spaces in the output
- No trailing comma
- Comma-separated only

---

## Deployment to Railway

### Quick Deploy

1. **Push updated code to GitHub:**
   ```bash
   cd /home/ubuntu/pronto-checkout-router
   git add .
   git commit -m "v1.0.1 - Fixed SKUs, added real Price IDs, improved success URL"
   git push origin main
   ```

2. **Railway auto-deploys** (if connected to GitHub)

3. **Or manually redeploy** in Railway dashboard

### Environment Variables

Make sure these are set in Railway:

```
STRIPE_SECRET_KEY=sk_test_your_test_key_here
SUCCESS_URL=https://yourdomain.com/thank-you
CANCEL_URL=https://yourdomain.com/checkout-cancelled
```

**Note:** For MVP testing with $1.00 prices, use your **test** Stripe key. Switch to production key when ready for real customers.

---

## Testing Checklist (Updated)

### Local Testing

- [ ] Health endpoint returns version 1.0.1
- [ ] Checkout with `INTFMT` redirects to Stripe
- [ ] Checkout with `INTFMT,COVER` shows 2 line items ($2.00 total)
- [ ] Checkout with duplicate SKUs (`INTFMT,INTFMT`) auto-deduplicates
- [ ] Checkout with invalid SKU returns error
- [ ] Stripe session metadata includes correct `sid` and `skus`

### Production Testing

- [ ] Deploy to Railway
- [ ] Health endpoint accessible at public URL
- [ ] Configure Tally redirect URL with correct SKUs
- [ ] Submit test form from Tally
- [ ] Verify redirect to Stripe works
- [ ] Complete test payment (card: 4242 4242 4242 4242)
- [ ] Verify redirect to thank you page with both `sid` and `session_id`
- [ ] Check Stripe dashboard for session metadata
- [ ] Verify Zap 2 marks Services as Paid in Airtable

---

## What Your Partner Was Right About

### 1. SKU Alignment ✅
**Problem:** Router used `SVC-001`, Tally sends `INTFMT`  
**Solution:** Changed all SKUs to match Tally format  
**Impact:** Router now works with Tally without translation layer

### 2. Real Price IDs ✅
**Problem:** `null` prices everywhere  
**Solution:** Added real Stripe Price IDs from your account  
**Impact:** Actual payments can now be processed

### 3. `sid` in Success URL ✅
**Problem:** Thank you page only got `session_id`  
**Solution:** Now passes both `sid` and `session_id`  
**Impact:** Thank you page can show order details without extra API calls

### 4. Nice-to-Haves ✅
**Implemented:**
- Max services length (500 chars) - prevents abuse
- Automatic duplicate SKU removal - prevents charging twice
- Max SKUs per order (20) - prevents abuse
- Submission ID length validation - prevents abuse

---

## Updating Prices Later

When ready to change from $1.00 to real prices:

1. **In Stripe:** Update the Price for each Product (or create new Prices)
2. **In Router:** Update `PRICE_BY_SKU` with new Price IDs
3. **Redeploy:** Push to GitHub or manually redeploy

**No other changes needed.** The SKU → Price mapping is the only thing that changes.

---

## Next Steps

1. ✅ Router updated with correct SKUs and Price IDs
2. ⏭️ Deploy to Railway
3. ⏭️ Test `/health` endpoint
4. ⏭️ Test `/checkout?sid=TEST123&services=INTFMT`
5. ⏭️ Verify Stripe session metadata
6. ⏭️ Configure Tally redirect
7. ⏭️ Test end-to-end flow
8. ⏭️ Build Zap 2 (Stripe webhook → Airtable)

---

**Status:** Ready for deployment with all partner feedback implemented. 🚀
