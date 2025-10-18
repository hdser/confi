#!/bin/bash

set -e

echo "🚀 ConFi iApp Deployment Script"
echo "================================"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Load environment
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Ensure payroll config exists
if [ ! -f "src/iapp/iapp-payroll.config.json" ]; then
    echo -e "${YELLOW}Running setup to create configs...${NC}"
    node scripts/setup-complete.js
fi

cd src/iapp

# Deploy Invoice iApp
echo "📦 Deploying Invoice Processor..."
echo "---------------------------------"

# Only build if not on DockerHub
if ! docker pull ${DOCKER_USERNAME}/confi-invoice:latest 2>/dev/null; then
    echo "Building invoice image..."
    docker build -t ${DOCKER_USERNAME}/confi-invoice:latest -f Dockerfile.invoice . --platform linux/amd64
    docker push ${DOCKER_USERNAME}/confi-invoice:latest
else
    echo "✓ Using existing invoice image from DockerHub"
fi

echo "Deploying invoice iApp..."
iapp deploy --chain arbitrum-sepolia-testnet

# Get address
if [ -f "cache/arbitrum-sepolia-testnet/deployments.json" ]; then
    INVOICE_ADDRESS=$(cat cache/arbitrum-sepolia-testnet/deployments.json | grep -oE '"app":"0x[a-fA-F0-9]{40}"' | tail -1 | cut -d'"' -f4)
    echo -e "${GREEN}✅ Invoice iApp: ${INVOICE_ADDRESS}${NC}"
fi

# Deploy Payroll
read -p "Deploy Payroll iApp? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "📦 Deploying Payroll Processor..."
    echo "---------------------------------"
    
    # Only build if needed
    if ! docker pull ${DOCKER_USERNAME}/confi-payroll:latest 2>/dev/null; then
        echo "Building payroll image..."
        docker build -t ${DOCKER_USERNAME}/confi-payroll:latest -f Dockerfile.payroll . --platform linux/amd64
        docker push ${DOCKER_USERNAME}/confi-payroll:latest
    else
        echo "✓ Using existing payroll image from DockerHub"
    fi
    
    # Swap configs
    mv iapp.config.json iapp.config.invoice.json
    mv iapp-payroll.config.json iapp.config.json
    
    echo "Deploying payroll iApp..."
    iapp deploy --chain arbitrum-sepolia-testnet
    
    # Get address
    PAYROLL_ADDRESS=$(cat cache/arbitrum-sepolia-testnet/deployments.json | grep -oE '"app":"0x[a-fA-F0-9]{40}"' | tail -1 | cut -d'"' -f4)
    
    # Restore config
    mv iapp.config.json iapp-payroll.config.json
    mv iapp.config.invoice.json iapp.config.json
    
    echo -e "${GREEN}✅ Payroll iApp: ${PAYROLL_ADDRESS}${NC}"
fi

cd ../..

echo ""
echo "================================"
echo "Update your .env:"
echo "INVOICE_IAPP_ADDRESS=${INVOICE_ADDRESS}"
echo "PAYROLL_IAPP_ADDRESS=${PAYROLL_ADDRESS}"