# ConFi: Confidential Finance Platform

A privacy-preserving financial operations platform built on iExec's confidential computing infrastructure. ConFi provides enterprise-grade invoicing and payroll capabilities with hardware-enforced confidentiality through Trusted Execution Environments (TEEs).

---

## 🎯 Overview

ConFi is a **fully decentralized alternative to Request.finance** that processes all sensitive financial data within Intel SGX enclaves. Unlike traditional platforms that require trusting a centralized operator with your data, ConFi ensures:

- ✅ **Zero-knowledge processing**: Platform never sees your financial data
- ✅ **Hardware-enforced privacy**: Intel SGX TEE protection
- ✅ **Verifiable computation**: Cryptographic proof of correct execution
- ✅ **On-chain settlement**: Smart contract-based payments
- ✅ **Enterprise features**: QuickBooks/Xero/ADP exports, approval workflows, recurring invoices

### Key Features

| Feature | ConFi | Request.finance | Advantage |
|---------|-------|-----------------|-----------|
| Data Privacy | End-to-end encrypted in TEE | Visible to platform | 100% confidential |
| Trust Model | Hardware + Blockchain | Platform operator | Trustless |
| Gas Optimization | Batch processing (90% savings) | Individual transactions | Cost efficient |
| Accounting Export | QuickBooks, Xero, ADP | Limited | Enterprise ready |
| Open Source | MIT License | Proprietary | Community driven |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend DApp (React)                   │
│          User creates invoices/payroll in browser            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              DataProtector SDK (Client-side)                 │
│   • Encrypts sensitive data (AES-256)                        │
│   • Stores encrypted data on IPFS                            │
│   • Registers ownership on-chain (NFT)                       │
│   • Sets access controls                                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                iExec PoCo Protocol (On-chain)                │
│   • Matches computation orders                              │
│   • Creates secure deal                                      │
│   • Assigns task to TEE-enabled worker                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            iApp Execution (Intel SGX Enclave)                │
│   • Decrypts data inside TEE                                 │
│   • Validates business logic                                 │
│   • Calculates totals                                        │
│   • Generates cryptographically signed voucher               │
│   • Creates accounting exports                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Encrypted Result (IPFS + On-chain)              │
│   • Signed payment voucher                                   │
│   • Accounting export data                                   │
│   • Task completion proof on-chain                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│           Settlement Contract (On-chain Payment)             │
│   • Verifies voucher signature                               │
│   • Executes ERC-20 token transfer                           │
│   • Emits payment event                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Prerequisites

### Required Software
- **Node.js v20+** ([Download](https://nodejs.org))
- **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop))
- **Git** ([Download](https://git-scm.com))
- **MetaMask** browser extension ([Install](https://metamask.io))

### Required Accounts
- **DockerHub account** (free) - [Sign up](https://hub.docker.com/signup)
- **Arbitrum wallet** with funds:
  - **ETH on Arbitrum Sepolia** (testnet) or Arbitrum One (mainnet) for gas
  - **RLC tokens** for computation fees

### Getting Testnet Funds (Arbitrum Sepolia)

1. **Get Arbitrum Sepolia ETH:**
   ```bash
   # Visit the faucet
   open https://faucet.quicknode.com/arbitrum/sepolia
   # Connect MetaMask and request ETH
   ```

2. **Get RLC tokens:**
   ```bash
   # Visit iExec faucet
   open https://explorer.iex.ec/arbitrum-sepolia/faucet
   # Connect MetaMask and claim RLC
   ```

---

## 🚀 Installation & Deployment

### Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-org/confi-platform.git
cd confi-platform

# Install dependencies (this uses the corrected package.json with dataprotector@2.0.0-beta.19)
npm install

# Install iExec CLI tools globally
npm install -g iexec
npm install -g @iexec/iapp
```

### Step 2: Environment Configuration

```bash
# Create environment file
cp .env.example .env

# Edit with your values
nano .env
```

**Required `.env` configuration:**

```bash
# Network Configuration (testnet)
NETWORK=arbitrum-sepolia
RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
CHAIN_ID=421614

# Your deployment wallet private key (NEVER COMMIT THIS)
PRIVATE_KEY=0xYourPrivateKeyHere

# DockerHub credentials (for pushing iApp images)
DOCKER_USERNAME=your_dockerhub_username
DOCKER_PASSWORD=your_dockerhub_password

# These will be populated after deployment
INVOICE_IAPP_ADDRESS=
PAYROLL_IAPP_ADDRESS=
SETTLEMENT_CONTRACT=

# Frontend configuration
REACT_APP_NETWORK=arbitrum-sepolia
REACT_APP_CHAIN_ID=421614
```

**For production (Arbitrum mainnet):**
```bash
NETWORK=arbitrum
RPC_URL=https://arb1.arbitrum.io/rpc
CHAIN_ID=42161
```

### Step 3: Wallet Setup for iExec

```bash
# Option A: Create new wallet
iexec wallet create

# Option B: Import existing wallet
iexec wallet import <your_private_key>

# Verify wallet
iexec wallet show

# Expected output:
# address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0fA9b
# balance: 1.5 ETH | 100 RLC
```

### Step 4: Deploy Smart Contracts

```bash
# Deploy the settlement contract
npm run deploy:contracts

# Example output:
# 🚀 Deploying ConFi Smart Contracts...
# Deploying to arbitrum-sepolia
# Deployer address: 0x742d35Cc...
# Balance: 1.5 ETH
# 
# Deploying ConfidentialFinanceSettlement...
# ✅ Settlement deployed at: 0x1234567890abcdef...
# 
# ✅ Deployment complete!
```

**Update your `.env`:**
```bash
SETTLEMENT_CONTRACT=0x1234567890abcdef...  # Copy from output
```

### Step 5: Build and Deploy iApps

#### 5.1 Login to DockerHub
```bash
# Login to push images
docker login
# Username: your_dockerhub_username
# Password: your_dockerhub_password
```

#### 5.2 Build iApp Docker Images
```bash
# Build Invoice Processor
docker build -t ${DOCKER_USERNAME}/confi-invoice:latest -f src/iapp/Dockerfile.invoice src/iapp

# Build Payroll Processor
docker build -t ${DOCKER_USERNAME}/confi-payroll:latest -f src/iapp/Dockerfile.payroll src/iapp

# Verify images
docker images | grep confi
```

#### 5.3 Push to DockerHub
```bash
docker push ${DOCKER_USERNAME}/confi-invoice:latest
docker push ${DOCKER_USERNAME}/confi-payroll:latest

# Verify on DockerHub
open https://hub.docker.com/u/${DOCKER_USERNAME}
```

#### 5.4 Deploy to iExec Network
```bash
# Navigate to iApp directory
cd src/iapp

# Initialize iApp configuration (one-time)
iapp init

# Deploy Invoice iApp
iapp deploy --chain arbitrum-sepolia

# When prompted, enter:
# - Docker image: your_username/confi-invoice:latest
# - TEE framework: scone (Intel SGX)

# Save the deployed address from output:
# ✅ iApp deployed at: 0xabcdef1234567890...

# Repeat for Payroll iApp
iapp deploy --chain arbitrum-sepolia
# Docker image: your_username/confi-payroll:latest

cd ../..
```

**Update your `.env`:**
```bash
INVOICE_IAPP_ADDRESS=0xabcdef1234567890...  # Invoice iApp
PAYROLL_IAPP_ADDRESS=0xfedcba0987654321...  # Payroll iApp
```

### Step 6: Setup Signing Keys

```bash
# Generate signing keys, push to SMS, authorize in settlement contract
npm run setup:signers

# Example output:
# 🔐 Setting up ConFi Signers...
# 
# Generated Invoice Signer: 0xABCD...
# Generated Payroll Signer: 0xEFGH...
# 
# Pushing secrets to iExec SMS...
# ✅ INVOICE_SIGNING_KEY pushed
# ✅ PAYROLL_SIGNING_KEY pushed
# 
# Authorizing signers in settlement contract...
# ✅ Authorized invoice signer: 0xABCD...
# ✅ Authorized payroll signer: 0xEFGH...
# 
# ✅ Signer setup complete!
```

### Step 7: Publish App Orders

```bash
# Make iApps discoverable on iExec marketplace
npm run publish:orders

# Example output:
# 📤 Publishing iExec Orders...
# 
# Publishing invoice app order...
# ✅ Invoice app order published
# Order hash: 0x123...
# 
# Publishing payroll app order...
# ✅ Payroll app order published
# Order hash: 0x456...
# 
# ✅ All orders published successfully!
```

### Step 8: Verify Deployment

```bash
# Run comprehensive verification
npm run verify

# Example output:
# 🔍 Verifying ConFi Deployment...
# 
# Network: arbitrum-sepolia
# Chain ID: 421614
# 
# Deployed Contracts:
# Settlement Contract: 0x1234...
#   Status: ✅ Deployed
#   Invoice Signer (0xABCD...): ✅
#   Payroll Signer (0xEFGH...): ✅
# 
# iApps:
# Invoice iApp: 0xabcd...
#   Status: ✅ Registered
# Payroll iApp: 0xfedc...
#   Status: ✅ Registered
# 
# ✅ Deployment verification complete!
```

### Step 9: Start Frontend

#### Development Mode
```bash
# Start development server with hot reload
npm run dev

# Access at: http://localhost:3000
```

#### Production Build
```bash
# Build optimized production bundle
npm run build

# Serve locally
npx serve dist -p 3000

# Or deploy to hosting service
vercel deploy dist
# or
netlify deploy --prod --dir=dist
```

---

## 🧪 Testing & Usage

### Test Invoice Creation (CLI)

```bash
node << 'EOF'
const { IExecDataProtector } = require('@iexec/dataprotector');
const { ethers } = require('ethers');

async function testInvoice() {
  // Setup
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const dataProtector = new IExecDataProtector(wallet);
  
  console.log('Creating test invoice...');
  
  // Create invoice data
  const invoice = {
    metadata: {
      invoiceNumber: 'TEST-001',
      paymentTerms: 'NET30',
      currency: 'USDC'
    },
    parties: {
      issuer: {
        address: wallet.address,
        businessName: 'My Company Inc',
        email: 'billing@mycompany.com'
      },
      client: {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0fA9b',
        businessName: 'Client Corp',
        email: 'accounts@client.com'
      }
    },
    lineItems: [{
      description: 'Professional Services - Q4 2024',
      quantity: 1,
      unitPrice: '5000000000', // 5000 USDC (6 decimals)
      taxRate: 0.10 // 10%
    }],
    calculations: {
      subtotal: '5000000000',
      totalTax: '500000000',
      grandTotal: '5500000000'
    },
    payment: {
      tokenContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
      chainId: 421614
    }
  };
  
  // Step 1: Protect data
  console.log('Encrypting invoice data...');
  const { address: protectedDataAddress } = await dataProtector.protectData({
    data: invoice,
    name: 'Test Invoice TEST-001'
  });
  console.log('✅ Protected at:', protectedDataAddress);
  
  // Step 2: Grant access to iApp
  console.log('Granting access to invoice iApp...');
  await dataProtector.grantAccess({
    protectedData: protectedDataAddress,
    authorizedApp: process.env.INVOICE_IAPP_ADDRESS,
    authorizedUser: ethers.ZeroAddress // Anyone can process
  });
  console.log('✅ Access granted');
  
  // Step 3: Process in TEE
  console.log('Starting confidential processing...');
  const { taskId } = await dataProtector.processProtectedData({
    protectedData: protectedDataAddress,
    app: process.env.INVOICE_IAPP_ADDRESS
  });
  console.log('✅ Task started:', taskId);
  console.log('Monitor at: https://explorer.iex.ec/arbitrum-sepolia/' + taskId);
  
  // Step 4: Wait for result (polling)
  console.log('Waiting for task completion (30-90s)...');
  let result = null;
  for (let i = 0; i < 60; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    try {
      result = await dataProtector.getResultFromCompletedTask({ taskId });
      if (result) break;
    } catch (e) {
      if (!e.message.includes('not completed')) throw e;
    }
    process.stdout.write('.');
  }
  
  if (result) {
    console.log('\n✅ Invoice processed successfully!');
    console.log('Voucher:', JSON.stringify(result.voucher, null, 2));
  } else {
    console.log('\n⏱️ Task still processing. Check status later.');
  }
}

testInvoice().catch(console.error);
EOF
```

### Test Payroll Batch (CLI)

```bash
node << 'EOF'
const { IExecDataProtector } = require('@iexec/dataprotector');
const { ethers } = require('ethers');

async function testPayroll() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const dataProtector = new IExecDataProtector(wallet);
  
  console.log('Creating test payroll batch...');
  
  const batch = {
    metadata: {
      batchId: 'BATCH-TEST-001',
      payPeriodStart: Date.now() - (14 * 24 * 60 * 60 * 1000),
      payPeriodEnd: Date.now() - (24 * 60 * 60 * 1000),
      payDate: Date.now() + (24 * 60 * 60 * 1000),
      status: 'APPROVED',
      frequency: 'BIWEEKLY'
    },
    employees: [
      {
        id: 'EMP-001',
        walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0fA9b',
        personalInfo: {
          name: 'John Doe',
          employeeId: 'EMP-001',
          department: 'Engineering'
        },
        compensation: {
          hoursWorked: 80,
          hourlyRate: '50000000', // $50/hr in USDC (6 decimals)
          netPay: '4000000000' // $4000 after deductions
        },
        paymentInfo: {
          tokenContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          chainId: 421614
        }
      },
      {
        id: 'EMP-002',
        walletAddress: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
        personalInfo: {
          name: 'Jane Smith',
          employeeId: 'EMP-002',
          department: 'Marketing'
        },
        compensation: {
          hoursWorked: 80,
          hourlyRate: '45000000',
          netPay: '3600000000'
        },
        paymentInfo: {
          tokenContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          chainId: 421614
        }
      }
    ],
    summary: {
      totalEmployees: 2,
      totalNetPay: '7600000000'
    }
  };
  
  const { address } = await dataProtector.protectData({
    data: batch,
    name: 'Test Payroll Batch'
  });
  console.log('✅ Protected at:', address);
  
  await dataProtector.grantAccess({
    protectedData: address,
    authorizedApp: process.env.PAYROLL_IAPP_ADDRESS,
    authorizedUser: ethers.ZeroAddress
  });
  console.log('✅ Access granted');
  
  const { taskId } = await dataProtector.processProtectedData({
    protectedData: address,
    app: process.env.PAYROLL_IAPP_ADDRESS
  });
  console.log('✅ Processing batch...');
  console.log('Task ID:', taskId);
}

testPayroll().catch(console.error);
EOF
```

### Using the Frontend

1. **Navigate to the app:**
   ```bash
   open http://localhost:3000
   ```

2. **Create an Invoice:**
   - Go to `/invoice`
   - Fill in client details
   - Add line items with descriptions, quantities, prices
   - Click "Create Invoice"
   - Wait for TEE processing (30-60s)
   - Download signed voucher

3. **Process Payroll:**
   - Go to `/payroll`
   - Add employees with wallet addresses
   - Enter hours worked and pay rates
   - Click "Process Payroll Batch"
   - Wait for batch processing
   - Download all vouchers

4. **Claim Payments:**
   - Go to `/claim`
   - Paste voucher JSON
   - Click "Verify and Claim"
   - Approve MetaMask transaction

---

## 📊 Monitoring & Debugging

### Monitor Task Execution

```bash
# Check task status
iexec task show <TASK_ID> --chain arbitrum-sepolia

# Download results
iexec task show <TASK_ID> --download --chain arbitrum-sepolia

# View on Explorer
open https://explorer.iex.ec/arbitrum-sepolia/<TASK_ID>
```

### Debug iApp Locally

```bash
# Create test fixtures
mkdir -p src/iapp/test/fixtures
cat > src/iapp/test/fixtures/protectedData.json << 'EOF'
{
  "recipientAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0fA9b",
  "tokenContract": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "amount": "1000000000"
}
EOF

# Run invoice processor locally
cd src/iapp
mkdir -p test/output

IEXEC_IN=./test/fixtures \
IEXEC_OUT=./test/output \
IEXEC_TASK_ID=test-local-123 \
VOUCHER_SIGNING_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
node invoiceProcessor.js

# Check output
cat test/output/result.json
```

### View Logs

```bash
# iExec worker logs
iexec task show <TASK_ID> --logs

# Docker logs (if running locally)
docker logs <container_id>
```

---

## 🔧 Configuration Reference

### Chain Configuration (`chain.json`)

```json
{
  "default": "arbitrum",
  "chains": {
    "arbitrum": {
      "id": "42161",
      "rpc": "https://arb1.arbitrum.io/rpc",
      "hub": "0x3eca1B216A7DF1C7689aEb259fFB83ADFB894E7f",
      "native": "ETH"
    },
    "arbitrum-sepolia": {
      "id": "421614",
      "rpc": "https://sepolia-rollup.arbitrum.io/rpc",
      "hub": "0xC76A18c78B7e530A165c5683CB1aB134E21938B4",
      "native": "ETH"
    }
  }
}
```

### iExec Order Configuration

Edit `iexec.json` to customize:
- **appprice**: Price in nRLC (0 = free)
- **volume**: Number of executions allowed
- **tag**: TEE requirement (`0x...1` = TEE required)

```json
{
  "order": {
    "apporder": {
      "app": "0xYourAppAddress",
      "appprice": "0",
      "volume": "1000000",
      "tag": "0x0000000000000000000000000000000000000000000000000000000000000001"
    }
  }
}
```

---

## 🚨 Troubleshooting

### Common Issues

#### 1. "No matching version found for @iexec/dataprotector"
**Solution:** Package.json has been updated to use `2.0.0-beta.19`
```bash
rm -rf node_modules package-lock.json
npm install
```

#### 2. "Insufficient RLC balance"
**Solution:** Get more RLC from faucet
```bash
open https://explorer.iex.ec/arbitrum-sepolia/faucet
# Claim RLC tokens (requires testnet ETH for gas)
```

#### 3. "Task timeout" or "Task failed"
**Solution:** Check task on explorer
```bash
open https://explorer.iex.ec/arbitrum-sepolia/<TASK_ID>
```
Common causes:
- Insufficient worker availability (retry later)
- Docker image not accessible (check DockerHub)
- SMS secret not configured (rerun `setup:signers`)

#### 4. "Docker build failed"
**Solution:** Ensure Docker is running
```bash
docker info
# If error, start Docker Desktop
```

#### 5. "Cannot find module '@iexec/dataprotector'"
**Solution:** Reinstall dependencies
```bash
npm install --save-exact @iexec/dataprotector@2.0.0-beta.19
```

#### 6. "Signer not authorized"
**Solution:** Rerun signer setup
```bash
npm run setup:signers
```

#### 7. MetaMask "Wrong network"
**Solution:** Switch to Arbitrum Sepolia
```bash
# Network Details:
# Network Name: Arbitrum Sepolia
# RPC URL: https://sepolia-rollup.arbitrum.io/rpc
# Chain ID: 421614
# Currency Symbol: ETH
# Block Explorer: https://sepolia.arbiscan.io
```

---

## 📖 Documentation

- **iExec Documentation**: https://docs.iex.ec
- **DataProtector Guide**: https://tools.docs.iex.ec/tools/dataProtector
- **iExec Explorer**: https://explorer.iex.ec
- **Arbitrum Docs**: https://docs.arbitrum.io

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Development Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes
# ...

# Run tests
npm test

# Build and verify
npm run build

# Commit with conventional commits
git commit -m "feat: add recurring invoice support"

# Push and create PR
git push origin feature/my-feature
```


## 📄 License

MIT License