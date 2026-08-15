import { useAccount, useReadContracts } from 'wagmi'
import { heroNftAbi } from '../lib/abi'
import { MONAD_TESTNET_ID } from '../lib/chain'
import { HEROES } from '../lib/heroes'
import type { Hero } from '../lib/types'
import { useStarterPack } from './useStarterPack'

const nftAddress = (import.meta.env.VITE_HERO_NFT_ADDRESS ||
  '0x0000000000000000000000000000000000000000') as `0x${string}`

export function useOwnedHeroes(): {
  heroes: Hero[]
  loading: boolean
  claimed: boolean
} {
  const { address, chainId } = useAccount()
  const { claimed, checking } = useStarterPack()
  const enabled = Boolean(address) && chainId === MONAD_TESTNET_ID && !nftAddress.endsWith('0000')

  const { data, isLoading } = useReadContracts({
    contracts: HEROES.map((hero) => ({
      address: nftAddress,
      abi: heroNftAbi,
      functionName: 'hasHero' as const,
      args: address ? [address, hero.typeId] : undefined,
    })),
    query: { enabled },
  })

  const owned = HEROES.filter((_, index) => data?.[index]?.result === true)
  const heroes = owned.length > 0 ? owned : claimed ? HEROES.filter((hero) => !hero.paid) : []

  return {
    heroes,
    loading: checking || isLoading,
    claimed,
  }
}
