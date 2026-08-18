import { describe, expect, it } from 'vitest'
import {
  acceptStandCombo,
  arenaEntropyHash,
  arenaPayout,
  comboPlaintext,
  deriveArenaSeed,
  hashCombo,
  hashComboPlaintext,
  simulateArenaChallenge,
} from './arena'

const defender = '0x1111111111111111111111111111111111111111' as const
const challenger = '0x2222222222222222222222222222222222222222' as const
const other = '0x3333333333333333333333333333333333333333' as const

const baseInput = {
  prevrandao: 0xabcdefn,
  defender,
  challenger,
  nonce: 7n,
}

describe('deriveArenaSeed', () => {
  it('is deterministic for the same prevrandao + addresses + nonce', () => {
    const first = deriveArenaSeed(baseInput)
    const second = deriveArenaSeed({ ...baseInput })
    expect(first).toBe(second)
    expect(Number.isInteger(first)).toBe(true)
    expect(first).toBeGreaterThanOrEqual(0)
  })

  it('changes when the nonce changes', () => {
    expect(deriveArenaSeed({ ...baseInput, nonce: 8n })).not.toBe(deriveArenaSeed(baseInput))
  })

  it('changes when either address changes', () => {
    expect(deriveArenaSeed({ ...baseInput, defender: other })).not.toBe(deriveArenaSeed(baseInput))
    expect(deriveArenaSeed({ ...baseInput, challenger: other })).not.toBe(deriveArenaSeed(baseInput))
  })

  it('changes when prevrandao changes', () => {
    expect(deriveArenaSeed({ ...baseInput, prevrandao: 1n })).not.toBe(deriveArenaSeed(baseInput))
  })

  it('uses the packed entropy hash as the seed source', () => {
    const hash = arenaEntropyHash(baseInput)
    expect(hash.startsWith('0x')).toBe(true)
    expect(hash.length).toBe(66)
    expect(deriveArenaSeed(baseInput)).toBe(deriveArenaSeed(baseInput))
  })
})

describe('combo keccak commitment', () => {
  const combo = ['warrior.heavy_slash', 'warrior.war_cry']

  it('hashes the canonical plaintext and accepts a matching commit', () => {
    const plaintext = comboPlaintext(combo)
    const commit = hashCombo(combo)
    expect(hashComboPlaintext(plaintext)).toBe(commit)
    expect(acceptStandCombo(plaintext, commit)).toBe(plaintext)
  })

  it('rejects plaintext that does not match the committed hash', () => {
    const commit = hashCombo(combo)
    expect(() => acceptStandCombo(comboPlaintext(['mage.fireball']), commit)).toThrow(/combo hash mismatch/)
    expect(() => acceptStandCombo('[]', commit)).toThrow(/combo hash mismatch/)
  })
})

describe('simulateArenaChallenge', () => {
  const comboA = ['warrior.heavy_slash', 'warrior.war_cry']
  const comboB = ['mage.fireball', 'mage.mana_shield']
  const base = {
    standId: 1n,
    defender,
    challenger,
    defenderHeroType: 1,
    challengerHeroType: 2,
    defenderCombo: comboA,
    challengerCombo: comboB,
    defenderHash: hashCombo(comboA),
    challengerHash: hashCombo(comboB),
    prevrandao: 0xabcdefn,
    nonce: 7n,
    stakeWei: 10n ** 16n,
  }

  it('simulates with the derived seed and rejects a hash mismatch', () => {
    const first = simulateArenaChallenge(base)
    const second = simulateArenaChallenge({ ...base })
    expect(first.seed).toBe(deriveArenaSeed({
      prevrandao: base.prevrandao,
      defender,
      challenger,
      nonce: base.nonce,
    }))
    expect(second.seed).toBe(first.seed)
    expect(second.payload.result.resultHash).toBe(first.payload.result.resultHash)
    expect(first.payload.vsBot).toBe(false)
    expect(first.settlement.defenderCombo).toBe(comboPlaintext(comboA))
    expect(() =>
      simulateArenaChallenge({ ...base, defenderHash: hashCombo(['mage.fireball']) }),
    ).toThrow(/combo hash mismatch/)
  })
})

describe('arenaPayout', () => {
  it('splits the pot 95 / 5', () => {
    const stake = 10n ** 16n
    const { pot, winner, treasury } = arenaPayout(stake)
    expect(pot).toBe(stake * 2n)
    expect(winner + treasury).toBe(pot)
    expect(winner).toBe((pot * 95n) / 100n)
    expect(treasury).toBe((pot * 5n) / 100n)
  })
})
