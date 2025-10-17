// SPDX-License-Identifier: MIT
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
}