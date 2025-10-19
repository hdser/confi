#!/bin/bash
# scripts/publish-orders.sh

set -e

echo "📝 Publishing App Orders (One-Time Setup)"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Set app addresses
INVOICE_APP="${INVOICE_IAPP_ADDRESS:-0x1d5078e21cFf8d22D3415C2806aaf5471BF84a09}"
PAYROLL_APP="${PAYROLL_IAPP_ADDRESS:-0xA1956e4Be8F0b5d421c5B8806872b6d109Eec23c}"

echo "Invoice App: $INVOICE_APP"
echo "Payroll App: $PAYROLL_APP"
echo ""

# Navigate to iapp directory where chain.json exists
cd src/iapp

# Check if wallet is configured (it can be in iapp.config.json or in keystore)
echo "🔍 Checking wallet configuration..."
if [ -f "iapp.config.json" ] && grep -q "walletPrivateKey" iapp.config.json; then
    echo -e "${GREEN}✅ Wallet configured in iapp.config.json${NC}"
elif iapp wallet show 2>/dev/null | grep -q "0x"; then
    echo -e "${GREEN}✅ Wallet configured${NC}"
else
    echo -e "${YELLOW}⚠️  Wallet not configured. You may need to import it.${NC}"
    echo "Run from src/iapp directory: iapp wallet import"
    echo "Then run this script again."
    exit 1
fi

echo ""
echo "📊 Checking current orderbook status..."
echo "----------------------------------------"

# Check Invoice App orderbook
echo "Invoice App orderbook:"
if iexec orderbook app $INVOICE_APP 2>&1 | grep -q "No orders"; then
    echo -e "${YELLOW}  No orders found - will publish${NC}"
    INVOICE_NEEDS_ORDER=true
else
    echo -e "${GREEN}  Orders exist${NC}"
    INVOICE_NEEDS_ORDER=false
fi

# Check Payroll App orderbook
echo "Payroll App orderbook:"
if iexec orderbook app $PAYROLL_APP 2>&1 | grep -q "No orders"; then
    echo -e "${YELLOW}  No orders found - will publish${NC}"
    PAYROLL_NEEDS_ORDER=true
else
    echo -e "${GREEN}  Orders exist${NC}"
    PAYROLL_NEEDS_ORDER=false
fi

echo ""

# Publish Invoice App order if needed
if [ "$INVOICE_NEEDS_ORDER" = true ]; then
    echo "📄 Publishing Invoice App Order..."
    echo "-----------------------------------"
    
    if iexec order publish apporder \
        --app $INVOICE_APP \
        --price 0 \
        --volume 10000 \
        --tag tee \
        --force 2>&1; then
        echo -e "${GREEN}✅ Invoice order published successfully!${NC}"
    else
        echo -e "${RED}❌ Failed to publish Invoice order${NC}"
    fi
else
    echo "ℹ️  Skipping Invoice App - order already exists"
fi

echo ""

# Publish Payroll App order if needed
if [ "$PAYROLL_NEEDS_ORDER" = true ]; then
    echo "💼 Publishing Payroll App Order..."
    echo "-----------------------------------"
    
    if iexec order publish apporder \
        --app $PAYROLL_APP \
        --price 0 \
        --volume 10000 \
        --tag tee \
        --force 2>&1; then
        echo -e "${GREEN}✅ Payroll order published successfully!${NC}"
    else
        echo -e "${RED}❌ Failed to publish Payroll order${NC}"
    fi
else
    echo "ℹ️  Skipping Payroll App - order already exists"
fi

echo ""
echo "🔍 Final orderbook verification..."
echo "-----------------------------------"

# Verify Invoice App
echo "Invoice App:"
if iexec orderbook app $INVOICE_APP 2>&1 | grep -q "No orders"; then
    echo -e "${RED}  ❌ Still no orders found${NC}"
else
    echo -e "${GREEN}  ✅ Orders confirmed!${NC}"
fi

# Verify Payroll App
echo "Payroll App:"
if iexec orderbook app $PAYROLL_APP 2>&1 | grep -q "No orders"; then
    echo -e "${RED}  ❌ Still no orders found${NC}"
else
    echo -e "${GREEN}  ✅ Orders confirmed!${NC}"
fi

# Return to root directory
cd ../..

echo ""
echo "========================================="
echo -e "${GREEN}✅ Setup Process Complete!${NC}"
echo "========================================="
echo ""
echo "This was a ONE-TIME setup. You don't need to run this again unless:"
echo "  • You deploy a new version of the iApp"
echo "  • The orders expire (after 10,000 uses)"
echo "  • You want to change the pricing"
echo ""
echo "Your frontend should now work without the 'No App order found' error."
echo "Start your app with: npm run dev"
echo ""

# Check if both apps have orders
if iexec orderbook app $INVOICE_APP 2>&1 | grep -q "No orders" || \
   iexec orderbook app $PAYROLL_APP 2>&1 | grep -q "No orders"; then
    echo -e "${YELLOW}⚠️  Warning: Some orders may not have been published.${NC}"
    echo "If you're still getting errors, try:"
    echo "  1. Make sure you have RLC tokens"
    echo "  2. Check that your wallet owns these apps"
    echo "  3. Try publishing manually through https://protocol.iex.ec/explorer"
fi