import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import {
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets'
import { http, createConfig } from 'wagmi'
import { monadTestnet } from './lib/chain'

const projectId = import.meta.env.VITE_WC_PROJECT_ID
if (!projectId) {
  throw new Error('VITE_WC_PROJECT_ID is missing. Copy .env.example to .env.')
}

// RainbowKit 2.2 only supports wagmi 2.x. wagmi 3 breaks the MetaMask injected
// connector (spinner, no extension popup).
const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [metaMaskWallet, injectedWallet, rainbowWallet, walletConnectWallet],
    },
  ],
  { appName: 'ChainStrat', projectId },
)

export const wagmiConfig = createConfig({
  connectors,
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http(import.meta.env.VITE_MONAD_RPC || 'https://testnet-rpc.monad.xyz'),
  },
  ssr: false,
  multiInjectedProviderDiscovery: true,
})
