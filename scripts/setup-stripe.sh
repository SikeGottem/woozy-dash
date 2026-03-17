#!/bin/bash
# Stripe CLI webhook forwarding for local development
#
# Setup:
#   1. Install Stripe CLI: brew install stripe/stripe-cli/stripe
#   2. Login: stripe login
#   3. Run this script to forward webhooks to your local dashboard
#
# The webhook signing secret will be printed — copy it to .env.local as STRIPE_WEBHOOK_SECRET

echo "Starting Stripe webhook forwarding to localhost:3001..."
echo "Copy the webhook signing secret (whsec_...) to your .env.local"
echo ""

stripe listen --forward-to localhost:3001/api/stripe-webhook
