// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title ConfidentialFinanceSettlement
 * @dev Settlement contract for ConFi platform with batch payment support
 */
contract ConfidentialFinanceSettlement is Ownable, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    
    // State variables
    mapping(address => bool) public authorizedSigners;
    mapping(bytes32 => bool) public usedNonces;
    mapping(bytes32 => bool) public claimedVouchers;
    mapping(bytes32 => bool) public usedBatchNonces;
    
    // Events
    event VoucherClaimed(
        address indexed recipient,
        address indexed token,
        uint256 amount,
        bytes32 voucherHash,
        string taskId
    );
    
    event BatchPaymentExecuted(
        bytes32 indexed batchHash,
        address indexed token,
        uint256 totalAmount,
        uint256 recipientCount,
        string taskId
    );
    
    event SignerUpdated(address indexed signer, bool authorized);
    
    // Structs
    struct PaymentVoucher {
        address recipient;
        address tokenContract;
        uint256 amount;
        string taskId;
        uint256 timestamp;
        string nonce;
    }
    
    /**
     * @dev Constructor
     */
    constructor() Ownable(msg.sender) {}
    
    /**
     * @dev Update authorized signer status
     */
    function updateAuthorizedSigner(address signer, bool authorized) 
        external 
        onlyOwner 
    {
        authorizedSigners[signer] = authorized;
        emit SignerUpdated(signer, authorized);
    }
    
    /**
     * @dev Claim a single payment voucher
     */
    function claimVoucher(
        PaymentVoucher calldata voucher,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        // Create voucher hash
        bytes32 voucherHash = keccak256(abi.encode(voucher));
        require(!claimedVouchers[voucherHash], "Voucher already claimed");
        
        // Check nonce
        bytes32 nonceHash = keccak256(bytes(voucher.nonce));
        require(!usedNonces[nonceHash], "Nonce already used");
        
        // Verify signature using packed encoding (matching the iApp)
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
        
        // Mark as used
        claimedVouchers[voucherHash] = true;
        usedNonces[nonceHash] = true;
        
        // Transfer tokens
        require(
            IERC20(voucher.tokenContract).transfer(voucher.recipient, voucher.amount),
            "Token transfer failed"
        );
        
        emit VoucherClaimed(
            voucher.recipient,
            voucher.tokenContract,
            voucher.amount,
            voucherHash,
            voucher.taskId
        );
    }
    
    /**
     * @dev Execute a batch payment (for payroll)
     * @param tokenContract The ERC20 token contract address
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts for each recipient
     * @param taskId The iExec task ID
     * @param timestamp The timestamp from the iApp
     * @param nonce The unique nonce for this batch
     * @param signature The signature from the authorized iApp
     */
    function executeBatchPayment(
        address tokenContract,
        address[] calldata recipients,
        uint256[] calldata amounts,
        string calldata taskId,
        uint256 timestamp,
        string calldata nonce,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        require(recipients.length == amounts.length, "Mismatched arrays");
        require(recipients.length > 0, "Empty batch");
        require(recipients.length <= 200, "Batch too large"); // Gas limit protection
        
        // Check nonce
        bytes32 nonceHash = keccak256(bytes(nonce));
        require(!usedBatchNonces[nonceHash], "Batch nonce already used");
        
        // Calculate total amount
        uint256 totalAmount = 0;
        for (uint i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        
        // Verify signature
        // Hash the arrays first (matching the iApp's approach)
        bytes32 recipientsHash = keccak256(abi.encode(recipients));
        bytes32 amountsHash = keccak256(abi.encode(amounts));
        
        bytes32 messageHash = keccak256(abi.encodePacked(
            tokenContract,
            recipientsHash,
            amountsHash,
            taskId,
            timestamp,
            nonce
        ));
        
        address signer = messageHash.toEthSignedMessageHash().recover(signature);
        require(authorizedSigners[signer], "Invalid batch signer");
        
        // Mark nonce as used
        usedBatchNonces[nonceHash] = true;
        
        // Check token balance
        IERC20 token = IERC20(tokenContract);
        require(
            token.balanceOf(address(this)) >= totalAmount,
            "Insufficient contract balance"
        );
        
        // Execute all transfers
        for (uint i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient");
            require(amounts[i] > 0, "Invalid amount");
            require(
                token.transfer(recipients[i], amounts[i]),
                "Batch transfer failed"
            );
        }
        
        // Create batch hash for event
        bytes32 batchHash = keccak256(abi.encodePacked(
            tokenContract,
            recipients,
            amounts,
            taskId,
            timestamp,
            nonce
        ));
        
        emit BatchPaymentExecuted(
            batchHash,
            tokenContract,
            totalAmount,
            recipients.length,
            taskId
        );
    }
    
    /**
     * @dev Withdraw tokens (for owner only, in case of stuck funds)
     */
    function withdrawToken(address token, uint256 amount) 
        external 
        onlyOwner 
    {
        require(
            IERC20(token).transfer(msg.sender, amount),
            "Withdrawal failed"
        );
    }
    
    /**
     * @dev Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Check if a voucher has been claimed
     */
    function isVoucherClaimed(PaymentVoucher calldata voucher) 
        external 
        view 
        returns (bool) 
    {
        bytes32 voucherHash = keccak256(abi.encode(voucher));
        return claimedVouchers[voucherHash];
    }
    
    /**
     * @dev Check if a nonce has been used
     */
    function isNonceUsed(string calldata nonce) 
        external 
        view 
        returns (bool) 
    {
        bytes32 nonceHash = keccak256(bytes(nonce));
        return usedNonces[nonceHash] || usedBatchNonces[nonceHash];
    }
}