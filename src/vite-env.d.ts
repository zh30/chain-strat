/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_WC_PROJECT_ID: string
  readonly VITE_HERO_NFT_ADDRESS: `0x${string}`
  readonly VITE_BATTLE_RECORDER_ADDRESS: `0x${string}`
  readonly VITE_AUTHORITY_ADDRESS: `0x${string}`
  readonly VITE_COMBO_NFT_ADDRESS: `0x${string}`
  readonly VITE_ARENA_ADDRESS: `0x${string}`
  readonly VITE_MONAD_RPC: string
  readonly VITE_CHAIN_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
