// ============================================================
// src/types/swap.ts
// Shared types for swap state, history, and stats
// ============================================================

export interface TokenInfo {
  address: string;       // '0x000...000' for native
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
  logoURI?: string;
  priceUSD?: string;
}

export interface SwapRecord {
  hash: `0x${string}`;
  from: string;           // fromToken.symbol
  to: string;             // toToken.symbol
  fromAmount: string;     // human-readable input amount
  toAmount: string;       // human-readable output amount
  fromAmountUSD: string;
  toAmountUSD: string;
  timestamp: number;      // Date.now() at submission
  gasUsed: string;        // in ETH
  status: 'success' | 'reverted';
  chainId: number;
}

export interface SwapStats {
  totalVolume: string;    // USD string, e.g. "12345.67"
  totalGas: string;       // ETH string
  swapCount: number;
}

export interface QuoteWithTimestamp {
  // LI.FI quote fields (subset — add more as needed)
  transactionRequest: {
    to: string;
    data: string;
    value?: string | bigint;
    gasPrice?: string;
    gasLimit?: string;
  };
  estimate: {
    fromAmount: string;
    toAmount: string;
    toAmountUSD?: string;
    fromAmountUSD?: string;
    approvalAddress?: string;   // ← KEY: the actual spender for approve()
    gasCosts?: {
      amount: string;
      amountUSD?: string;
    }[];
  };
  action: {
    fromChainId: number;
    toChainId: number;
    fromToken: TokenInfo;
    toToken: TokenInfo;
  };
  // Added by us when we store the quote
  fetchedAt: number;      // Date.now() when quote was fetched
}
