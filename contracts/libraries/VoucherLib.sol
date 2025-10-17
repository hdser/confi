// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

library VoucherLib {
    function hashVoucher(
        address recipient,
        address tokenContract,
        uint256 amount,
        string memory taskId,
        uint256 timestamp,
        string memory nonce
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            recipient,
            tokenContract,
            amount,
            taskId,
            timestamp,
            nonce
        ));
    }
    
    function hashBatchPayment(
        bytes32 batchId,
        address tokenContract,
        address[] memory recipients,
        uint256[] memory amounts,
        uint256 totalAmount,
        string memory taskId
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            batchId,
            tokenContract,
            recipients,
            amounts,
            totalAmount,
            taskId
        ));
    }
}