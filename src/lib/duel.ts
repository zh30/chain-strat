import { encodePacked, keccak256, toHex, type Hex } from 'viem'
import { comboPlaintext, hashComboPlaintext } from './arena'
import { simulateBattle } from './combat'
import { heroByTypeId } from './heroes'
import type { DuelSettlement, MatchPayload } from './types'

export const DUEL_REVEAL_WINDOW_SEC = 24 * 60 * 60

export function randomSalt(): Hex {
  return toHex(crypto.getRandomValues(new Uint8Array(32)))
}

/** keccak256(abi.encodePacked(keccak256(bytes(comboPlaintext)), salt)) — mirrors DuelHouse.commitOf. */
export function duelCommit(combo: readonly string[], salt: Hex): Hex {
  const comboHash = hashComboPlaintext(comboPlaintext(combo))
  return keccak256(encodePacked(['bytes32', 'bytes32'], [comboHash, salt]))
}

/** Verify a reveal's plaintext against the on-chain commitment. */
export function revealMatchesCommit(combo: readonly string[], salt: Hex, commit: Hex): boolean {
  return duelCommit(combo, salt).toLowerCase() === commit.toLowerCase()
}

/** Low 32 bits of keccak256(abi.encodePacked(saltA, saltB, entropy)) — mirrors DuelHouse.deriveSeed. */
export function deriveDuelSeed(input: { saltA: Hex; saltB: Hex; entropy: bigint }): number {
  const digest = keccak256(
    encodePacked(['bytes32', 'bytes32', 'uint256'], [input.saltA, input.saltB, input.entropy]),
  )
  return Number(BigInt(digest) & 0xffff_ffffn)
}

export function duelMatchId(duelId: bigint): Hex {
  return keccak256(encodePacked(['string', 'uint256'], ['duel', duelId]))
}

export function duelCommitStorageKey(duelId: bigint | string): string {
  return `chainstrat.duel.commit.${duelId.toString()}`
}

/** Local record of what a player committed on-chain: salt + the exact combo plaintext. */
export interface DuelCommitRecord {
  salt: Hex
  combo: string[]
}

export function saveDuelCommit(
  storage: Pick<Storage, 'setItem'>,
  duelId: bigint | string,
  record: DuelCommitRecord,
): void {
  storage.setItem(duelCommitStorageKey(duelId), JSON.stringify(record))
}

export function loadDuelCommit(
  storage: Pick<Storage, 'getItem'>,
  duelId: bigint | string,
): DuelCommitRecord | null {
  const raw = storage.getItem(duelCommitStorageKey(duelId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as DuelCommitRecord
    if (typeof parsed?.salt !== 'string' || !Array.isArray(parsed?.combo)) return null
    return parsed
  } catch {
    return null
  }
}

export function parseComboPlaintext(plaintext: string): string[] {
  const parsed = JSON.parse(plaintext) as unknown
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
    throw new Error('bad combo plaintext')
  }
  return parsed as string[]
}

/** Worker path: verify revealed combos against commitments, derive the on-chain seed, simulate. */
export function simulateDuel(input: {
  duelId: bigint
  playerA: `0x${string}`
  playerB: `0x${string}`
  heroA: number
  heroB: number
  comboA: string
  saltA: Hex
  commitA: Hex
  comboB: string
  saltB: Hex
  commitB: Hex
  entropy: bigint
  stakeWei: bigint
  ratingA?: number
  ratingB?: number
}): { seed: number; payload: Omit<MatchPayload, 'signature'>; settlement: DuelSettlement } {
  const skillsA = parseComboPlaintext(input.comboA)
  const skillsB = parseComboPlaintext(input.comboB)
  if (!revealMatchesCommit(skillsA, input.saltA, input.commitA)) throw new Error('combo A reveal mismatch')
  if (!revealMatchesCommit(skillsB, input.saltB, input.commitB)) throw new Error('combo B reveal mismatch')

  const heroA = heroByTypeId(input.heroA)
  const heroB = heroByTypeId(input.heroB)
  if (!heroA || !heroB) throw new Error('unknown hero type')

  const seed = deriveDuelSeed({ saltA: input.saltA, saltB: input.saltB, entropy: input.entropy })
  const result = simulateBattle(heroA.id, skillsA, heroB.id, skillsB, seed)
  const pot = input.stakeWei * 2n
  const treasury = (pot * 500n) / 10_000n
  const settlement: DuelSettlement = {
    duelId: input.duelId.toString(),
    stakeWei: input.stakeWei.toString(),
    winnerPayoutWei: (pot - treasury).toString(),
    treasuryWei: treasury.toString(),
  }
  return {
    seed,
    settlement,
    payload: {
      matchId: duelMatchId(input.duelId),
      seed,
      vsBot: false,
      players: [
        { address: input.playerA, heroId: heroA.id, combo: skillsA, rating: input.ratingA ?? 1000 },
        { address: input.playerB, heroId: heroB.id, combo: skillsB, rating: input.ratingB ?? 1000 },
      ],
      result,
      duel: settlement,
    },
  }
}
