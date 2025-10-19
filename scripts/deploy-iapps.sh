#!/bin/bash

set -e

echo "🚀 ConFi iApp Deployment Script"
echo "================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parse command line arguments
DEPLOY_INVOICE=false
DEPLOY_PAYROLL=false
INTERACTIVE=true

while [[ $# -gt 0 ]]; do
    case $1 in
        --invoice)
            DEPLOY_INVOICE=true
            INTERACTIVE=false
            shift
            ;;
        --payroll)
            DEPLOY_PAYROLL=true
            INTERACTIVE=false
            shift
            ;;
        --both)
            DEPLOY_INVOICE=true
            DEPLOY_PAYROLL=true
            INTERACTIVE=false
            shift
            ;;
        --help)
            echo "Usage: ./deploy-iapps.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --invoice       Deploy only invoice iApp"
            echo "  --payroll       Deploy only payroll iApp"
            echo "  --both          Deploy both iApps"
            echo "  --help          Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./deploy-iapps.sh                 # Interactive mode"
            echo "  ./deploy-iapps.sh --invoice       # Deploy invoice only"
            echo "  ./deploy-iapps.sh --payroll       # Deploy payroll only"
            echo "  ./deploy-iapps.sh --both          # Deploy both"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Run with --help for usage information"
            exit 1
            ;;
    esac
done

# Interactive mode - ask user what to deploy
if [ "$INTERACTIVE" = true ]; then
    echo -e "${BLUE}What would you like to deploy?${NC}"
    echo "1) Invoice iApp only"
    echo "2) Payroll iApp only"
    echo "3) Both iApps"
    echo ""
    read -p "Enter your choice (1-3): " choice < /dev/tty
    
    case $choice in
        1)
            DEPLOY_INVOICE=true
            ;;
        2)
            DEPLOY_PAYROLL=true
            ;;
        3)
            DEPLOY_INVOICE=true
            DEPLOY_PAYROLL=true
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            exit 1
            ;;
    esac
    echo ""
fi

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not installed${NC}"
    exit 1
fi

if ! command -v iapp &> /dev/null; then
    echo -e "${RED}❌ iApp CLI not installed${NC}"
    echo "Install with: npm install -g @iexec/iapp"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites met${NC}"

# Load environment
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

if [ -z "$DOCKER_USERNAME" ]; then
    echo -e "${YELLOW}⚠️ DOCKER_USERNAME not set${NC}"
    read -p "Enter your DockerHub username: " DOCKER_USERNAME < /dev/tty
fi

cd src/iapp

# Check if app secrets are configured
if [ ! -f iapp.config.json ]; then
    echo -e "${RED}❌ iapp.config.json not found${NC}"
    echo "Run: npm run setup:complete"
    exit 1
fi

echo ""
echo "======================================"
echo -e "${BLUE}Deployment Summary:${NC}"
echo "  Invoice: $([ "$DEPLOY_INVOICE" = true ] && echo "✅ Yes" || echo "⏭️  Skip")"
echo "  Payroll: $([ "$DEPLOY_PAYROLL" = true ] && echo "✅ Yes" || echo "⏭️  Skip")"
echo "======================================"
echo ""

# Deploy Invoice iApp
if [ "$DEPLOY_INVOICE" = true ]; then
    echo ""
    echo "📦 Step 1: Build Invoice iApp"
    echo "------------------------------"
    
    echo "Building invoice processor image..."
    docker build -t ${DOCKER_USERNAME}/confi-invoice:latest -f Dockerfile.invoice . --platform linux/amd64
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Invoice image built${NC}"
    else
        echo -e "${RED}❌ Failed to build invoice image${NC}"
        exit 1
    fi
    
    echo "Pushing invoice image to DockerHub..."
    docker push ${DOCKER_USERNAME}/confi-invoice:latest
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Invoice image pushed${NC}"
    else
        echo -e "${RED}❌ Failed to push invoice image${NC}"
        exit 1
    fi
    
    echo ""
    echo "📝 Step 2: Deploy Invoice iApp"
    echo "--------------------------------"
    
    # Create symlink so iapp can find the Dockerfile
    ln -sf Dockerfile.invoice Dockerfile
    
    echo "Deploying to iExec network..."
    iapp deploy --chain arbitrum-sepolia-testnet
    
    DEPLOY_EXIT_CODE=$?
    
    # Remove symlink
    rm -f Dockerfile
    
    if [ $DEPLOY_EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✅ Invoice iApp deployed${NC}"
        
        # Extract address from the deployment output or cache
        if [ -f "cache/arbitrum-sepolia-testnet/deployments.json" ]; then
            # Try jq first for accurate JSON parsing
            if command -v jq &> /dev/null; then
                INVOICE_ADDRESS=$(jq -r '.[-1].appContractAddress' cache/arbitrum-sepolia-testnet/deployments.json 2>/dev/null)
            else
                # Fallback to grep
                INVOICE_ADDRESS=$(grep -o '"appContractAddress":"0x[a-fA-F0-9]\{40\}"' cache/arbitrum-sepolia-testnet/deployments.json | tail -1 | cut -d'"' -f4)
            fi
            
            if [ ! -z "$INVOICE_ADDRESS" ] && [ "$INVOICE_ADDRESS" != "null" ]; then
                echo -e "${GREEN}Invoice iApp Address: ${INVOICE_ADDRESS}${NC}"
            else
                echo -e "${YELLOW}⚠️  Could not extract address from cache${NC}"
            fi
        fi
    else
        echo -e "${RED}❌ Failed to deploy invoice iApp${NC}"
        rm -f Dockerfile
        exit 1
    fi
fi

# Deploy Payroll iApp
if [ "$DEPLOY_PAYROLL" = true ]; then
    echo ""
    echo "📦 Step 1: Build Payroll iApp"
    echo "------------------------------"
    
    echo "Building payroll processor image..."
    docker build -t ${DOCKER_USERNAME}/confi-payroll:latest -f Dockerfile.payroll . --platform linux/amd64
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Payroll image built${NC}"
    else
        echo -e "${RED}❌ Failed to build payroll image${NC}"
        exit 1
    fi
    
    echo "Pushing payroll image to DockerHub..."
    docker push ${DOCKER_USERNAME}/confi-payroll:latest
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Payroll image pushed${NC}"
    else
        echo -e "${RED}❌ Failed to push payroll image${NC}"
        exit 1
    fi
    
    echo ""
    echo "📝 Step 2: Deploy Payroll iApp"
    echo "--------------------------------"
    
    # Check for payroll config
    if [ ! -f iapp-payroll.config.json ]; then
        echo -e "${RED}❌ iapp-payroll.config.json not found${NC}"
        echo "Run: npm run setup:complete"
        exit 1
    fi
    
    # Swap configs
    mv iapp.config.json iapp.config.invoice.json
    cp iapp-payroll.config.json iapp.config.json
    
    # Create symlink for payroll dockerfile
    ln -sf Dockerfile.payroll Dockerfile
    
    iapp deploy --chain arbitrum-sepolia-testnet
    
    # Remove symlink
    rm -f Dockerfile
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Payroll iApp deployed${NC}"
        
        # Try to extract address
        if [ -f "cache/arbitrum-sepolia-testnet/deployments.json" ]; then
            PAYROLL_ADDRESS=$(cat cache/arbitrum-sepolia-testnet/deployments.json | jq -r '.[-1].appContractAddress' 2>/dev/null || \
                             cat cache/arbitrum-sepolia-testnet/deployments.json | grep -oE '"appContractAddress":"0x[a-fA-F0-9]{40}"' | tail -1 | cut -d'"' -f4)
            
            if [ ! -z "$PAYROLL_ADDRESS" ]; then
                echo -e "${GREEN}Payroll iApp Address: ${PAYROLL_ADDRESS}${NC}"
            fi
        fi
    else
        echo -e "${RED}❌ Failed to deploy payroll iApp${NC}"
        rm -f Dockerfile
    fi
    
    # Restore configs
    mv iapp.config.json iapp-payroll.config.json
    mv iapp.config.invoice.json iapp.config.json
fi

cd ../..

echo ""
echo "======================================"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo ""

if [ ! -z "$INVOICE_ADDRESS" ]; then
    echo -e "${BLUE}Invoice iApp:${NC}"
    echo "  INVOICE_IAPP_ADDRESS=${INVOICE_ADDRESS}"
    echo "  REACT_APP_INVOICE_IAPP_ADDRESS=${INVOICE_ADDRESS}"
    echo ""
fi

if [ ! -z "$PAYROLL_ADDRESS" ]; then
    echo -e "${BLUE}Payroll iApp:${NC}"
    echo "  PAYROLL_IAPP_ADDRESS=${PAYROLL_ADDRESS}"
    echo "  REACT_APP_PAYROLL_IAPP_ADDRESS=${PAYROLL_ADDRESS}"
    echo ""
fi

if [ ! -z "$INVOICE_ADDRESS" ] || [ ! -z "$PAYROLL_ADDRESS" ]; then
    echo -e "${YELLOW}⚠️  Update your .env file with the addresses above${NC}"
    echo ""
fi

echo "Next steps:"
echo "  1. Update .env with the iApp addresses"
echo "  2. Run: npm run init:iapps (to initialize app orders)"
echo "  3. Run: npm run dev (to start the frontend)"
echo ""
echo "View on explorer:"
echo "  https://explorer.iex.ec/arbitrum-sepolia"