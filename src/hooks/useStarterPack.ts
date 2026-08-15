import { useCallback, useRef, useState } from 'react'
import { BaseError, UserRejectedRequestError } from 'viem'
import { useAccount, usePublicClient, useReadContract, useWriteContract } from 'wagmi'
import { heroNftAbi } from '../lib/abi'
import { MONAD_TESTNET_ID } from '../lib/chain'

export type ClaimPhase = 'idle' | 'wallet' | 'pending' | 'done' | 'rejected' | 'error'

const nftAddress = (import.meta.env.VITE_HERO_NFT_ADDRESS ||
  '0x0000000000000000000000000000000000000000') as `0x${string}`

function isUserRejection(error: unknown): boolean {
  if (error instanceof UserRejectedRequestError) return true
  if (error instanceof BaseError) {
    return error.walk((err) => err instanceof UserRejectedRequestError) instanceof UserRejectedRequestError
  }
  const message = error instanceof Error ? error.message : String(error)
  return /user rejected|user denied|rejected the request/i.test(message)
}

function humanError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/alreadyclaimed/i.test(message)) return '这四个英雄已经在链上登记过了。'
  if (/insufficient funds|exceeds the balance/i.test(message)) return '测试网 MON 不够付 gas，先去水龙头领一点。'
  if (/network|chain/i.test(message)) return '请把钱包切换到 Monad Testnet 后再试。'
  return '领取没成功。对战需要这四名英雄，请再试一次。'
}

export function useStarterPack() {
  const { address, chainId } = useAccount()
  const client = usePublicClient({ chainId: MONAD_TESTNET_ID })
  const { writeContractAsync } = useWriteContract()
  const inFlight = useRef(false)
  const [phase, setPhase] = useState<ClaimPhase>('idle')
  const [error, setError] = useState<string | null>(null)

  const contractReady = Boolean(address) && !nftAddress.endsWith('0000')
  const onMonad = chainId === MONAD_TESTNET_ID

  const { data: claimedOnchain, isLoading, refetch } = useReadContract({
    address: nftAddress,
    abi: heroNftAbi,
    functionName: 'claimedStarter',
    args: address ? [address] : undefined,
    query: { enabled: contractReady && onMonad },
  })

  const claimed = claimedOnchain === true || phase === 'done'

  const claim = useCallback(async (): Promise<void> => {
    if (inFlight.current || !address || !client || claimed) return
    if (!onMonad) {
      setPhase('error')
      setError('请先把钱包切换到 Monad Testnet。右上角网络图标可以切换。')
      return
    }

    inFlight.current = true
    setError(null)
    setPhase('wallet')
    try {
      const already = await client.readContract({
        address: nftAddress,
        abi: heroNftAbi,
        functionName: 'claimedStarter',
        args: [address],
      })
      if (already) {
        setPhase('done')
        await refetch()
        return
      }

      const gas = await client.estimateContractGas({
        address: nftAddress,
        abi: heroNftAbi,
        functionName: 'claimStarterPack',
        account: address,
      })
      const hash = await writeContractAsync({
        address: nftAddress,
        abi: heroNftAbi,
        functionName: 'claimStarterPack',
        gas: gas + gas / 10n,
      })
      setPhase('pending')
      await client.waitForTransactionReceipt({ hash })
      setPhase('done')
      await refetch()
    } catch (err) {
      if (isUserRejection(err)) {
        setPhase('rejected')
        setError('对战必须先领取四名英雄。刚才在钱包里取消了，请再点一次并确认。整包只需一笔交易。')
        return
      }
      setPhase('error')
      setError(humanError(err))
    } finally {
      inFlight.current = false
    }
  }, [address, claimed, client, onMonad, refetch, writeContractAsync])

  return {
    claimed,
    checking: isLoading,
    phase,
    error,
    wrongNetwork: Boolean(address) && !onMonad,
    canClaim:
      contractReady &&
      onMonad &&
      claimedOnchain === false &&
      phase !== 'wallet' &&
      phase !== 'pending',
    claim,
  }
}
