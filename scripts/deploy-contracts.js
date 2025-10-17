
require('dotenv').config();

const { ethers } = require('ethers');
const fs = require('fs').promises;
const path = require('path');
const solc = require('solc');

async function compileContract() {
  console.log('📝 Compiling ConfidentialFinanceSettlement contract...\n');
  
  // Create the contract file with CORRECT OpenZeppelin v5 imports
  const contractPath = path.join(__dirname, '../src/contracts/ConfidentialFinanceSettlement.sol');
  await fs.mkdir(path.join(__dirname, '../src/contracts'), { recursive: true });
  
  // Updated contract with correct import paths for OpenZeppelin v5
  const source = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract ConfidentialFinanceSettlement is Ownable, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    
    mapping(address => bool) public authorizedSigners;
    mapping(bytes32 => bool) public usedNonces;
    mapping(bytes32 => bool) public claimedVouchers;
    
    event VoucherClaimed(
        address indexed recipient,
        address indexed token,
        uint256 amount,
        bytes32 voucherHash,
        string taskId
    );
    
    event SignerUpdated(address indexed signer, bool authorized);
    
    struct PaymentVoucher {
        address recipient;
        address tokenContract;
        uint256 amount;
        string taskId;
        uint256 timestamp;
        string nonce;
    }
    
    constructor() Ownable(msg.sender) {}
    
    function updateAuthorizedSigner(address signer, bool authorized) 
        external 
        onlyOwner 
    {
        authorizedSigners[signer] = authorized;
        emit SignerUpdated(signer, authorized);
    }
    
    function claimVoucher(
        PaymentVoucher calldata voucher,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        bytes32 voucherHash = keccak256(abi.encode(voucher));
        require(!claimedVouchers[voucherHash], "Voucher already claimed");
        
        bytes32 nonceHash = keccak256(bytes(voucher.nonce));
        require(!usedNonces[nonceHash], "Nonce already used");
        
        bytes32 messageHash = keccak256(abi.encodePacked(
            voucher.recipient,
            voucher.tokenContract,
            voucher.amount,
            voucher.taskId,
            voucher.timestamp,
            voucher.nonce
        ));
        
        address signer = messageHash.toEthSignedMessageHash().recover(signature);
        require(authorizedSigners[signer], "Invalid signer");
        
        claimedVouchers[voucherHash] = true;
        usedNonces[nonceHash] = true;
        
        IERC20(voucher.tokenContract).transfer(voucher.recipient, voucher.amount);
        
        emit VoucherClaimed(
            voucher.recipient,
            voucher.tokenContract,
            voucher.amount,
            voucherHash,
            voucher.taskId
        );
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
}`;
  
  await fs.writeFile(contractPath, source);
  console.log('✅ Contract file created with correct imports\n');
  
  const input = {
    language: 'Solidity',
    sources: {
      'ConfidentialFinanceSettlement.sol': { content: source }
    },
    settings: {
      outputSelection: {
        '*': { '*': ['abi', 'evm.bytecode'] }
      },
      optimizer: { enabled: true, runs: 200 }
    }
  };
  
  function findImports(importPath) {
    try {
      const nodePath = path.join(__dirname, '../node_modules', importPath);
      const contents = require('fs').readFileSync(nodePath, 'utf8');
      return { contents };
    } catch (error) {
      return { error: 'File not found: ' + importPath };
    }
  }
  
  console.log('Compiling...');
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  
  if (output.errors) {
    const errors = output.errors.filter(e => e.severity === 'error');
    if (errors.length > 0) {
      console.error('\n❌ Compilation errors:');
      errors.forEach(e => console.error(e.formattedMessage));
      throw new Error('Contract compilation failed');
    }
  }
  
  const contract = output.contracts['ConfidentialFinanceSettlement.sol']['ConfidentialFinanceSettlement'];
  console.log('✅ Contract compiled successfully\n');
  
  return {
    abi: contract.abi,
    bytecode: '0x' + contract.evm.bytecode.object
  };
}

async function deployContracts() {
  console.log('🚀 Deploying ConFi Smart Contracts...\n');
  
  const network = process.env.NETWORK || 'arbitrum-sepolia';
  const rpcUrl = process.env.RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;
  
  console.log('Environment check:');
  console.log('- NETWORK:', network);
  console.log('- RPC_URL:', rpcUrl ? '✅' : '❌');
  console.log('- PRIVATE_KEY:', privateKey ? '✅' : '❌');
  console.log('');
  
  if (!rpcUrl || !privateKey) {
    console.error('❌ Missing RPC_URL or PRIVATE_KEY in .env');
    process.exit(1);
  }
  
  const { abi, bytecode } = await compileContract();
  
  console.log('Connecting to network...');
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log(`Deployer: ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);
  
  if (balance === 0n) {
    console.error('❌ No ETH for gas! Fund wallet at:');
    console.error('https://faucet.quicknode.com/arbitrum/sepolia');
    process.exit(1);
  }
  
  console.log('Deploying contract...');
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const settlement = await factory.deploy();
  
  console.log('📡 Tx:', settlement.deploymentTransaction().hash);
  await settlement.waitForDeployment();
  
  const address = await settlement.getAddress();
  console.log(`✅ Deployed: ${address}\n`);
  
  // Save artifacts
  await fs.mkdir(path.join(__dirname, '../artifacts'), { recursive: true });
  await fs.writeFile(
    path.join(__dirname, '../artifacts/ConfidentialFinanceSettlement.json'),
    JSON.stringify({ abi, bytecode, address }, null, 2)
  );
  
  // Update deployed.json
  const deployedPath = path.join(__dirname, '../deployed.json');
  let deployed = { "arbitrum": {}, "arbitrum-sepolia": {} };
  try {
    deployed = JSON.parse(await fs.readFile(deployedPath, 'utf8'));
  } catch {}
  
  deployed[network] = {
    settlementContract: address,
    deployedAt: new Date().toISOString(),
    deployer: wallet.address,
    transactionHash: settlement.deploymentTransaction().hash
  };
  
  await fs.writeFile(deployedPath, JSON.stringify(deployed, null, 2));
  
  console.log('📝 Update .env with:');
  console.log(`SETTLEMENT_CONTRACT=${address}`);
  console.log(`\n🔍 View: https://sepolia.arbiscan.io/address/${address}`);
  
  return address;
}

if (require.main === module) {
  deployContracts()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = deployContracts;
