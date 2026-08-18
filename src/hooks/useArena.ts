import { useCallback, useMemo, useRef, useState } from 'react'
import { BaseError, UserRejectedRequestError, formatEther, parseEther } from 'viem'
import { useAccount, usePublicClient, useReadContract, useReadContracts, useWriteContract } from 'wagmi'
import { arenaAbi } from '../lib/abi'
import { hashCombo } from '../lib/arena'
import { MONAD_TESTNET_ID } from '../lib/chain'
import { payloadToMatchMessage } from '../lib/signing'
import type { MatchPayload } from '../lib/types'

export type ArenaTxPhase = 'idle' | 'wallet' | 'pending' | 'done' | 'error'

export const arenaAddress = (import.meta.env.VITE_ARENA_ADDRESS ||
  '0x0000000000000000000000000000000000000000') as `0x${string}`

export function arenaContractReady(): boolean {
  return !arenaAddress.endsWith('0000')
}

export const ArenaStatus = {
  None: 0,
  Open: 1,
  Pending: 2,
  Closed: 3,
} as const

export interface ArenaStandView {
  id: bigint
  defender: `0x${string}`
  heroType: number
  comboHash: `0x${string}`
  stake: bigint
  defendCount: number
  status: number
  challenger: `0x${string}`
  challengerHero: number
  challengerComboHash: `0x${string}`
  nonce: bigint
  entropy: bigint
}

function isUserRejection(error: unknown): boolean {
  if (error instanceof UserRejectedRequestError) return true
  if (error instanceof BaseError) {
    return error.walk((err) => err instanceof UserRejectedRequestError) instanceof UserRejectedRequestError
  }
  return /user rejected|user denied|rejected the request/i.test(
    error instanceof Error ? error.message : String(error),
  )
}

function humanError(error: unknown): string {
  if (isUserRejection(error)) return '钱包里取消了这一笔。'
  const message = error instanceof Error ? error.message : String(error)
  if (/needhero/i.test(message)) return '要先拥有这名英雄，才能上擂或挑战。'
  if (/badstake/i.test(message)) return '押金不对。上擂要达到最低额，挑战必须等额。'
  if (/notopen|challengepending|alreadyresolved/i.test(message)) return '这座擂台现在不能这样操作。'
  if (/combohashmismatch/i.test(message)) return '连招和上链时的哈希对不上。'
  if (/insufficient funds|exceeds the balance/i.test(message)) return '测试网 MON 不够付押金或 gas。'
  if (/network|chain/i.test(message)) return '请先切到 Monad Testnet。'
  return '交易没成功，请再试一次。'
}

function parseStand(id: bigint, row: unknown): ArenaStandView {
  const named = row as {
    defender: `0x${string}`
    heroType: number
    comboHash: `0x${string}`
    stake: bigint
    defendCount: number
    status: number
    challenger: `0x${string}`
    challengerHero: number
    challengerComboHash: `0x${string}`
    nonce: bigint
    entropy: bigint
  }
  if (named && typeof named === 'object' && 'defender' in named) {
    return {
      id,
      defender: named.defender,
      heroType: Number(named.heroType),
      comboHash: named.comboHash,
      stake: named.stake,
      defendCount: Number(named.defendCount),
      status: Number(named.status),
      challenger: named.challenger,
      challengerHero: Number(named.challengerHero),
      challengerComboHash: named.challengerComboHash,
      nonce: named.nonce,
      entropy: named.entropy,
    }
  }
  const tuple = row as readonly unknown[]
  return {
    id,
    defender: tuple[0] as `0x${string}`,
    heroType: Number(tuple[1]),
    comboHash: tuple[2] as `0x${string}`,
    stake: tuple[3] as bigint,
    defendCount: Number(tuple[4]),
    status: Number(tuple[5]),
    challenger: tuple[6] as `0x${string}`,
    challengerHero: Number(tuple[7]),
    challengerComboHash: tuple[8] as `0x${string}`,
    nonce: tuple[9] as bigint,
    entropy: tuple[10] as bigint,
  }
}

async function sendWs<T>(body: unknown): Promise<T> {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const url = `${proto}://${window.location.host}/ws`
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const timer = window.setTimeout(() => {
      ws.close()
      reject(new Error('擂台服务超时'))
    }, 20_000)
    ws.onopen = () => ws.send(JSON.stringify(body))
    ws.onmessage = (ev) => {
      window.clearTimeout(timer)
      const data = JSON.parse(ev.data as string) as T & { type?: string; message?: string }
      ws.close()
      if (data && typeof data === 'object' && 'type' in data && data.type === 'error') {
        reject(new Error(data.message || '擂台服务错误'))
        return
      }
      resolve(data)
    }
    ws.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error('擂台服务不可用'))
    }
  })
}

export function useArena() {
  const { address, chainId } = useAccount()
  const client = usePublicClient({ chainId: MONAD_TESTNET_ID })
  const { writeContractAsync } = useWriteContract()
  const inFlight = useRef(false)
  const [phase, setPhase] = useState<ArenaTxPhase>('idle')
  const [error, setError] = useState<string | null>(null)

  const ready = arenaContractReady() && Boolean(address) && chainId === MONAD_TESTNET_ID

  const minStakeQuery = useReadContract({
    address: arenaAddress,
    abi: arenaAbi,
    functionName: 'minStake',
    query: { enabled: arenaContractReady() },
  })
  const countQuery = useReadContract({
    address: arenaAddress,
    abi: arenaAbi,
    functionName: 'standCount',
    query: { enabled: arenaContractReady() },
  })
  const count = Number(countQuery.data ?? 0n)

  const standCalls = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        address: arenaAddress,
        abi: arenaAbi,
        functionName: 'standAt' as const,
        args: [BigInt(index + 1)] as const,
      })),
    [count],
  )
  const standsQuery = useReadContracts({
    contracts: standCalls,
    query: { enabled: arenaContractReady() && count > 0 },
  })

  const stands = useMemo((): ArenaStandView[] => {
    return (standsQuery.data ?? [])
      .map((row, index) => {
        const value = row.result
        if (!value) return null
        return parseStand(BigInt(index + 1), value)
      })
      .filter((row): row is ArenaStandView => Boolean(row))
  }, [standsQuery.data])

  const mine = useMemo(
    () => stands.filter((stand) => address && stand.defender.toLowerCase() === address.toLowerCase()),
    [address, stands],
  )
  const open = useMemo(() => stands.filter((stand) => stand.status === ArenaStatus.Open), [stands])

  const refresh = useCallback(async (): Promise<void> => {
    await Promise.all([minStakeQuery.refetch(), countQuery.refetch(), standsQuery.refetch()])
  }, [countQuery, minStakeQuery, standsQuery])

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

  const createStand = useCallback(
    async (heroType: number, combo: string[], stakeMon: string): Promise<bigint | null> => {
      if (!ready || !address || !client) return null
      let stake: bigint
      try {
        stake = parseEther(stakeMon)
      } catch {
        setPhase('error')
        setError('押金格式不对。')
        return null
      }
      const comboHash = hashCombo(combo)
      const ok = await send(async () => {
        const gas = await client.estimateContractGas({
          address: arenaAddress,
          abi: arenaAbi,
          functionName: 'createStand',
          args: [heroType, comboHash],
          account: address,
          value: stake,
        })
        return writeContractAsync({
          address: arenaAddress,
          abi: arenaAbi,
          functionName: 'createStand',
          args: [heroType, comboHash],
          value: stake,
          gas: gas + gas / 10n,
        })
      })
      if (!ok) return null
      const ids = await client.readContract({
        address: arenaAddress,
        abi: arenaAbi,
        functionName: 'standsOf',
        args: [address],
      })
      const standId = ids[ids.length - 1]
      if (standId === undefined) return null
      try {
        await sendWs({ type: 'stand_store', standId: standId.toString(), combo, role: 'defender' })
      } catch (err) {
        setPhase('error')
        setError(err instanceof Error ? err.message : '连招没存上')
        return null
      }
      return standId
    },
    [address, client, ready, send, writeContractAsync],
  )

  const challenge = useCallback(
    async (stand: ArenaStandView, heroType: number, combo: string[]): Promise<MatchPayload | null> => {
      if (!ready || !address || !client) return null
      const comboHash = hashCombo(combo)
      const ok = await send(async () => {
        const gas = await client.estimateContractGas({
          address: arenaAddress,
          abi: arenaAbi,
          functionName: 'challenge',
          args: [stand.id, heroType, comboHash],
          account: address,
          value: stand.stake,
        })
        return writeContractAsync({
          address: arenaAddress,
          abi: arenaAbi,
          functionName: 'challenge',
          args: [stand.id, heroType, comboHash],
          value: stand.stake,
          gas: gas + gas / 10n,
        })
      })
      if (!ok) return null
      try {
        const data = await sendWs<{ type: 'matched'; payload: MatchPayload }>({
          type: 'arena_challenge',
          standId: stand.id.toString(),
          combo,
        })
        return data.payload
      } catch (err) {
        setPhase('error')
        setError(err instanceof Error ? err.message : '结算准备失败')
        return null
      }
    },
    [address, client, ready, send, writeContractAsync],
  )

  const withdraw = useCallback(
    async (standId: bigint): Promise<boolean> => {
      if (!ready || !address || !client) return false
      return send(async () => {
        const gas = await client.estimateContractGas({
          address: arenaAddress,
          abi: arenaAbi,
          functionName: 'withdraw',
          args: [standId],
          account: address,
        })
        return writeContractAsync({
          address: arenaAddress,
          abi: arenaAbi,
          functionName: 'withdraw',
          args: [standId],
          gas: gas + gas / 10n,
        })
      })
    },
    [address, client, ready, send, writeContractAsync],
  )

  const resolve = useCallback(
    async (payload: MatchPayload): Promise<boolean> => {
      if (!ready || !address || !client || !payload.arena) return false
      const message = payloadToMatchMessage(payload)
      const standId = BigInt(payload.arena.standId)
      return send(async () => {
        const gas = await client.estimateContractGas({
          address: arenaAddress,
          abi: arenaAbi,
          functionName: 'resolve',
          args: [
            standId,
            message,
            payload.signature,
            payload.arena!.defenderCombo,
            payload.arena!.challengerCombo,
          ],
          account: address,
        })
        return writeContractAsync({
          address: arenaAddress,
          abi: arenaAbi,
          functionName: 'resolve',
          args: [
            standId,
            message,
            payload.signature,
            payload.arena!.defenderCombo,
            payload.arena!.challengerCombo,
          ],
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
    minStake: minStakeQuery.data ?? 0n,
    minStakeLabel: formatEther(minStakeQuery.data ?? 0n),
    stands,
    open,
    mine,
    createStand,
    challenge,
    withdraw,
    resolve,
    refresh,
  }
}
