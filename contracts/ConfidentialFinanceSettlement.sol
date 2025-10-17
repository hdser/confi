// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract ConfidentialFinanceSettlement is Ownable, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;
    
    mapping(address => bool) public authorizedSigners;
    mapping(bytes32 => bool) public usedNonces;
    mapping(bytes32 => bool) public claimedVouchers;
    
    event VoucherClaimed(
        address indexed recipient,
        address indexed token,
        uint256 amount,
        string taskId
    );
    
    struct ClaimDetails {
        address recipientAddress;
        address tokenContract;
        uint256 amount;
        string taskId;
    }
    
    constructor() {
        // Constructor
    }
    
    function updateAuthorizedSigner(address signer, bool authorized) 
        external 
        onlyOwner 
    {
        authorizedSigners[signer] = authorized;
    }
    
    function claimVoucher(
        ClaimDetails calldata details,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        // Create voucher hash
        bytes32 messageHash = keccak256(abi.encode(details));
        
        // Check not already claimed
        require(!claimedVouchers[messageHash], "Already claimed");
        
        // Verify signature
        address signer = messageHash.toEthSignedMessageHash().recover(signature);
        require(authorizedSigners[signer], "Invalid signer");
        
        // Mark as claimed
        claimedVouchers[messageHash] = true;
        
        // Transfer tokens
        IERC20(details.tokenContract).transfer(
            details.recipientAddress, 
            details.amount
        );
        
        emit VoucherClaimed(
            details.recipientAddress,
            details.tokenContract,
            details.amount,
            details.taskId
        );
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
}