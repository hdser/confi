#!/bin/bash

set -e

echo "🚀 ConFi iApp Order Initialization"
echo "==================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check prerequisites
if ! command -v iapp &> /dev/null; then
    echo -e "${RED}❌ iApp CLI not installed${NC}"
    echo "Install with: npm install -g @iexec/iapp"
    exit 1
fi

# Load environment
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check if iApps are deployed
if [ -z "$INVOICE_IAPP_ADDRESS" ] || [ -z "$PAYROLL_IAPP_ADDRESS" ]; then
    echo -e "${RED}❌ iApp addresses not found in .env${NC}"
    echo ""
    echo "Please set these in your .env file:"
    echo "INVOICE_IAPP_ADDRESS=0x..."
    echo "PAYROLL_IAPP_ADDRESS=0x..."
    echo ""
    echo "Run: npm run deploy:iapps first"
    exit 1
fi

cd src/iapp

echo "📋 Invoice iApp: $INVOICE_IAPP_ADDRESS"
echo "📋 Payroll iApp: $PAYROLL_IAPP_ADDRESS"
echo ""

# Check if orders already exist
echo "🔍 Checking for existing orders..."
echo ""

INVOICE_HAS_ORDER=false
PAYROLL_HAS_ORDER=false

# Check if runs.json exists and has entries
if [ -f "cache/arbitrum-sepolia-testnet/runs.json" ]; then
    INVOICE_RUNS=$(cat cache/arbitrum-sepolia-testnet/runs.json | grep -c "$INVOICE_IAPP_ADDRESS" || echo "0")
    if [ "$INVOICE_RUNS" -gt 0 ]; then
        INVOICE_HAS_ORDER=true
        echo -e "${GREEN}✅ Invoice iApp already has orders${NC}"
    fi
fi

echo ""
echo "📤 Initializing Invoice iApp Order"
echo "-----------------------------------"

if [ "$INVOICE_HAS_ORDER" = false ]; then
    echo "Running invoice iApp to create app order..."
    echo "(This will create the order and execute a test task)"
    echo ""
    
    iapp run "$INVOICE_IAPP_ADDRESS" --chain arbitrum-sepolia-testnet
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Invoice app order created${NC}"
    else
        echo -e "${RED}❌ Failed to create invoice app order${NC}"
        echo "Check if you have enough RLC: https://explorer.iex.ec/arbitrum-sepolia/faucet"
        cd ../..
        exit 1
    fi
else
    echo -e "${YELLOW}⏭️  Skipping - order already exists${NC}"
fi

echo ""
echo "📤 Initializing Payroll iApp Order"
echo "-----------------------------------"

# Swap to payroll config
if [ -f "iapp-payroll.config.json" ]; then
    echo "Switching to payroll configuration..."
    mv iapp.config.json iapp.config.invoice.json
    cp iapp-payroll.config.json iapp.config.json
fi

if [ "$PAYROLL_HAS_ORDER" = false ]; then
    echo "Running payroll iApp to create app order..."
    echo "(This will create the order and execute a test task)"
    echo ""
    
    iapp run "$PAYROLL_IAPP_ADDRESS" --chain arbitrum-sepolia-testnet
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Payroll app order created${NC}"
    else
        echo -e "${RED}❌ Failed to create payroll app order${NC}"
        echo "Check if you have enough RLC: https://explorer.iex.ec/arbitrum-sepolia/faucet"
    fi
else
    echo -e "${YELLOW}⏭️  Skipping - order already exists${NC}"
fi

# Restore config
if [ -f "iapp.config.invoice.json" ]; then
    mv iapp.config.json iapp-payroll.config.json
    mv iapp.config.invoice.json iapp.config.json
fi

cd ../..

echo ""
echo "======================================"
echo -e "${GREEN}✅ iApp orders initialized!${NC}"
echo ""
echo "Your iApps are now ready to use."
echo "Restart your frontend: npm run dev"
echo ""
echo "Check your tasks:"
echo "https://explorer.iex.ec/arbitrum-sepolia"