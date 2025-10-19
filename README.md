# ConFi: Confidential Finance Platform

Privacy-preserving invoice and payroll processing built on iExec's confidential computing infrastructure. All sensitive financial data is processed inside Intel SGX enclaves, ensuring complete privacy with on-chain settlement.

---

## 🚀 Quick Start

### Prerequisites

Install these before starting:

- **Node.js v20+** - [Download](https://nodejs.org)
- **Docker Desktop** (running) - [Download](https://docker.com/products/docker-desktop)
- **MetaMask** browser extension - [Install](https://metamask.io)
- **iApp CLI** - Install with: `npm install -g @iexec/iapp`

### Get Test Tokens

You'll need these for Arbitrum Sepolia testnet:

- **ETH** - [QuickNode Faucet](https://faucet.quicknode.com/arbitrum/sepolia)
- **RLC** - [iExec Faucet](https://explorer.iex.ec/arbitrum-sepolia/faucet)

---

## 📦 Installation

```bash
# Clone repository
git clone https://github.com/your-org/confi-platform.git
cd confi-platform

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

Edit `.env` and add your wallet private key:

```bash
PRIVATE_KEY=0xYourPrivateKeyHere
DOCKER_USERNAME=your-dockerhub-username
```

---

## 🔧 Deployment (4 Steps)

### Step 1: Deploy Smart Contract

```bash
npm run deploy:contracts
```

Copy the contract address from output and add to `.env`:

```bash
SETTLEMENT_CONTRACT=0x996b21dB...
REACT_APP_SETTLEMENT_CONTRACT=0x996b21dB...
```

### Step 2: Generate Signing Keys & Configure

```bash
npm run setup:complete
```

This automatically:
- Generates cryptographic signing keys
- Configures iApp secrets
- Authorizes signers in the settlement contract

### Step 3: Deploy iApps to iExec

```bash
npm run deploy:iapps
```

Choose what to deploy when prompted. Copy the iApp addresses and add to `.env`:

```bash
INVOICE_IAPP_ADDRESS=0x2E7C6b32...
PAYROLL_IAPP_ADDRESS=0xA1956e4B...
REACT_APP_INVOICE_IAPP_ADDRESS=0x2E7C6b32...
REACT_APP_PAYROLL_IAPP_ADDRESS=0xA1956e4B...
```

### Step 4: Start the App

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 💡 How to Use

### Create an Invoice

1. Connect your wallet (click "Connect Wallet")
2. Navigate to "Invoices"
3. Fill in invoice details
4. Click "Create Invoice"
5. Wait 30-90 seconds for TEE processing
6. Download the payment voucher

### Process Payroll

1. Navigate to "Payroll"
2. Add employees (wallet address + amount)
3. Click "Process Payroll Confidentially"
4. Wait for batch processing
5. Download vouchers for all employees

### Claim Payment

1. Navigate to "Claim"
2. Paste the voucher JSON
3. Click "Claim Payment"
4. Approve the transaction in MetaMask

---

## 🔍 Common Issues

| Problem | Solution |
|---------|----------|
| "VOUCHER_SIGNING_KEY not found" | Run `npm run setup:complete` |
| "Invalid signer" | Run `npm run setup:complete` again |
| "Insufficient RLC" | Get RLC from [iExec Faucet](https://explorer.iex.ec/arbitrum-sepolia/faucet) |
| "Wrong network" | Switch MetaMask to Arbitrum Sepolia (Chain ID: 421614) |
| Task timeout | Check task status on [iExec Explorer](https://explorer.iex.ec/arbitrum-sepolia) |

---

## 📊 Project Structure

```
confi-platform/
├── src/
│   ├── iapp/                    # TEE processors
│   │   ├── invoiceProcessor.js
│   │   └── payrollProcessor.js
│   ├── frontend/                # React app
│   │   └── components/
│   └── contracts/               # Smart contracts
├── scripts/                     # Deployment scripts
│   ├── deploy-contracts.js
│   ├── setup-complete.js
│   └── deploy-iapps.sh
└── package.json
```

---

## 🔐 Security Notes

- **Never commit** `signing-keys.json` or `.env`
- These files contain private keys
- Already added to `.gitignore`
- Rotate signing keys periodically for production

---

## 🌐 Resources

- [iExec Explorer](https://explorer.iex.ec/arbitrum-sepolia) - Monitor tasks
- [iExec Documentation](https://protocol.docs.iex.ec) - Protocol details
- [DataProtector SDK](https://tools.docs.iex.ec/tools/dataProtector) - API reference

---

## 📝 Available Commands

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run deploy:contracts # Deploy settlement contract
npm run setup:complete   # Generate keys and configure
npm run deploy:iapps     # Deploy TEE applications
npm run clean            # Clean build artifacts
```

---

## 📄 License

MIT License