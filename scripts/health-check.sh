#!/bin/bash
# Health check for Woozy Dashboard services
# Usage: bash scripts/health-check.sh

OK=true

# Check dashboard
if curl -sf -o /dev/null http://localhost:3001 2>/dev/null; then
    echo "✅ Dashboard (port 3001): running"
else
    echo "❌ Dashboard (port 3001): DOWN"
    OK=false
fi

# Check stripe listener
if launchctl list com.woozy.stripe-listener 2>/dev/null | grep -q '"PID"'; then
    echo "✅ Stripe listener: running"
else
    echo "❌ Stripe listener: DOWN"
    OK=false
fi

$OK && echo "All services healthy." || echo "Some services are down!"
$OK
