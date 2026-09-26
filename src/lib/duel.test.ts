import { describe, expect, it } from 'vitest'
import {
  deriveDuelSeed,
  duelCommit,
  duelCommitStorageKey,
  duelMatchId,
  loadDuelCommit,
  parseComboPlaintext,
  randomSalt,
  revealMatchesCommit,
  saveDuelCommit,
  simulateDuel,
} from './duel'
import { comboPlaintext } from './arena'

const saltA = `0x${'aa'.repeat(32)}` as const
const saltB = `0x${'bb'.repeat(32)}` as const
const comboA = ['warrior.heavy_slash', 'warrior.war_cry']
const comboB = ['mage.fireball', 'mage.mana_shield']

describe('duelCommit', () => {
  it('matches the on-chain commitOf formula (golden vector)', () => {
    // cast: keccak256(abi.encodePacked(keccak256(bytes('["warrior.heavy_slash","warrior.war_cry"]')), 0xcc…cc))
    const commit = duelCommit(comboA, `0x${'cc'.repeat(32)}` as const)
    expect(commit).toBe('0xd52bc5c6b890ff956f982fc9e05766c9f65676a52ca69e542b41a775cac2f325')
  })

  it('changes with salt or combo', () => {
    const base = duelCommit(comboA, saltA)
    expect(duelCommit(comboA, saltB)).not.toBe(base)
    expect(duelCommit(comboB, saltA)).not.toBe(base)
    expect(revealMatchesCommit(comboA, saltA, base)).toBe(true)
    expect(revealMatchesCommit(comboB, saltA, base)).toBe(false)
  })
})

describe('deriveDuelSeed', () => {
  const entropy = 0xbeefn

  it('matches the on-chain deriveSeed formula (golden vector)', () => {
    // cast: keccak256(abi.encodePacked(0xaa…aa, 0xbb…bb, 0xbeef)) → 0x2bfcf…60dc, low 32 bits
    expect(deriveDuelSeed({ saltA, saltB, entropy })).toBe(0x61df60dc)
  })

  it('is deterministic and order-sensitive', () => {
    const forward = deriveDuelSeed({ saltA, saltB, entropy })
    expect(deriveDuelSeed({ saltA, saltB, entropy })).toBe(forward)
    expect(deriveDuelSeed({ saltA: saltB, saltB: saltA, entropy })).not.toBe(forward)
    expect(deriveDuelSeed({ saltA, saltB, entropy: entropy + 1n })).not.toBe(forward)
    expect(Number.isInteger(forward)).toBe(true)
  })
})

describe('duelMatchId', () => {
  it('matches keccak256(abi.encodePacked("duel", duelId)) (golden vector)', () => {
    expect(duelMatchId(1n)).toBe('0xc433ddbd63eb4d83b9abe1fd1f3dcd1d8964a64cd5d71da4596ecff5768d6e76')
    expect(duelMatchId(2n)).not.toBe(duelMatchId(1n))
  })
})

describe('duel commit storage', () => {
  it('round-trips a saved commit record', () => {
    const store = new Map<string, string>()
    const storage = {
      setItem: (k: string, v: string) => void store.set(k, v),
      getItem: (k: string) => store.get(k) ?? null,
    }
    saveDuelCommit(storage, 7n, { salt: saltA, combo: [...comboA] })
    expect(loadDuelCommit(storage, 7n)).toEqual({ salt: saltA, combo: comboA })
    expect(loadDuelCommit(storage, 8n)).toBeNull()
    store.set(duelCommitStorageKey(9n), 'not json')
    expect(loadDuelCommit(storage, 9n)).toBeNull()
  })
})

describe('simulateDuel', () => {
  const base = {
    duelId: 3n,
    playerA: '0x1111111111111111111111111111111111111111' as const,
    playerB: '0x2222222222222222222222222222222222222222' as const,
    heroA: 1,
    heroB: 2,
    comboA: comboPlaintext(comboA),
    saltA,
    commitA: duelCommit(comboA, saltA),
    comboB: comboPlaintext(comboB),
    saltB,
    commitB: duelCommit(comboB, saltB),
    entropy: 0xbeefn,
    stakeWei: 10n ** 16n,
  }

  it('derives the on-chain seed and simulates deterministically', () => {
    const first = simulateDuel(base)
    const second = simulateDuel({ ...base })
    expect(first.seed).toBe(0x61df60dc)
    expect(first.payload.matchId).toBe(duelMatchId(3n))
    expect(second.payload.result.resultHash).toBe(first.payload.result.resultHash)
    expect(first.payload.vsBot).toBe(false)
    expect(first.payload.duel).toEqual(first.settlement)
    expect(BigInt(first.settlement.winnerPayoutWei) + BigInt(first.settlement.treasuryWei)).toBe(
      base.stakeWei * 2n,
    )
  })

  it('rejects reveals that do not match the commitment', () => {
    expect(() => simulateDuel({ ...base, commitA: duelCommit(comboB, saltA) })).toThrow(/mismatch/)
    expect(() => simulateDuel({ ...base, commitB: duelCommit(comboB, saltA) })).toThrow(/mismatch/)
    expect(() => simulateDuel({ ...base, comboA: '[]' })).toThrow()
  })
})

describe('randomSalt', () => {
  it('returns distinct 32-byte hex strings', () => {
    const a = randomSalt()
    const b = randomSalt()
    expect(a).toMatch(/^0x[0-9a-f]{64}$/)
    expect(b).toMatch(/^0x[0-9a-f]{64}$/)
    expect(a).not.toBe(b)
  })
})

describe('parseComboPlaintext', () => {
  it('parses valid plaintext and rejects bad shapes', () => {
    expect(parseComboPlaintext('["a","b"]')).toEqual(['a', 'b'])
    expect(() => parseComboPlaintext('"a"')).toThrow()
    expect(() => parseComboPlaintext('[1]')).toThrow()
    expect(() => parseComboPlaintext('{')).toThrow()
  })
})
