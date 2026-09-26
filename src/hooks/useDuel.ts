import { useCallback, useMemo, useRef, useState } from 'react'
import { parseEther, type Hex } from 'viem'
import { useAccount, usePublicClient, useReadContract, useReadContracts, useWriteContract } from 'wagmi'
import { duelHouseAbi } from '../lib/abi'
import { comboPlaintext } from '../lib/arena'
import { MONAD_TESTNET_ID } from '../lib/chain'
import { duelCommit, loadDuelCommit, randomSalt, saveDuelCommit } from '../lib/duel'
import { payloadToMatchMessage } from '../lib/signing'
import { isUserRejection, sendWs } from '../lib/tx'
import type { MatchPayload } from '../lib/types'

export type DuelTxPhase = 'idle' | 'wallet' | 'pending' | 'done' | 'error'

export const duelHouseAddress = (import.meta.env.VITE_DUEL_HOUSE_ADDRESS ||
  '0x0000000000000000000000000000000000000000') as `0x${string}`

export function duelContractReady(): boolean {
  return !duelHouseAddress.endsWith('0000')
}

export const DuelStatus = {
  None: 0,
  Open: 1,
  Committed: 2,
  Closed: 3,
} as const

export interface DuelViewData {
  id: bigint
  playerA: `0x${string}`
  heroA: number
  commitA: `0x${string}`
  playerB: `0x${string}`
  heroB: number
  commitB: `0x${string}`
  stake: bigint
  comboA: string
  saltA: `0x${string}`
  revealedA: boolean
  comboB: string
  saltB: `0x${string}`
  revealedB: boolean
  entropy: bigint
  revealDeadline: bigint
  status: number
}

function humanError(error: unknown): string {
  if (isUserRejection(error)) return '钱包里取消了这一笔。'
  const message = error instanceof Error ? error.message : String(error)
  if (/needhero/i.test(message)) return '要先拥有这名英雄，才能约战。'
  if (/badstake/i.test(message)) return '押金不对，应战要等额。'
  if (/badcommit/i.test(message)) return '连招或盐和上链的承诺对不上。'
  if (/notopen|notcommitted|alreadypart|selfduel|tooearly|nothingrevealed|alreadyclosed|notplayer/i.test(message))
    return '这局约战现在不能这样操作。'
  if (/insufficient funds|exceeds the balance/i.test(message)) return '测试网 MON 不够付押金或 gas。'
  if (/network|chain/i.test(message)) return '请先切到 Monad Testnet。'
  return '交易没成功，请再试一次。'
}

function parseDuel(id: bigint, row: unknown): DuelViewData | null {
  const d = row as DuelViewData | readonly unknown[]
  if (d && typeof d === 'object' && 'playerA' in d) {
    return {
      id,
      playerA: d.playerA,
      heroA: Number(d.heroA),
      commitA: d.commitA,
      playerB: d.playerB,
      heroB: Number(d.heroB),
      commitB: d.commitB,
      stake: d.stake,
      comboA: d.comboA,
      saltA: d.saltA,
      revealedA: d.revealedA,
      comboB: d.comboB,
      saltB: d.saltB,
      revealedB: d.revealedB,
      entropy: d.entropy,
      revealDeadline: d.revealDeadline,
      status: Number(d.status),
    }
  }
  const t = row as readonly unknown[]
  if (!Array.isArray(t) || t.length < 16) return null
  return {
    id,
    playerA: t[0] as `0x${string}`,
    heroA: Number(t[1]),
    commitA: t[2] as `0x${string}`,
    playerB: t[3] as `0x${string}`,
    heroB: Number(t[4]),
    commitB: t[5] as `0x${string}`,
    stake: t[6] as bigint,
    comboA: t[7] as string,
    saltA: t[8] as `0x${string}`,
    revealedA: t[9] as boolean,
    comboB: t[10] as string,
    saltB: t[11] as `0x${string}`,
    revealedB: t[12] as boolean,
    entropy: t[13] as bigint,
    revealDeadline: t[14] as bigint,
    status: Number(t[15]),
  }
}

function myRevealState(duel: DuelViewData, address: `0x${string}` | undefined): {
  iAmA: boolean
  inDuel: boolean
  iRevealed: boolean
  foeRevealed: boolean
} {
  const me = address?.toLowerCase()
  const iAmA = Boolean(me && duel.playerA.toLowerCase() === me)
  const iAmB = Boolean(me && duel.playerB.toLowerCase() === me)
  return {
    iAmA,
    inDuel: iAmA || iAmB,
    iRevealed: iAmA ? duel.revealedA : iAmB ? duel.revealedB : false,
    foeRevealed: iAmA ? duel.revealedB : iAmB ? duel.revealedA : duel.revealedA || duel.revealedB,
  }
}

export function useDuel() {
  const { address, chainId } = useAccount()
  const client = usePublicClient({ chainId: MONAD_TESTNET_ID })
  const { writeContractAsync } = useWriteContract()
  const inFlight = useRef(false)
  const [phase, setPhase] = useState<DuelTxPhase>('idle')
  const [error, setError] = useState<string | null>(null)

  const ready = duelContractReady() && Boolean(address) && chainId === MONAD_TESTNET_ID

  const countQuery = useReadContract({
    address: duelHouseAddress,
    abi: duelHouseAbi,
    functionName: 'duelCount',
    query: { enabled: duelContractReady() },
  })
  const count = Number(countQuery.data ?? 0n)

  const duelCalls = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        address: duelHouseAddress,
        abi: duelHouseAbi,
        functionName: 'duelAt' as const,
        args: [BigInt(index + 1)] as const,
      })),
    [count],
  )
  const duelsQuery = useReadContracts({
    contracts: duelCalls,
    query: { enabled: duelContractReady() && count > 0 },
  })

  const duels = useMemo((): DuelViewData[] => {
    return (duelsQuery.data ?? [])
      .map((row, index) => (row.result ? parseDuel(BigInt(index + 1), row.result) : null))
      .filter((row): row is DuelViewData => Boolean(row && row.status !== DuelStatus.None))
  }, [duelsQuery.data])

  const mine = useMemo(
    () =>
      duels
        .filter((duel) => {
          if (!address) return false
          const me = address.toLowerCase()
          return duel.playerA.toLowerCase() === me || duel.playerB.toLowerCase() === me
        })
        .sort((a, b) => {
          // active first (Committed > Open > Closed), then newest first
          const rank = (s: number) => (s === DuelStatus.Committed ? 0 : s === DuelStatus.Open ? 1 : 2)
          return rank(a.status) - rank(b.status) || Number(b.id - a.id)
        }),
    [address, duels],
  )
  const open = useMemo(
    () => duels.filter((duel) => duel.status === DuelStatus.Open).sort((a, b) => Number(b.id - a.id)),
    [duels],
  )

  const refresh = useCallback(async (): Promise<void> => {
    await Promise.all([countQuery.refetch(), duelsQuery.refetch()])
  }, [countQuery, duelsQuery])

  const send = useCallback(
    async (run: () => Promise<`0x${string}`>): Promise<boolean> => {
      if (inFlight.current || !client || !address) return false
      inFlight.current = true
      setError(null)
      setPhase('wallet')
      try {
        const hash = await run()
        setPhase('pending')
        await client.waitForTransactionReceipt({ hash })
        setPhase('done')
        await refresh()
        return true
      } catch (err) {
        setPhase('error')
        setError(humanError(err))
        return false
      } finally {
        inFlight.current = false
      }
    },
    [address, client, refresh],
  )

  const sendDuelTx = useCallback(
    async (functionName: 'cancelDuel' | 'claimTimeout' | 'claimRefund', duelId: bigint) => {
      if (!ready || !address || !client) return false
      return send(async () => {
        const gas = await client.estimateContractGas({
          address: duelHouseAddress,
          abi: duelHouseAbi,
          functionName,
          args: [duelId],
          account: address,
        })
        return writeContractAsync({
          address: duelHouseAddress,
          abi: duelHouseAbi,
          functionName,
          args: [duelId],
          gas: gas + gas / 10n,
        })
      })
    },
    [address, client, ready, send, writeContractAsync],
  )

  const commitFor = useCallback((combo: string[]): { salt: Hex; commit: Hex } => {
    const salt = randomSalt()
    return { salt, commit: duelCommit(combo, salt) }
  }, [])

  const create = useCallback(
    async (heroType: number, combo: string[], stakeMon: string): Promise<bigint | null> => {
      if (!ready || !address || !client) return null
      let stake: bigint
      try {
        stake = parseEther(stakeMon)
        if (stake < 0n) throw new Error('negative')
      } catch {
        setPhase('error')
        setError('押金格式不对。')
        return null
      }
      const { salt, commit } = commitFor(combo)
      const ok = await send(async () => {
        const gas = await client.estimateContractGas({
          address: duelHouseAddress,
          abi: duelHouseAbi,
          functionName: 'createDuel',
          args: [heroType, commit],
          account: address,
          value: stake,
        })
        return writeContractAsync({
          address: duelHouseAddress,
          abi: duelHouseAbi,
          functionName: 'createDuel',
          args: [heroType, commit],
          value: stake,
          gas: gas + gas / 10n,
        })
      })
      if (!ok) return null
      // The receipt is final but the follow-up read can lag a block; retry briefly rather
      // than drop the salt+commit (losing it forfeits the duel and stake on-chain).
      let duelId: bigint | undefined
      for (let attempt = 0; attempt < 5 && duelId === undefined; attempt += 1) {
        const ids = await client.readContract({
          address: duelHouseAddress,
          abi: duelHouseAbi,
          functionName: 'duelsOf',
          args: [address],
        })
        duelId = ids[ids.length - 1]
        if (duelId === undefined) await new Promise((resolve) => setTimeout(resolve, 1000))
      }
      if (duelId === undefined) {
        setPhase('error')
        setError('约战已上链，但取回对局号失败——刷新后从「我的约战」里复制链接。')
        return null
      }
      saveDuelCommit(window.localStorage, duelId, { salt, combo })
      return duelId
    },
    [address, client, commitFor, ready, send, writeContractAsync],
  )

  const accept = useCallback(
    async (duel: DuelViewData, heroType: number, combo: string[]): Promise<boolean> => {
      if (!ready || !address || !client) return false
      const { salt, commit } = commitFor(combo)
      const ok = await send(async () => {
        const gas = await client.estimateContractGas({
          address: duelHouseAddress,
          abi: duelHouseAbi,
          functionName: 'acceptDuel',
          args: [duel.id, heroType, commit],
          account: address,
          value: duel.stake,
        })
        return writeContractAsync({
          address: duelHouseAddress,
          abi: duelHouseAbi,
          functionName: 'acceptDuel',
          args: [duel.id, heroType, commit],
          value: duel.stake,
          gas: gas + gas / 10n,
        })
      })
      if (ok) saveDuelCommit(window.localStorage, duel.id, { salt, combo })
      return ok
    },
    [address, client, commitFor, ready, send, writeContractAsync],
  )

  const reveal = useCallback(
    async (duel: DuelViewData): Promise<boolean> => {
      const stored = loadDuelCommit(window.localStorage, duel.id)
      if (!stored) {
        setPhase('error')
        setError('本机找不到这局的盐和连招。约战承诺存在发起的那台设备上。')
        return false
      }
      const commit = duelCommit(stored.combo, stored.salt)
      const mine_ = myRevealState(duel, address)
      const expected = mine_.iAmA ? duel.commitA : duel.commitB
      if (commit.toLowerCase() !== expected.toLowerCase()) {
        setPhase('error')
        setError('本机存的连招和链上承诺对不上。')
        return false
      }
      if (!ready || !client) return false
      const plaintext = comboPlaintext(stored.combo)
      const salt = stored.salt
      return send(async () => {
        const gas = await client.estimateContractGas({
          address: duelHouseAddress,
          abi: duelHouseAbi,
          functionName: 'reveal',
          args: [duel.id, plaintext, salt],
          account: address,
        })
        return writeContractAsync({
          address: duelHouseAddress,
          abi: duelHouseAbi,
          functionName: 'reveal',
          args: [duel.id, plaintext, salt],
          gas: gas + gas / 10n,
        })
      })
    },
    [address, client, ready, send, writeContractAsync],
  )

  const cancel = useCallback(
    async (duelId: bigint): Promise<boolean> => sendDuelTx('cancelDuel', duelId),
    [sendDuelTx],
  )
  const claimTimeout = useCallback(
    async (duelId: bigint): Promise<boolean> => sendDuelTx('claimTimeout', duelId),
    [sendDuelTx],
  )
  const claimRefund = useCallback(
    async (duelId: bigint): Promise<boolean> => sendDuelTx('claimRefund', duelId),
    [sendDuelTx],
  )

  const requestSettlement = useCallback(
    async (duelId: bigint): Promise<MatchPayload | null> => {
      try {
        const data = await sendWs<{ type: 'matched'; payload: MatchPayload }>({
          type: 'duel_settle',
          duelId: duelId.toString(),
        }, '约战服务')
        return data.payload
      } catch (err) {
        setPhase('error')
        setError(err instanceof Error ? err.message : '结算请求失败')
        return null
      }
    },
    [],
  )

  const settle = useCallback(
    async (payload: MatchPayload): Promise<boolean> => {
      if (!ready || !address || !client || !payload.duel) return false
      const message = payloadToMatchMessage(payload)
      const duelId = BigInt(payload.duel.duelId)
      return send(async () => {
        const gas = await client.estimateContractGas({
          address: duelHouseAddress,
          abi: duelHouseAbi,
          functionName: 'settle',
          args: [duelId, message, payload.signature],
          account: address,
        })
        return writeContractAsync({
          address: duelHouseAddress,
          abi: duelHouseAbi,
          functionName: 'settle',
          args: [duelId, message, payload.signature],
          gas: gas + gas / 10n,
        })
      })
    },
    [address, client, ready, send, writeContractAsync],
  )

  return {
    ready,
    loading: countQuery.isLoading,
    phase,
    error,
    duels,
    open,
    mine,
    create,
    accept,
    reveal,
    cancel,
    claimTimeout,
    claimRefund,
    requestSettlement,
    settle,
    refresh,
  }
}
