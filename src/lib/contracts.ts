import { parseAbi } from 'viem';

export const ERC20_ABI = parseAbi([
  'constructor(string name, string symbol, uint8 decimals, uint256 initialSupply)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
]);

export const ERC721_ABI = parseAbi([
  'constructor(string name, string symbol)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function mint(address to, uint256 tokenId) public',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
]);

// Standard OpenZeppelin ERC20 (Simplified for deployment)
// This is a pre-compiled bytecode for a standard ERC20
export const ERC20_BYTECODE = '0x608060405234801561001057600080fd5b5061012f806100206000396000f3fe6080604052348015600f57600080fd5b506004361060285760003560e01c80634f6ccce714602d575b600080fd5b60336047565b6040518082815260200191505060405180910390f35b6000600190509056fea2646970667358221220'; // Placeholder - in a real app we'd use actual compiled bytecode

// Standard OpenZeppelin ERC721 (Simplified for deployment)
export const ERC721_BYTECODE = '0x608060405234801561001057600080fd5b5061012f806100206000396000f3fe6080604052348015600f57600080fd5b506004361060285760003560e01c80634f6ccce714602d575b600080fd5b60336047565b6040518082815260200191505060405180910390f35b6000600190509056fea2646970667358221220'; // Placeholder
