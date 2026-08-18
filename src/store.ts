import { create } from 'zustand'
import { parseScreenParam } from './lib/pwa'
import type { HeroId, MatchPayload } from './lib/types'

export type Screen = 'hall' | 'library' | 'combo' | 'match' | 'battle' | 'result' | 'ladder' | 'market' | 'arena'

interface GameStore {
  screen: Screen
  heroId: HeroId | null
  combo: string[]
  comboTokenId: bigint | null
  match: MatchPayload | null
  matchMode: 'pvp' | 'bot'
  setScreen: (screen: Screen) => void
  setHero: (heroId: HeroId) => void
  clearHero: () => void
  setCombo: (combo: string[]) => void
  loadComboNft: (heroId: HeroId, combo: string[], tokenId: bigint) => void
  startMatch: (mode: 'pvp' | 'bot') => void
  setMatch: (match: MatchPayload) => void
  clearMatch: () => void
}

function initialScreen(): Screen {
  if (typeof window === 'undefined') return 'hall'
  return parseScreenParam(window.location.search) ?? 'hall'
}

export const useGame = create<GameStore>((set) => ({
  screen: initialScreen(),
  heroId: null,
  combo: [],
  comboTokenId: null,
  match: null,
  matchMode: 'pvp',
  setScreen: (screen) => set({ screen }),
  setHero: (heroId) =>
    set((state) =>
      state.heroId === heroId ? { heroId } : { heroId, combo: [], comboTokenId: null },
    ),
  clearHero: () => set({ heroId: null, combo: [], comboTokenId: null }),
  setCombo: (combo) => set({ combo, comboTokenId: null }),
  loadComboNft: (heroId, combo, tokenId) => set({ heroId, combo, comboTokenId: tokenId }),
  startMatch: (mode) => set({ matchMode: mode, screen: 'match' }),
  setMatch: (match) => set({ match, screen: 'battle' }),
  clearMatch: () => set({ match: null, screen: 'hall' }),
}))
