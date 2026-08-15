import { simulateBattle } from './combat'
import { getHero } from './heroes'
import type { HeroId, MatchPayload } from './types'
import { BOT_ADDRESS } from './types'

const DEMO_A: HeroId = 'warrior'
const DEMO_B: HeroId = 'assassin'
const DEMO_COMBO_A = [
  'warrior.war_cry',
  'warrior.heavy_slash',
  'warrior.shield_bash',
  'warrior.heavy_slash',
  'warrior.shield_bash',
  'warrior.heavy_slash',
]
const DEMO_COMBO_B = [
  'assassin.venom_blade',
  'assassin.shadow_strike',
  'assassin.backstab',
  'assassin.shadow_strike',
  'assassin.backstab',
  'assassin.venom_blade',
]

function pickSeed(): number {
  let fallback = 17
  for (let seed = 1; seed < 400; seed++) {
    const result = simulateBattle(DEMO_A, DEMO_COMBO_A, DEMO_B, DEMO_COMBO_B, seed)
    const crit = result.events.some((e) => e.type === 'damage' && e.isCrit)
    const death = result.events.some((e) => e.type === 'death')
    const end = result.events.find((e) => e.type === 'battle_end')
    const duration = end && end.type === 'battle_end' ? end.t : 0
    if (crit && death && duration >= 8) return seed
    if (crit && death) fallback = seed
  }
  return fallback
}

export function buildDemoMatch(): MatchPayload {
  const seed = pickSeed()
  const result = simulateBattle(DEMO_A, DEMO_COMBO_A, DEMO_B, DEMO_COMBO_B, seed)
  const a = getHero(DEMO_A)
  const b = getHero(DEMO_B)
  return {
    matchId: `0x${'d'.repeat(64)}`,
    seed,
    vsBot: true,
    players: [
      {
        address: '0x1111111111111111111111111111111111111111',
        heroId: a.id,
        combo: DEMO_COMBO_A,
        rating: 1000,
      },
      {
        address: BOT_ADDRESS,
        heroId: b.id,
        combo: DEMO_COMBO_B,
        rating: 1000,
      },
    ],
    result,
    signature: `0x${'00'.repeat(65)}`,
  }
}
