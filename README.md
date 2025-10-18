# ConFi: Confidential Finance Platform

Privacy-preserving invoice and payroll processing platform built on iExec's confidential computing infrastructure. ConFi processes sensitive financial data inside Intel SGX enclaves, ensuring complete privacy while enabling on-chain settlement.

## 🏗️ System Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   Frontend  │────▶│DataProtector │────▶│  TEE iApp   │────▶│  Settlement  │
│   (React)   │     │  (Encrypt)   │     │  (Process)  │     │  (Contract)  │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
      User              Client-side         Intel SGX          On-chain
    Interface           Encryption          Enclave            Payment
```

## 🚀 Quick Start

### Prerequisites

- **Node.js v20+** ([Download](https://nodejs.org))
- **Docker Desktop** ([Download](https://docker.com/products/docker-desktop)) - Must be running
- **MetaMask** browser extension ([Install](https://metamask.io))
- **iApp CLI**: `npm install -g @iexec/iapp`
- **Arbitrum Sepolia ETH** ([Faucet](https://faucet.quicknode.com/arbitrum/sepolia))
- **RLC Tokens** ([iExec Faucet](https://explorer.iex.ec/arbitrum-sepolia/faucet))
- **DockerHub Account** ([Sign up](https://hub.docker.com))

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/confi-platform.git
cd confi-platform

# Install dependencies
npm install

# Install iApp CLI globally
npm install -g @iexec/iapp

# Create environment configuration
cp .env.example .env
# Edit .env with your configuration (see Environment Setup below)
```

## 📋 Complete Deployment Workflow

### Step 1: Environment Setup

Create `.env` file with the following:

```bash
# Network Configuration
NETWORK=arbitrum-sepolia
RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
CHAIN_ID=421614

# Your wallet private key (NEVER commit this)
PRIVATE_KEY=0xYourPrivateKeyHere

# Will be populated during deployment
SETTLEMENT_CONTRACT=
INVOICE_IAPP_ADDRESS=
PAYROLL_IAPP_ADDRESS=

# DockerHub credentials
DOCKER_USERNAME=your-dockerhub-username

# Frontend configuration (duplicate values for React)
REACT_APP_NETWORK=arbitrum-sepolia
REACT_APP_CHAIN_ID=421614
REACT_APP_SETTLEMENT_CONTRACT=
REACT_APP_INVOICE_IAPP_ADDRESS=
REACT_APP_PAYROLL_IAPP_ADDRESS=
```

### Step 2: Deploy Settlement Contract

```bash
# Deploy the settlement smart contract
npm run deploy:contracts

# Output example:
# ✅ Settlement deployed at: 0x996b21dB6deD9D7D763C98d64EA536cf51061887
# 
# Update your .env file with the contract address
```

### Step 3: Complete Setup (Keys & Configuration)

```bash
# This script will:
# 1. Generate signing keys for TEE vouchers
# 2. Configure app secrets in iapp.config.json
# 3. Authorize signers in the settlement contract
npm run setup:complete

# Output:
# ✅ Keys generated and saved to signing-keys.json
# ✅ App secrets configured in iapp.config.json
# ✅ Signers authorized in settlement contract
```

### Step 4: Deploy iApps

```bash
# Option 1: Deploy using the automated script
npm run deploy:iapps

# Option 2: Deploy manually
cd src/iapp

# Deploy invoice processor
docker build -t ${DOCKER_USERNAME}/confi-invoice:latest -f Dockerfile.invoice . --platform linux/amd64
docker push ${DOCKER_USERNAME}/confi-invoice:latest
iapp deploy --chain arbitrum-sepolia-testnet

# Deploy payroll processor (using separate config)
docker build -t ${DOCKER_USERNAME}/confi-payroll:latest -f Dockerfile.payroll . --platform linux/amd64
docker push ${DOCKER_USERNAME}/confi-payroll:latest
iapp deploy --chain arbitrum-sepolia-testnet --config iapp-payroll.config.json

cd ../..
```

### Step 5: Update Environment with Deployed Addresses

After deployment, update your `.env` file:

```bash
# Add the deployed iApp addresses
INVOICE_IAPP_ADDRESS=0x2E7C6b329f2F96c8ee2D915Bd1f50370d84604C5
PAYROLL_IAPP_ADDRESS=0xYourPayrollAppAddress

# Also update React app environment
REACT_APP_SETTLEMENT_CONTRACT=0x996b21dB6deD9D7D763C98d64EA536cf51061887
REACT_APP_INVOICE_IAPP_ADDRESS=0x2E7C6b329f2F96c8ee2D915Bd1f50370d84604C5
REACT_APP_PAYROLL_IAPP_ADDRESS=0xYourPayrollAppAddress
```

### Step 6: Start Frontend Application

```bash
# Development mode with hot reload
npm run dev
# Access at http://localhost:3000

# Production build
npm run build
npm run start
```

## 💼 How ConFi Works

### Invoice Processing Flow

1. **Create Invoice**: User enters invoice details in web form
2. **Encrypt Data**: DataProtector encrypts all sensitive data client-side
3. **Grant Access**: Encrypted data access granted to TEE iApp
4. **TEE Processing**: iApp decrypts data inside Intel SGX, validates, and signs voucher
5. **Return Voucher**: Cryptographically signed payment authorization returned
6. **Claim Payment**: Submit voucher to settlement contract for automatic payment

### Payroll Processing Flow

1. **Create Batch**: HR prepares employee payment batch
2. **Encrypt Batch**: All employee data encrypted together
3. **TEE Processing**: Batch processing inside secure enclave
4. **Batch Voucher**: Single voucher for all payments
5. **Execute Payments**: One transaction processes all employee payments

### Technical Flow Example

```javascript
// 1. User creates invoice
const invoiceData = {
  recipientAddress: "0x123...",
  amount: "1000000000", // USDC with 6 decimals
  invoiceNumber: "INV-001",
  dueDate: "2024-12-31"
};

// 2. Encrypt with DataProtector
const protectedData = await dataProtector.protectData({
  data: invoiceData,
  name: "Invoice-001"
});

// 3. Process in TEE
const result = await dataProtector.processProtectedData({
  protectedData: protectedData.address,
  app: INVOICE_IAPP_ADDRESS
});

// 4. Get signed voucher
const voucher = await getResult(result.taskId);

// 5. Claim payment on-chain
await settlementContract.claimVoucher(voucher);
```

## 📁 Project Structure

```
confi-platform/
├── contracts/                     # Smart contracts
│   └── ConfidentialFinanceSettlement.sol
├── src/
│   ├── iapp/                     # TEE applications
│   │   ├── invoiceProcessor.js  # Invoice processing logic
│   │   ├── payrollProcessor.js  # Payroll batch processing
│   │   ├── Dockerfile.invoice   # Invoice container config
│   │   ├── Dockerfile.payroll   # Payroll container config
│   │   ├── iapp.config.json     # iApp configuration
│   │   └── cache/               # Deployment artifacts
│   ├── frontend/                 # React application
│   │   ├── components/          # UI components
│   │   │   ├── InvoiceCreation.jsx
│   │   │   ├── PayrollDashboard.jsx
│   │   │   ├── VoucherClaim.jsx
│   │   │   └── Navigation.jsx
│   │   ├── hooks/              # Custom React hooks
│   │   │   ├── useDataProtector.js
│   │   │   └── useSettlement.js
│   │   └── styles/             # CSS styles
│   └── sdk/                    # JavaScript SDK
│       ├── ConFiClient.js      # Main SDK client
│       └── types.d.ts          # TypeScript definitions
├── scripts/                     # Deployment & setup scripts
│   ├── deploy-contracts.js     # Smart contract deployment
│   ├── setup-complete.js       # Complete setup automation
│   ├── deploy-iapps-fixed.sh   # iApp deployment script
│   └── verify-deployment.js    # Deployment verification
├── deployed.json               # Deployment tracking
├── signing-keys.json          # Generated keys (DO NOT COMMIT)
├── .env                       # Environment variables (DO NOT COMMIT)
├── package.json               # Node dependencies
└── README.md                  # This file
```

## 🔧 Available Scripts

```bash
# Development
npm run dev                    # Start development server
npm run build                 # Build for production
npm test                      # Run test suite

# Deployment
npm run deploy:contracts      # Deploy settlement contract
npm run setup:complete        # Generate keys and configure
npm run deploy:iapps         # Deploy TEE applications

# Utilities
npm run verify               # Verify deployment status
npm run clean               # Clean build artifacts
```

## 🧪 Testing

### Test iApp Locally

```bash
cd src/iapp

# Basic test (will show if configuration is correct)
iapp test

# Test with mock signing key
VOUCHER_SIGNING_KEY=0xTestKey123 node invoiceProcessor.js
```

### Verify Smart Contract

```bash
# Check if signer is authorized
cast call $SETTLEMENT_CONTRACT \
  "authorizedSigners(address)(bool)" \
  $(cat signing-keys.json | jq -r .invoice.address) \
  --rpc-url $RPC_URL

# Expected output: true
```

### Test Frontend

1. Start development server: `npm run dev`
2. Open browser: `http://localhost:3000`
3. Connect MetaMask to Arbitrum Sepolia
4. Create test invoice
5. Monitor task: `https://explorer.iex.ec/arbitrum-sepolia/<taskId>`

## 🚨 Troubleshooting

### Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| `VOUCHER_SIGNING_KEY not found` | App secret not configured | Run `npm run setup:complete` and redeploy |
| `Invalid signer` | Signer not authorized in contract | Run `npm run setup:complete` |
| `Unknown argument: app-secret` | Incorrect CLI usage | App secrets must be in `iapp.config.json` |
| `dataProtector.protectData is not a function` | DataProtector not initialized | Check MetaMask connection |
| `Insufficient balance` | No ETH or RLC | Get from testnet faucets |
| `Platform warning` in Docker | ARM vs x86 architecture | Add `--platform linux/amd64` to docker build |
| `Task timeout` | Processing taking too long | Check task on iExec Explorer |
| `No wallet found` | Missing wallet configuration | Run `iapp wallet import` with your private key |

### Debug Commands

```bash
# View iApp deployment history
cat src/iapp/cache/arbitrum-sepolia-testnet/deployments.json

# Check signing keys (contains private keys - be careful!)
cat signing-keys.json

# Monitor task execution
iexec task show <TASK_ID> --chain arbitrum-sepolia

# View task logs
iexec task show <TASK_ID> --logs --chain arbitrum-sepolia

# Download task results
iexec task show <TASK_ID> --download --chain arbitrum-sepolia
```

## 📊 Current Deployment Status

### Arbitrum Sepolia Testnet

| Component | Address | Status |
|-----------|---------|--------|
| Settlement Contract | `0x996b21dB6deD9D7D763C98d64EA536cf51061887` | ✅ Deployed |
| Invoice iApp | `0x2E7C6b329f2F96c8ee2D915Bd1f50370d84604C5` | ✅ Deployed |
| Payroll iApp | `[Pending Deployment]` | ⏳ Pending |

### Docker Images

- Invoice Processor: `hugser/confi-invoice:latest`
- Payroll Processor: `hugser/confi-payroll:latest`

## 🔐 Security Considerations

1. **Never commit private keys**: Add `signing-keys.json` and `.env` to `.gitignore`
2. **Use hardware wallets** for production deployments
3. **Audit smart contracts** before mainnet deployment
4. **Rotate signing keys** periodically
5. **Monitor gas prices** for optimal transaction timing
6. **Verify all addresses** before sending transactions

## 🔗 Resources

- [iExec Explorer](https://explorer.iex.ec/arbitrum-sepolia) - Monitor tasks and transactions
- [iApp Generator Documentation](https://tools.docs.iex.ec/tools/iapp-generator) - iApp development guide
- [DataProtector SDK](https://tools.docs.iex.ec/tools/dataProtector) - Data encryption documentation
- [iExec Protocol Documentation](https://protocol.docs.iex.ec) - Protocol details
- [Arbitrum Sepolia Faucet](https://faucet.quicknode.com/arbitrum/sepolia) - Get testnet ETH
- [RLC Faucet](https://explorer.iex.ec/arbitrum-sepolia/faucet) - Get RLC tokens

## 📈 Roadmap

- [x] Smart contract deployment
- [x] Invoice processor iApp
- [ ] Payroll processor iApp
- [ ] Frontend wallet integration
- [ ] Batch payment optimization
- [ ] QuickBooks integration
- [ ] Mainnet deployment
- [ ] Mobile application

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

MIT License 