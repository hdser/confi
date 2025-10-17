// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ISettlement {
    struct PaymentVoucher {
        address recipient;
        address tokenContract;
        uint256 amount;
        string taskId;
        uint256 timestamp;
        string nonce;
    }
    
    struct BatchPayment {
        address tokenContract;
        address[] recipients;
        uint256[] amounts;
        uint256 totalAmount;
        bool executed;
        string taskId;
    }
    
    event VoucherClaimed(
        address indexed recipient,
        address indexed token,
        uint256 amount,
        bytes32 voucherHash,
        string taskId
    );
    
    event BatchPaymentExecuted(
        bytes32 indexed batchId,
        address indexed token,
        uint256 totalAmount,
        uint256 recipientCount
    );
    
    function claimVoucher(PaymentVoucher calldata voucher, bytes calldata signature) external;
    function executeBatchPayment(
        bytes32 batchId,
        address tokenContract,
        address[] calldata recipients,
        uint256[] calldata amounts,
        uint256 totalAmount,
        string calldata taskId,
        bytes calldata signature
    ) external;
}