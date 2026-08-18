export type HeroId =
  | 'warrior'
  | 'mage'
  | 'assassin'
  | 'ranger'
  | 'guardian'
  | 'necromancer'
  | 'blademaster'

export type Side = 0 | 1

export type EffectType =
  | 'damage'
  | 'stun'
  | 'root'
  | 'dot'
  | 'shield'
  | 'heal'
  | 'buffAtk'
  | 'reduceDmg'
  | 'nextSkillHaste'
  | 'nextSkillSlow'
  | 'nextSkillDmgAmp'
  | 'nextHitReduce'
  | 'execute'
  | 'critChance'

export interface Effect {
  type: EffectType
  value: number
  duration?: number
}

export interface Skill {
  id: string
  name: string
  nameZh: string
  duration: number
  cd: number
  effects: Effect[]
}

export interface Hero {
  id: HeroId
  typeId: number
  name: string
  nameZh: string
  hp: number
  paid: boolean
  blurb: string
  blurbZh: string
  skills: Skill[]
}

export type BattleEndReason = 'ko' | 'timeout' | 'sudden_death' | 'draw'

export type BattleEvent =
  | { t: number; type: 'start_cast'; side: Side; skillId: string; duration: number }
  | { t: number; type: 'cast_end'; side: Side; skillId: string }
  | { t: number; type: 'cast_interrupt'; side: Side; skillId: string }
  | {
      t: number
      type: 'damage'
      side: Side
      amount: number
      isCrit?: boolean
      remainingHp: number
      remainingShield: number
      source: string
    }
  | { t: number; type: 'heal'; side: Side; amount: number; remainingHp: number }
  | { t: number; type: 'shield'; side: Side; amount: number; remainingShield: number }
  | { t: number; type: 'effect'; side: Side; effect: string; value: number; duration: number }
  | {
      t: number
      type: 'dot_tick'
      side: Side
      amount: number
      remainingHp: number
      remainingShield: number
    }
  | { t: number; type: 'death'; side: Side }
  | { t: number; type: 'overtime_start'; hp: [number, number] }
  | {
      t: number
      type: 'battle_end'
      winner: 0 | 1 | null
      reason: BattleEndReason
      finalHp: [number, number]
      overtime: boolean
    }

export interface BattleResult {
  winner: 0 | 1 | null
  reason: BattleEndReason
  finalHp: [number, number]
  events: BattleEvent[]
  resultHash: string
  overtime: boolean
  seed: number
}

export interface ComboPlanEntry {
  skillId: string
  start: number
  end: number
  waitBefore: number
}

export interface ComboPlan {
  entries: ComboPlanEntry[]
  totalTime: number
  legal: boolean
}

export interface PlayerLoadout {
  address: `0x${string}`
  heroId: HeroId
  combo: string[]
  rating: number
}

export interface ArenaSettlement {
  standId: string
  stakeWei: string
  winnerPayoutWei: string
  treasuryWei: string
  defenderCombo: string
  challengerCombo: string
}

export interface MatchPayload {
  matchId: `0x${string}`
  seed: number
  vsBot: boolean
  players: [PlayerLoadout, PlayerLoadout]
  result: BattleResult
  signature: `0x${string}`
  arena?: ArenaSettlement
}

export const BOT_ADDRESS = '0x0000000000000000000000000000000000000000' as const
export const COMBO_MAX_SEC = 60
export const TICK_HZ = 20
export const REGULATION_TICKS = 60 * TICK_HZ
export const OVERTIME_TICKS = 60 * TICK_HZ
export const QUEUE_TIMEOUT_MS = 20_000
