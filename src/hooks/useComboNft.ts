import { useCallback, useMemo, useRef, useState } from 'react'
import { BaseError, UserRejectedRequestError, parseEther } from 'viem'
import { useAccount, usePublicClient, useReadContract, useReadContracts, useWriteContract } from 'wagmi'
import { comboNftAbi } from '../lib/abi'
import { MONAD_TESTNET_ID } from '../lib/chain'
import { encodeComboIndexes, type ComboRecord } from '../lib/comboNft'
import type { Hero } from '../lib/types'

export type ComboTxPhase = 'idle' | 'wallet' | 'pending' | 'done' | 'error'

export const comboNftAddress = (import.meta.env.VITE_COMBO_NFT_ADDRESS ||
  '0x0000000000000000000000000000000000000000') as `0x${string}`

export function comboContractReady(): boolean {
  return !comboNftAddress.endsWith('0000')
}

function isUserRejection(error: unknown): boolean {
  if (error instanceof UserRejectedRequestError) return true
  if (error instanceof BaseError) {
    return error.walk((err) => err instanceof UserRejectedRequestError) instanceof UserRejectedRequestError
  }
  const message = error instanceof Error ? error.message : String(error)
  return /user rejected|user denied|rejected the request/i.test(message)
}

function humanError(error: unknown): string {
  if (isUserRejection(error)) return '钱包里取消了这一笔。'
  const message = error instanceof Error ? error.message : String(error)
  if (/needhero/i.test(message)) return '要先拥有这名英雄，才能铸造他的连招。'
  if (/badcombo|badskill|badherotype/i.test(message)) return '这套连招链上校验没过。'
  if (/notowner/i.test(message)) return '这枚连招 NFT 已经不属于你。'
  if (/notlisted/i.test(message)) return '这枚还没挂单，或刚被人买走。'
  if (/badprice/i.test(message)) return '价格不对。挂单必须大于 0，买入要付整价。'
  if (/selfbuy/i.test(message)) return '不能买自己挂的单。'
  if (/insufficient funds|exceeds the balance/i.test(message)) return '测试网 MON 不够付价或 gas。'
  if (/network|chain/i.test(message)) return '请先切到 Monad Testnet。'
  return '交易没成功，请再试一次。'
}

export function useComboNft(heroType?: number) {
  const { address, chainId } = useAccount()
  const client = usePublicClient({ chainId: MONAD_TESTNET_ID })
  const { writeContractAsync } = useWriteContract()
  const inFlight = useRef(false)
  const [phase, setPhase] = useState<ComboTxPhase>('idle')
  const [error, setError] = useState<string | null>(null)

  const ready = comboContractReady() && Boolean(address) && chainId === MONAD_TESTNET_ID

  const balanceQuery = useReadContract({
    address: comboNftAddress,
    abi: comboNftAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: ready },
  })

  const balance = Number(balanceQuery.data ?? 0n)
  const tokenIdCalls = useMemo(
    () =>
      Array.from({ length: balance }, (_, index) => ({
        address: comboNftAddress,
        abi: comboNftAbi,
        functionName: 'tokenOfOwnerByIndex' as const,
        args: [address as `0x${string}`, BigInt(index)] as const,
      })),
    [address, balance],
  )

  const tokenIdsQuery = useReadContracts({
    contracts: tokenIdCalls,
    query: { enabled: ready && balance > 0 },
  })

  const tokenIds = useMemo(
    () =>
      (tokenIdsQuery.data ?? [])
        .map((row) => row.result)
        .filter((id): id is bigint => typeof id === 'bigint'),
    [tokenIdsQuery.data],
  )

  const comboCalls = useMemo(
    () =>
      tokenIds.map((tokenId) => ({
        address: comboNftAddress,
        abi: comboNftAbi,
        functionName: 'getCombo' as const,
        args: [tokenId] as const,
      })),
    [tokenIds],
  )
  const listingOfCalls = useMemo(
    () =>
      tokenIds.map((tokenId) => ({
        address: comboNftAddress,
        abi: comboNftAbi,
        functionName: 'listingOf' as const,
        args: [tokenId] as const,
      })),
    [tokenIds],
  )

  const comboQuery = useReadContracts({
    contracts: comboCalls,
    query: { enabled: ready && tokenIds.length > 0 },
  })
  const listingOfQuery = useReadContracts({
    contracts: listingOfCalls,
    query: { enabled: ready && tokenIds.length > 0 },
  })

  const owned = useMemo((): ComboRecord[] => {
    const rows: ComboRecord[] = []
    for (let i = 0; i < tokenIds.length; i++) {
      const comboRow = comboQuery.data?.[i]?.result
      const listingRow = listingOfQuery.data?.[i]?.result
      if (!comboRow) continue
      const [typeId, skillIndexes] = comboRow
      if (heroType !== undefined && typeId !== heroType) continue
      const price = listingRow?.[1] ?? 0n
      rows.push({
        tokenId: tokenIds[i] ?? 0n,
        heroType: typeId,
        skillIndexes: [...skillIndexes],
        priceWei: price,
        seller: listingRow?.[0] ?? null,
      })
    }
    return rows
  }, [comboQuery.data, heroType, listingOfQuery.data, tokenIds])

  const listingCountQuery = useReadContract({
    address: comboNftAddress,
    abi: comboNftAbi,
    functionName: 'listingCount',
    query: { enabled: comboContractReady() },
  })
  const listingCount = Number(listingCountQuery.data ?? 0n)

  const listingCalls = useMemo(
    () =>
      Array.from({ length: listingCount }, (_, index) => ({
        address: comboNftAddress,
        abi: comboNftAbi,
        functionName: 'listingAt' as const,
        args: [BigInt(index)] as const,
      })),
    [listingCount],
  )

  const listingsQuery = useReadContracts({
    contracts: listingCalls,
    query: { enabled: comboContractReady() && listingCount > 0 },
  })

  const listings = useMemo((): ComboRecord[] => {
    return (listingsQuery.data ?? [])
      .map((row) => row.result)
      .filter((row): row is readonly [bigint, `0x${string}`, bigint, number, readonly number[]] => Boolean(row))
      .map(([tokenId, seller, price, typeId, skillIndexes]) => ({
        tokenId,
        heroType: typeId,
        skillIndexes: [...skillIndexes],
        priceWei: price,
        seller,
      }))
  }, [listingsQuery.data])

  const refresh = useCallback(async (): Promise<void> => {
    await Promise.all([
      balanceQuery.refetch(),
      listingCountQuery.refetch(),
      tokenIdsQuery.refetch(),
      comboQuery.refetch(),
      listingOfQuery.refetch(),
      listingsQuery.refetch(),
    ])
  }, [balanceQuery, comboQuery, listingCountQuery, listingOfQuery, listingsQuery, tokenIdsQuery])

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

  const mint = useCallback(
    async (hero: Hero, skillIds: string[]): Promise<boolean> => {
      if (!ready || !address || !client) return false
      const indexes = encodeComboIndexes(hero, skillIds)
      return send(async () => {
        const gas = await client.estimateContractGas({
          address: comboNftAddress,
          abi: comboNftAbi,
          functionName: 'mint',
          args: [hero.typeId, indexes],
          account: address,
        })
        return writeContractAsync({
          address: comboNftAddress,
          abi: comboNftAbi,
          functionName: 'mint',
          args: [hero.typeId, indexes],
          gas: gas + gas / 10n,
        })
      })
    },
    [address, client, ready, send, writeContractAsync],
  )

  const list = useCallback(
    async (tokenId: bigint, priceMon: string): Promise<boolean> => {
      if (!ready || !address || !client) return false
      let price: bigint
      try {
        price = parseEther(priceMon)
      } catch {
        setPhase('error')
        setError('价格格式不对。')
        return false
      }
      if (price === 0n) {
        setPhase('error')
        setError('挂单价格必须大于 0。')
        return false
      }
      return send(async () => {
        const gas = await client.estimateContractGas({
          address: comboNftAddress,
          abi: comboNftAbi,
          functionName: 'list',
          args: [tokenId, price],
          account: address,
        })
        return writeContractAsync({
          address: comboNftAddress,
          abi: comboNftAbi,
          functionName: 'list',
          args: [tokenId, price],
          gas: gas + gas / 10n,
        })
      })
    },
    [address, client, ready, send, writeContractAsync],
  )

  const cancel = useCallback(
    async (tokenId: bigint): Promise<boolean> => {
      if (!ready || !address || !client) return false
      return send(async () => {
        const gas = await client.estimateContractGas({
          address: comboNftAddress,
          abi: comboNftAbi,
          functionName: 'cancel',
          args: [tokenId],
          account: address,
        })
        return writeContractAsync({
          address: comboNftAddress,
          abi: comboNftAbi,
          functionName: 'cancel',
          args: [tokenId],
          gas: gas + gas / 10n,
        })
      })
    },
    [address, client, ready, send, writeContractAsync],
  )

  const buy = useCallback(
    async (tokenId: bigint, priceWei: bigint): Promise<boolean> => {
      if (!ready || !address || !client) return false
      return send(async () => {
        const gas = await client.estimateContractGas({
          address: comboNftAddress,
          abi: comboNftAbi,
          functionName: 'buy',
          args: [tokenId],
          account: address,
          value: priceWei,
        })
        return writeContractAsync({
          address: comboNftAddress,
          abi: comboNftAbi,
          functionName: 'buy',
          args: [tokenId],
          value: priceWei,
          gas: gas + gas / 10n,
        })
      })
    },
    [address, client, ready, send, writeContractAsync],
  )

  return {
    ready,
    owned,
    listings,
    loading: balanceQuery.isLoading || listingCountQuery.isLoading,
    phase,
    error,
    mint,
    list,
    cancel,
    buy,
  }
}
