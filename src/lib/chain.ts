import type { Hex } from 'viem'
import { monadTestnet as viemMonadTestnet } from 'viem/chains'

export const MONAD_TESTNET_ID = 10143
export const monadTestnet = viemMonadTestnet

export const MATCH_DOMAIN_NAME = 'ChainStrat'
export const MATCH_DOMAIN_VERSION = '1'

export const matchTypes = {
  Match: [
    { name: 'matchId', type: 'bytes32' },
    { name: 'playerA', type: 'address' },
    { name: 'playerB', type: 'address' },
    { name: 'heroA', type: 'uint8' },
    { name: 'heroB', type: 'uint8' },
    { name: 'winner', type: 'uint8' },
    { name: 'hpA', type: 'uint16' },
    { name: 'hpB', type: 'uint16' },
    { name: 'seed', type: 'uint64' },
    { name: 'vsBot', type: 'bool' },
    { name: 'resultHash', type: 'bytes32' },
  ],
} as const

export interface MatchMessage {
  matchId: Hex
  playerA: Hex
  playerB: Hex
  heroA: number
  heroB: number
  winner: number
  hpA: number
  hpB: number
  seed: bigint
  vsBot: boolean
  resultHash: Hex
}

export function matchSigningDomain(chainId: number, verifyingContract: Hex) {
  return {
    name: MATCH_DOMAIN_NAME,
    version: MATCH_DOMAIN_VERSION,
    chainId,
    verifyingContract,
  }
}

export function isZeroAddress(addr: string): boolean {
  return /^0x0{40}$/i.test(addr)
}

export function shortAddress(addr: string): string {
  if (addr.length < 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export const DEFAULT_RATING = 1000
export const RATING_FLOOR = 100
export const ELO_K_PVP = 32
export const ELO_K_BOT = 16
