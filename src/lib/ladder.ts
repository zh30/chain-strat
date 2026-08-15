import type { PublicClient } from 'viem'
import { battleRecorderAbi } from './abi'

export interface PlayerSnap {
  rating: number
  wins: number
  losses: number
  draws: number
  rank: number | null
  boardSize: number
}

export async function snapshotPlayer(
  client: PublicClient,
  recorder: `0x${string}`,
  player: `0x${string}`,
): Promise<PlayerSnap> {
  const count = Number(
    await client.readContract({
      address: recorder,
      abi: battleRecorderAbi,
      functionName: 'playerCount',
    }),
  )
  const mine = await client.readContract({
    address: recorder,
    abi: battleRecorderAbi,
    functionName: 'getStats',
    args: [player],
  })
  const played = mine.wins + mine.losses + mine.draws
  if (count === 0 || played === 0) {
    return {
      rating: mine.rating,
      wins: mine.wins,
      losses: mine.losses,
      draws: mine.draws,
      rank: null,
      boardSize: count,
    }
  }

  let better = 0
  for (let i = 0; i < Math.min(count, 80); i++) {
    const addr = await client.readContract({
      address: recorder,
      abi: battleRecorderAbi,
      functionName: 'playerAt',
      args: [BigInt(i)],
    })
    if (addr.toLowerCase() === player.toLowerCase()) continue
    const other = await client.readContract({
      address: recorder,
      abi: battleRecorderAbi,
      functionName: 'getStats',
      args: [addr],
    })
    if (other.rating > mine.rating || (other.rating === mine.rating && other.wins > mine.wins)) {
      better += 1
    }
  }

  return {
    rating: mine.rating,
    wins: mine.wins,
    losses: mine.losses,
    draws: mine.draws,
    rank: better + 1,
    boardSize: count,
  }
}

export interface MatchReward {
  ratingBefore: number
  ratingAfter: number
  ratingDelta: number
  rankBefore: number | null
  rankAfter: number | null
  rankDelta: number | null
  firstOnBoard: boolean
  record: 'win' | 'loss' | 'draw'
  tags: string[]
  boardSize: number
}
