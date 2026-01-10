import express from 'express';
import Stripe from 'stripe';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

// Rate limiter to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many checkout requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// SKU to Stripe Price ID mapping
const PRICE_BY_SKU = {
  'INTFMT': 'price_1Sku587uZCk6xNoP3Kmujdxi',     // Interior Formatting - $1.00
  'COVER': 'price_1Sku677uZCk6xNoP7kwzbTKE',      // Cover Design - $1.00
  'KDPPREP': 'price_1Sku787uZCk6xNoP7PbsdNnw',    // KDP Upload Preparation - $1.00
};

// Human-readable service names for logging
const SERVICE_NAMES = {
  'INTFMT': 'Interior Formatting',
  'COVER': 'Cover Design',
  'KDPPREP': 'KDP Upload Preparation',
};

// Configuration
const MAX_SERVICES_LENGTH = 500; // Prevent abuse with extremely long service strings
const MAX_SKUS = 20; // Maximum number of services in one order

/**
 * Parse and validate SKUs from the services query parameter
 * Handles both SKU format (INTFMT) and display text format (Interior Formatting — $149)
 * Uses fuzzy matching to handle variations in spacing, pricing, etc.
 * @param {string} servicesParam - Comma-separated SKUs or display text from Tally
 * @returns {string[]} - Array of validated, uppercase, deduplicated SKUs
 */
function parseSkus(servicesParam) {
  if (!servicesParam) return [];
  
  // Validate length to prevent abuse
  if (servicesParam.length > MAX_SERVICES_LENGTH) {
    throw new Error(`Services parameter too long (max ${MAX_SERVICES_LENGTH} characters)`);
  }
  
  const rawServices = servicesParam
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  
  console.log(`[CHECKOUT] Raw services after split: ${JSON.stringify(rawServices)}`);
  console.log(`[CHECKOUT] Number of services: ${rawServices.length}`);
  
  // Convert each service to SKU format
  const skus = rawServices.map(service => {
    console.log(`[CHECKOUT] Processing service: "${service}"`);
    
    // First check if it's already a SKU (uppercase alphanumeric)
    const upperService = service.toUpperCase();
    if (upperService in PRICE_BY_SKU) {
      console.log(`[CHECKOUT] ✓ Matched SKU directly: ${service} → ${upperService}`);
      return upperService;
    }
    
    // Normalize the service string for fuzzy matching:
    // - Collapse multiple spaces into one
    // - Convert to lowercase
    // - Trim whitespace
    const normalized = service.replace(/\s+/g, ' ').trim().toLowerCase();
    console.log(`[CHECKOUT] Normalized: "${normalized}"`);
    
    // Fuzzy match: check if normalized string starts with known service names
    if (normalized.startsWith('interior formatting')) {
      console.log(`[CHECKOUT] ✓ Matched "Interior Formatting" (fuzzy): "${service}" → INTFMT`);
      return 'INTFMT';
    }
    
    if (normalized.startsWith('cover design')) {
      console.log(`[CHECKOUT] ✓ Matched "Cover Design" (fuzzy): "${service}" → COVER`);
      return 'COVER';
    }
    
    if (normalized.startsWith('kdp upload preparation')) {
      console.log(`[CHECKOUT] ✓ Matched "KDP Upload Preparation" (fuzzy): "${service}" → KDPPREP`);
      return 'KDPPREP';
    }
    
    // If we can't map it, throw an error with helpful message
    console.error(`[CHECKOUT] ❌ Unknown service: "${service}"`);
    console.error(`[CHECKOUT] Normalized: "${normalized}"`);
    console.error(`[CHECKOUT] Expected service names to start with:`);
    console.error(`[CHECKOUT]   - "interior formatting"`);
    console.error(`[CHECKOUT]   - "cover design"`);
    console.error(`[CHECKOUT]   - "kdp upload preparation"`);
    throw new Error(`Unknown service: ${service}`);
  });
  
  // Remove duplicates (using Set)
  const uniqueSkus = [...new Set(skus)];
  
  // Log if duplicates were found
  if (uniqueSkus.length < skus.length) {
    console.log(`[CHECKOUT] Removed ${skus.length - uniqueSkus.length} duplicate SKU(s)`);
  }
  
  // Validate count
  if (uniqueSkus.length > MAX_SKUS) {
    throw new Error(`Too many services (max ${MAX_SKUS} per order)`);
  }
  
  return uniqueSkus;
}

/**
 * Build Stripe line items from SKUs
 * @param {string[]} skus - Array of service SKUs
 * @returns {object[]} - Array of Stripe line item objects
 * @throws {Error} - If unknown SKU is encountered
 */
function buildLineItems(skus) {
  const lineItems = [];
  
  for (const sku of skus) {
    // Check if SKU exists in our mapping
    if (!(sku in PRICE_BY_SKU)) {
      throw new Error(`Unknown service SKU: ${sku}`);
    }
    
    const priceId = PRICE_BY_SKU[sku];
    
    // All services are paid for MVP ($1.00 each)
    if (!priceId) {
      console.log(`[CHECKOUT] Warning: No price ID for SKU: ${sku}`);
      continue;
    }
    
    lineItems.push({
      price: priceId,
      quantity: 1,
    });
    
    console.log(`[CHECKOUT] Added line item: ${sku} (${SERVICE_NAMES[sku] || 'Unknown'})`);
  }
  
  return lineItems;
}

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'pronto-checkout-router',
    version: '1.2.0',
    timestamp: new Date().toISOString(),
    services_configured: Object.keys(PRICE_BY_SKU).length,
    accepts_display_text: true,
    fuzzy_matching: true,
  });
});

/**
 * Main checkout endpoint
 * Receives Tally submission data and redirects to Stripe Checkout
 */
app.get('/checkout', limiter, async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Extract and validate query parameters
    const sid = String(req.query.sid || '').trim();
    const services = String(req.query.services || '').trim();
    const email = req.query.email ? String(req.query.email).trim() : null;
    
    console.log(`[CHECKOUT] ========================================`);
    console.log(`[CHECKOUT] New checkout request`);
    console.log(`[CHECKOUT] Submission ID: ${sid}`);
    console.log(`[CHECKOUT] Services (raw): "${services}"`);
    console.log(`[CHECKOUT] Services length: ${services.length}`);
    console.log(`[CHECKOUT] Services type: ${typeof services}`);
    console.log(`[CHECKOUT] Services char codes:`, [...services].map(c => c.charCodeAt(0)).join(','));
    console.log(`[CHECKOUT] Email: ${email || 'not provided'}`);
    
    // Validate submission ID
    if (!sid) {
      console.error('[CHECKOUT] Error: Missing submission ID');
      return res.status(400).send('Missing submission ID (sid parameter)');
    }
    
    // Validate sid length (prevent abuse)
    if (sid.length > 200) {
      console.error('[CHECKOUT] Error: Submission ID too long');
      return res.status(400).send('Invalid submission ID');
    }
    
    // Parse and validate SKUs (includes deduplication and fuzzy matching)
    const skus = parseSkus(services);
    if (skus.length === 0) {
      console.error('[CHECKOUT] Error: No services selected');
      return res.status(400).send('No services selected');
    }
    
    console.log(`[CHECKOUT] Parsed SKUs: ${skus.join(', ')}`);
    
    // Build line items (this will throw if unknown SKU)
    const lineItems = buildLineItems(skus);
    
    // Check if there are any paid services
    if (lineItems.length === 0) {
      console.log('[CHECKOUT] All selected services are free - redirecting to thank you page');
      
      // If all services are free, redirect directly to thank you page
      const thankYouUrl = `${process.env.SUCCESS_URL}?sid=${encodeURIComponent(sid)}&free=true`;
      return res.redirect(303, thankYouUrl);
    }
    
    console.log(`[CHECKOUT] Creating Stripe session with ${lineItems.length} paid line items`);
    
    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      // Include both sid and Stripe's session_id in success URL
      success_url: `${process.env.SUCCESS_URL}?sid=${encodeURIComponent(sid)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CANCEL_URL}?sid=${encodeURIComponent(sid)}`,
      metadata: {
        project_intake_submission_id: sid,
        selected_service_skus: skus.join(','),
      },
      // Pre-fill customer email if passed from Tally
      ...(email && { customer_email: email }),
    });
    
    const duration = Date.now() - startTime;
    console.log(`[CHECKOUT] ✅ Success - Session created: ${session.id} (${duration}ms)`);
    console.log(`[CHECKOUT] Metadata: sid=${sid}, skus=${skus.join(',')}`);
    console.log(`[CHECKOUT] Redirecting to Stripe: ${session.url}`);
    console.log(`[CHECKOUT] ========================================`);
    
    // 303 redirect to Stripe Checkout
    return res.redirect(303, session.url);
    
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`[CHECKOUT] ❌ Error after ${duration}ms:`, err.message);
    console.error(err.stack);
    console.log(`[CHECKOUT] ========================================`);
    
    // Send user-friendly error message
    return res.status(500).send(
      'Failed to start checkout. Please try again or contact support if the problem persists.'
    );
  }
});

/**
 * Catch-all for undefined routes
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    availableEndpoints: ['/health', '/checkout'],
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Pronto Checkout Router v1.2.0 running on port ${PORT}`);
  console.log(`📋 Service Catalog loaded with ${Object.keys(PRICE_BY_SKU).length} services`);
  console.log(`🔒 Rate limiting enabled: 100 requests per 15 minutes per IP`);
  console.log(`✅ Ready to accept checkout requests`);
  console.log(`🔍 Fuzzy matching enabled for service names`);
  console.log(`\nConfigured services:`);
  Object.keys(PRICE_BY_SKU).forEach(sku => {
    console.log(`  - ${sku}: ${SERVICE_NAMES[sku] || 'Unknown'}`);
  });
});
