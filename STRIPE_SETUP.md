# Stripe Subscription Setup Guide

## Overview
This guide will help you set up Stripe subscription products and prices for CryptoHobby's three-tier membership system.

---

## Step 1: Create Products in Stripe Dashboard

1. Go to **Stripe Dashboard** → [Product Catalog](https://dashboard.stripe.com/products)
2. Create three products:

### Product 1: Basic Plan
- **Name**: CryptoHobby Basic
- **Description**: Paper trading with basic scanning and charts
- **Pricing Model**: Standard pricing
- **Price**: $9.00 USD
- **Billing Period**: Monthly (recurring)
- Click **Add product**
- **Copy the Price ID** (format: `price_xxxxx`) - you'll need this!

### Product 2: Pro Plan
- **Name**: CryptoHobby Pro  
- **Description**: Advanced ML patterns, real-time alerts, and CLI access
- **Pricing Model**: Standard pricing
- **Price**: $29.00 USD
- **Billing Period**: Monthly (recurring)
- Click **Add product**
- **Copy the Price ID** (format: `price_xxxxx`) - you'll need this!

### Product 3: Enterprise Plan
- **Name**: CryptoHobby Enterprise
- **Description**: Unlimited scanning, custom ML, API access, and dedicated support
- **Pricing Model**: Standard pricing  
- **Price**: $99.00 USD
- **Billing Period**: Monthly (recurring)
- Click **Add product**
- **Copy the Price ID** (format: `price_xxxxx`) - you'll need this!

---

## Step 2: Configure Price IDs as Environment Variables

For security, Stripe Price IDs are stored in environment variables (not in code). Once you have the three Price IDs from Stripe, add them to your Replit Secrets:

1. Go to **Replit** → **Tools** → **Secrets**
2. Add these three secrets:
   - **STRIPE_PRICE_BASIC** = `price_xxxxx` (your Basic plan Price ID)
   - **STRIPE_PRICE_PRO** = `price_xxxxx` (your Pro plan Price ID)
   - **STRIPE_PRICE_ENTERPRISE** = `price_xxxxx` (your Enterprise plan Price ID)

The backend automatically maps plans to prices using these environment variables:
```typescript
// Server-side mapping (in server/routes.ts)
const PLAN_PRICE_MAPPING = {
  'basic': process.env.STRIPE_PRICE_BASIC,
  'pro': process.env.STRIPE_PRICE_PRO,
  'enterprise': process.env.STRIPE_PRICE_ENTERPRISE,
};
```

**Security Note**: Price IDs are validated server-side to prevent price manipulation attacks.

---

## Step 3: Test the Integration

### Test Mode (Recommended First)
1. Use Stripe **test mode** keys initially
2. Test the subscription flow:
   - Click a plan in the subscription modal
   - Complete checkout with Stripe test card: `4242 4242 4242 4242`
   - Verify successful subscription creation
   - Check webhook handling (if configured)

### Production Mode
1. Switch to **live mode** in Stripe Dashboard
2. Copy your **live API keys**
3. Update Replit secrets with live keys:
   - `STRIPE_SECRET_KEY` (starts with `sk_live_`)
   - `VITE_STRIPE_PUBLIC_KEY` (starts with `pk_live_`)
4. Re-deploy the application

---

## Step 4: Configure Webhooks (Optional but Recommended)

For production deployments, set up webhooks to handle subscription events:

1. Go to **Stripe Dashboard** → [Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. **Endpoint URL**: `https://your-replit-domain.replit.app/api/stripe/webhook`
4. **Events to send**:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the **Signing Secret** (starts with `whsec_`)
6. Add to Replit secrets as `STRIPE_WEBHOOK_SECRET`

---

## Step 5: Subscription Features by Plan

### Basic Plan ($9/month)
- Basic token scanning (limited to 50 tokens)
- Paper trading with $10,000 virtual capital
- Basic charts and indicators
- Email support

### Pro Plan ($29/month)
- Advanced token scanning (100+ tokens)
- AI/ML pattern recognition
- Real-time price alerts
- Advanced charting tools
- CLI terminal access
- Priority support

### Enterprise Plan ($99/month)
- Unlimited token scanning
- Custom ML model training
- Full API access for integration
- Real money trading capabilities (requires broker API keys)
- White-label options
- Dedicated account manager
- 24/7 support

---

## Implementation Details

### Checkout Flow
1. User clicks "Choose Plan" button
2. Frontend calls `/api/create-checkout-session` with plan and price ID
3. Backend creates Stripe Checkout Session
4. User redirected to Stripe-hosted checkout page
5. User completes payment
6. Stripe redirects back to app with `session_id`
7. Frontend calls `/api/create-subscription` to finalize
8. Subscription activated in database

### Access Control
Real money trading is only enabled for:
- Users with **Enterprise plan** subscription
- Active subscription status
- Verified broker API keys configured
- Explicit user confirmation for real money mode

---

## Troubleshooting

### Issue: "Price ID not found"
**Solution**: Verify you copied the correct Price ID from Stripe Dashboard (starts with `price_`)

### Issue: "Invalid API key"
**Solution**: Check that:
1. Stripe secret key is correctly set in Replit secrets
2. You're using the right mode (test vs live)
3. Key starts with `sk_test_` or `sk_live_`

### Issue: "Payment not completing"
**Solution**: 
1. Check browser console for errors
2. Verify CSRF token is being sent
3. Ensure success_url and cancel_url are correct

---

## Security Best Practices

✅ **Never** expose your Stripe Secret Key in frontend code  
✅ **Always** use CSRF protection for payment endpoints  
✅ **Validate** webhook signatures before processing events  
✅ **Use** Stripe-hosted checkout for PCI compliance  
✅ **Enable** Stripe Radar for fraud detection  
✅ **Monitor** failed payments and retry logic  

---

## Next Steps

1. Create products in Stripe Dashboard
2. Update price IDs in code
3. Test in test mode
4. Switch to live mode when ready
5. Set up webhooks for production
6. Monitor subscriptions in Stripe Dashboard

---

**Need Help?**
- [Stripe Documentation](https://docs.stripe.com/billing/subscriptions)
- [Stripe Support](https://support.stripe.com/)
- CryptoHobby Support: support@cryptohobby.com
