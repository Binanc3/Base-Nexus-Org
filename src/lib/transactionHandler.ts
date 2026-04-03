// transactionHandler.ts

/**
 * Transaction Error Handling Utility
 * Handles different transaction errors in a comprehensive manner.
 */

 class TransactionErrorHandler {
    // Error detection patterns
    detectInsufficientBalanceError(error: any): boolean {
        return error.message.includes("insufficient funds") || error.message.includes("balance too low");
    }

    detectRevertedTransactionError(error: any): boolean {
        return error.message.includes("transaction has reverted");
    }

    detectAllowanceIssueError(error: any): boolean {
        return error.message.includes("allowance exceeded");
    }

    detectExpiredDeadlineError(error: any): boolean {
        return error.message.includes("transaction deadline exceeded");
    }

    detectSlippageError(error: any): boolean {
        return error.message.includes("slippage");
    }

    detectGasFailureError(error: any): boolean {
        return error.message.includes("out of gas") || error.message.includes("gas required exceeds allowance");
    }

    /**
     * Comprehensive error handling method
     * @param error - The error object thrown during transaction
     * @returns String indicating the type of error
     */
    handleTransactionError(error: any): string {
        if (this.detectInsufficientBalanceError(error)) {
            return "Error: Insufficient balance for transaction.";
        }
        if (this.detectRevertedTransactionError(error)) {
            return "Error: Transaction has reverted.";
        }
        if (this.detectAllowanceIssueError(error)) {
            return "Error: Allowance limit exceeded.";
        }
        if (this.detectExpiredDeadlineError(error)) {
            return "Error: Transaction deadline has expired.";
        }
        if (this.detectSlippageError(error)) {
            return "Error: Slippage error occurred.";
        }
        if (this.detectGasFailureError(error)) {
            return "Error: Gas failure.";
        }
        return "Error: Unknown transaction error.";
    }
}

export default TransactionErrorHandler;
