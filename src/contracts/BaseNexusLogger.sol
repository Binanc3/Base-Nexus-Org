// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BaseNexusLogger
 * @dev A simple contract to log application events onchain with builder attribution.
 * This contract is an alternative to "self-logging" transactions.
 */
contract BaseNexusLogger {
    event OnchainEvent(address indexed user, string eventType, string data);

    /**
     * @dev Logs an event to the blockchain.
     * @param eventType The type of event (e.g., "GM", "SCORE", "MINT").
     * @param eventData The data associated with the event.
     */
    function logEvent(string calldata eventType, string calldata eventData) external {
        emit OnchainEvent(msg.sender, eventType, eventData);
    }

    /**
     * @dev Fallback function to allow "self-logging" style transactions 
     * while still being able to receive the builder code suffix.
     */
    fallback() external payable {}
    receive() external payable {}
}
