import { toast } from 'sonner';

interface TransactionError {
  code?: string;
  message: string;
  reason?: string;
  details?: any;
}

export function handleTransactionError(error: any): TransactionError {
  console.error('Transaction Error:', error);

  if (error.message?.includes('insufficient balance') || error.message?.includes('insufficient funds')) {
    return {
      code: 'INSUFFICIENT_BALANCE',
      message: 'Insufficient balance to complete transaction',
      reason: 'Not enough funds in wallet'
    };
  }

  if (error.message?.includes('reverted') || error.reason === 'reverted') {
    return {
      code: 'TRANSACTION_REVERTED',
      message: 'Transaction was reverted onchain',
      reason: error.reason || 'Check contract logic and parameters'
    };
  }

  if (error.message?.includes('allowance') || error.message?.includes('ERC20: insufficient allowance')) {
    return {
      code: 'ALLOWANCE_EXCEEDED',
      message: 'Token allowance exceeded',
      reason: 'Approve more tokens or use smaller amount'
    };
  }

  if (error.message?.includes('deadline') || error.message?.includes('expired')) {
    return {
      code: 'TRANSACTION_EXPIRED',
      message: 'Transaction deadline passed',
      reason: 'Network was too slow, please try again'
    };
  }

  if (error.message?.includes('slippage')) {
    return {
      code: 'SLIPPAGE_EXCEEDED',
      message: 'Slippage tolerance exceeded',
      reason: 'Market moved too much, try again with higher slippage'
    };
  }

  if (error.message?.includes('gas')) {
    return {
      code: 'GAS_ERROR',
      message: 'Gas estimation or transaction failed',
      reason: error.message
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: error.message || 'Transaction failed',
    details: error
  };
}

export function showTransactionError(error: any) {
  const txError = handleTransactionError(error);
  toast.error(`${txError.message}\n${txError.reason || ''}`, {
    duration: 5000,
  });
}

export function logTransactionDebug(txHash: string, error: any) {
  const timestamp = new Date().toISOString();
  const debugInfo = {
    timestamp,
    txHash,
    error: handleTransactionError(error),
    rawError: error
  };
  
  const existingLogs = JSON.parse(localStorage.getItem('txDebugLogs') || '[]');
  existingLogs.push(debugInfo);
  localStorage.setItem('txDebugLogs', JSON.stringify(existingLogs.slice(-20)));
  
  console.log('[Transaction Debug]', debugInfo);
}
