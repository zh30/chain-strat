import { type Hex, type PrivateKeyAccount, type WalletClient } from 'viem'
import { matchSigningDomain, matchTypes, type MatchMessage } from './chain'
import { getHero } from './heroes'
import { winnerCode } from './hash'
import type { MatchPayload } from './types'
import { BOT_ADDRESS } from './types'

export function payloadToMatchMessage(payload: MatchPayload): MatchMessage {
  const [a, b] = payload.players
  return {
    matchId: payload.matchId,
    playerA: a.address,
    playerB: b.address,
    heroA: getHero(a.heroId).typeId,
    heroB: getHero(b.heroId).typeId,
    winner: winnerCode(payload.result.winner),
    hpA: payload.result.finalHp[0],
    hpB: payload.result.finalHp[1],
    seed: BigInt(payload.seed),
    vsBot: payload.vsBot,
    resultHash: payload.result.resultHash as Hex,
  }
}

export async function signMatch(
  account: PrivateKeyAccount,
  chainId: number,
  verifyingContract: Hex,
  message: MatchMessage,
): Promise<Hex> {
  return account.signTypedData({
    domain: matchSigningDomain(chainId, verifyingContract),
    types: matchTypes,
    primaryType: 'Match',
    message,
  })
}

export async function verifyMatchClient(
  payload: MatchPayload,
): Promise<boolean> {
  const local = payload.result
  return (
    local.resultHash.startsWith('0x') &&
    local.events.length > 0 &&
    local.events[local.events.length - 1]?.type === 'battle_end'
  )
}

export function botLoadoutAddress(): `0x${string}` {
  return BOT_ADDRESS
}

export async function signWithWallet(
  wallet: WalletClient,
  chainId: number,
  verifyingContract: Hex,
  message: MatchMessage,
): Promise<Hex> {
  if (!wallet.account) throw new Error('wallet has no account')
  return wallet.signTypedData({
    account: wallet.account,
    domain: matchSigningDomain(chainId, verifyingContract),
    types: matchTypes,
    primaryType: 'Match',
    message,
  })
}
