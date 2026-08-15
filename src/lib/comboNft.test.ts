import { describe, expect, it } from 'vitest'
import { generateAutoCombo, planCombo } from './combo'
import {
  COMBO_MAX_SKILLS,
  comboFromOnchain,
  comboIsLegal,
  comboLabel,
  decodeComboIndexes,
  encodeComboIndexes,
  sameCombo,
} from './comboNft'
import { getHero } from './heroes'

const warrior = getHero('warrior')

describe('combo NFT codec', () => {
  it('round-trips skill ids through hero-local indexes', () => {
    const ids = ['warrior.heavy_slash', 'warrior.shield_bash', 'warrior.war_cry']
    const indexes = encodeComboIndexes(warrior, ids)
    expect(indexes).toEqual([0, 1, 2])
    expect(decodeComboIndexes(warrior, indexes)).toEqual(ids)
  })

  it('rejects another hero skill or an empty list', () => {
    expect(() => encodeComboIndexes(warrior, ['mage.fireball'])).toThrow(/not on warrior/)
    expect(() => encodeComboIndexes(warrior, [])).toThrow(/empty/)
    expect(() => encodeComboIndexes(warrior, Array.from({ length: COMBO_MAX_SKILLS + 1 }, () => 'warrior.heavy_slash'))).toThrow(
      /too long/,
    )
  })

  it('rebuilds a loadout from on-chain hero type + indexes', () => {
    const loadout = comboFromOnchain(2, [0, 2, 1])
    expect(loadout.heroId).toBe('mage')
    expect(loadout.combo).toEqual(['mage.fireball', 'mage.mana_shield', 'mage.ice_spike'])
  })

  it('labels a combo in Chinese for the shelf', () => {
    expect(comboLabel(warrior, ['warrior.heavy_slash', 'warrior.war_cry'])).toBe('重斩 → 战吼')
  })

  it('only marks a 60s-legal non-empty plan mintable', () => {
    expect(comboIsLegal(warrior, [])).toBe(false)
    const auto = generateAutoCombo(warrior, 7)
    expect(planCombo(warrior, auto).legal).toBe(true)
    expect(comboIsLegal(warrior, auto)).toBe(true)
  })

  it('compares loadouts positionally', () => {
    expect(sameCombo(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(sameCombo(['a', 'b'], ['b', 'a'])).toBe(false)
  })
})
