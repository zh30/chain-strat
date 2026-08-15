import { encodePacked, keccak256 } from 'viem'
import type { BattleEndReason, BattleResult } from './types'

export function winnerCode(winner: 0 | 1 | null): number {
  if (winner === null) return 2
  return winner
}

export function computeResultHash(input: {
  seed: number
  winner: 0 | 1 | null
  finalHp: [number, number]
  overtime: boolean
  eventCount: number
  reason: BattleEndReason
}): `0x${string}` {
  const reasonCode =
    input.reason === 'ko' ? 0 : input.reason === 'timeout' ? 1 : input.reason === 'sudden_death' ? 2 : 3
  return keccak256(
    encodePacked(
      ['uint64', 'uint8', 'uint16', 'uint16', 'bool', 'uint32', 'uint8'],
      [
        BigInt(input.seed),
        winnerCode(input.winner),
        input.finalHp[0],
        input.finalHp[1],
        input.overtime,
        input.eventCount,
        reasonCode,
      ],
    ),
  )
}

export function hashOfResult(result: BattleResult): `0x${string}` {
  return computeResultHash({
    seed: result.seed,
    winner: result.winner,
    finalHp: result.finalHp,
    overtime: result.overtime,
    eventCount: result.events.length,
    reason: result.reason,
  })
}
