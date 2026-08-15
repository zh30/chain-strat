export const heroNftAbi = [
  {
    type: 'function',
    name: 'claimStarterPack',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'claimedStarter',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'hasHero',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'heroType', type: 'uint8' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

export const battleRecorderAbi = [
  {
    type: 'function',
    name: 'recordBattle',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'm',
        type: 'tuple',
        components: [
          { name: 'matchId', type: 'bytes32' },
          { name: 'playerA', type: 'address' },
          { name: 'playerB', type: 'address' },
          { name: 'heroA', type: 'uint8' },
          { name: 'heroB', type: 'uint8' },
          { name: 'winner', type: 'uint8' },
          { name: 'hpA', type: 'uint16' },
          { name: 'hpB', type: 'uint16' },
          { name: 'seed', type: 'uint64' },
          { name: 'vsBot', type: 'bool' },
          { name: 'resultHash', type: 'bytes32' },
        ],
      },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getStats',
    stateMutability: 'view',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'wins', type: 'uint32' },
          { name: 'losses', type: 'uint32' },
          { name: 'draws', type: 'uint32' },
          { name: 'rating', type: 'uint32' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'playerCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'playerAt',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'recorded',
    stateMutability: 'view',
    inputs: [{ name: 'matchId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

export const comboNftAbi = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'heroType', type: 'uint8' },
      { name: 'skillIndexes', type: 'uint8[]' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getCombo',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'heroType', type: 'uint8' },
      { name: 'skillIndexes', type: 'uint8[]' },
    ],
  },
  {
    type: 'function',
    name: 'listingOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'seller', type: 'address' },
      { name: 'price', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'listingCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'listingAt',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'seller', type: 'address' },
      { name: 'price', type: 'uint256' },
      { name: 'heroType', type: 'uint8' },
      { name: 'skillIndexes', type: 'uint8[]' },
    ],
  },
  {
    type: 'function',
    name: 'list',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'price', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'cancel',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'buy',
    stateMutability: 'payable',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'tokenOfOwnerByIndex',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const
