import { encodePacked, keccak256, toBytes, type Hex } from 'viem'
import { simulateBattle } from './combat'
import { getHero, heroByTypeId } from './heroes'
import type { ArenaSettlement, HeroId, MatchPayload } from './types'

/** Default minimum stand stake: 0.01 MON. */
export const ARENA_MIN_STAKE_WEI = 10n ** 16n
export const ARENA_WINNER_BPS = 9500n
export const ARENA_TREASURY_BPS = 500n
export const BPS_DENOM = 10_000n

export interface ArenaSeedInput {
  prevrandao: bigint
  defender: `0x${string}`
  challenger: `0x${string}`
  nonce: bigint
}

/** Canonical plaintext for a skill-id combo. Must match what Arena.resolve hashes. */
export function comboPlaintext(combo: readonly string[]): string {
  return JSON.stringify(combo)
}

/** keccak256 of UTF-8 combo plaintext — same as Solidity `keccak256(bytes(s))`. */
export function hashComboPlaintext(plaintext: string): Hex {
  return keccak256(toBytes(plaintext))
}

export function hashCombo(combo: readonly string[]): Hex {
  return hashComboPlaintext(comboPlaintext(combo))
}

/**
 * Packed keccak used by Arena: keccak256(abi.encodePacked(prevrandao, defender, challenger, nonce)).
 * Combat / MatchInput.seed is the low 32 bits of that uint256 — same as
 * `uint64(uint32(uint256(hash)))` in Arena.sol.
 */
export function arenaEntropyHash(input: ArenaSeedInput): Hex {
  return keccak256(
    encodePacked(
      ['uint256', 'address', 'address', 'uint256'],
      [input.prevrandao, input.defender, input.challenger, input.nonce],
    ),
  )
}

export function deriveArenaSeed(input: ArenaSeedInput): number {
  return Number(BigInt(arenaEntropyHash(input)) & 0xffff_ffffn)
}

export function acceptStandCombo(plaintext: string, committedHash: Hex): string {
  const actual = hashComboPlaintext(plaintext)
  if (actual.toLowerCase() !== committedHash.toLowerCase()) {
    throw new Error('combo hash mismatch')
  }
  return plaintext
}

export function arenaPayout(stakeWei: bigint): { winner: bigint; treasury: bigint; pot: bigint } {
  const pot = stakeWei * 2n
  const treasury = (pot * ARENA_TREASURY_BPS) / BPS_DENOM
  return { pot, treasury, winner: pot - treasury }
}

export function standStorageKey(standId: bigint | string): string {
  return `stand:${standId.toString()}`
}

export function commitStandCombo(combo: readonly string[], committedHash: Hex): string {
  return acceptStandCombo(comboPlaintext(combo), committedHash)
}

export function arenaMatchId(standId: bigint, nonce: bigint): Hex {
  return keccak256(encodePacked(['string', 'uint256', 'uint256'], ['arena', standId, nonce]))
}

export function heroIdFromType(typeId: number): HeroId {
  const hero = heroByTypeId(typeId)
  if (!hero) throw new Error(`unknown hero type ${typeId}`)
  return hero.id
}

/** Worker path: verify committed hashes, derive the on-chain seed, simulate. */
export function simulateArenaChallenge(input: {
  standId: bigint
  defender: `0x${string}`
  challenger: `0x${string}`
  defenderHeroType: number
  challengerHeroType: number
  defenderCombo: readonly string[]
  challengerCombo: readonly string[]
  defenderHash: Hex
  challengerHash: Hex
  prevrandao: bigint
  nonce: bigint
  stakeWei: bigint
  defenderRating?: number
  challengerRating?: number
}): { seed: number; payload: Omit<MatchPayload, 'signature'>; settlement: ArenaSettlement } {
  const defenderCombo = commitStandCombo(input.defenderCombo, input.defenderHash)
  const challengerCombo = commitStandCombo(input.challengerCombo, input.challengerHash)
  const seed = deriveArenaSeed({
    prevrandao: input.prevrandao,
    defender: input.defender,
    challenger: input.challenger,
    nonce: input.nonce,
  })
  const defenderHero = getHero(heroIdFromType(input.defenderHeroType))
  const challengerHero = getHero(heroIdFromType(input.challengerHeroType))
  const result = simulateBattle(
    defenderHero.id,
    [...input.defenderCombo],
    challengerHero.id,
    [...input.challengerCombo],
    seed,
  )
  const payout = arenaPayout(input.stakeWei)
  const settlement: ArenaSettlement = {
    standId: input.standId.toString(),
    stakeWei: input.stakeWei.toString(),
    winnerPayoutWei: payout.winner.toString(),
    treasuryWei: payout.treasury.toString(),
    defenderCombo,
    challengerCombo,
  }
  return {
    seed,
    settlement,
    payload: {
      matchId: arenaMatchId(input.standId, input.nonce),
      seed,
      vsBot: false,
      players: [
        { address: input.defender, heroId: defenderHero.id, combo: [...input.defenderCombo], rating: input.defenderRating ?? 1000 },
        {
          address: input.challenger,
          heroId: challengerHero.id,
          combo: [...input.challengerCombo],
          rating: input.challengerRating ?? 1000,
        },
      ],
      result,
      arena: settlement,
    },
  }
}
