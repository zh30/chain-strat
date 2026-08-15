import { describe, expect, it } from 'vitest'
import {
  CLASH_SLOW,
  highlightForDamage,
  poseForSkill,
  shouldClash,
  skillApproach,
  strongerPulse,
} from './choreography'

describe('skillApproach', () => {
  it('sends melee skills into the center and keeps casters at home', () => {
    expect(skillApproach('warrior.heavy_slash')).toBe('clash')
    expect(skillApproach('assassin.backstab')).toBe('clash')
    expect(skillApproach('blademaster.execution')).toBe('clash')
    expect(skillApproach('mage.fireball')).toBe('ranged')
    expect(skillApproach('ranger.multi_shot')).toBe('ranged')
    expect(skillApproach('mage.mana_shield')).toBe('self')
    expect(skillApproach('warrior.war_cry')).toBe('self')
    expect(skillApproach('ranger.snare_trap')).toBe('self')
  })
})

describe('poseForSkill', () => {
  it('uses strike for attacks and cast for self buffs', () => {
    expect(poseForSkill('warrior.heavy_slash')).toBe('strike')
    expect(poseForSkill('mage.fireball')).toBe('strike')
    expect(poseForSkill('assassin.shadow_strike')).toBe('strike')
    expect(poseForSkill('mage.mana_shield')).toBe('cast')
    expect(poseForSkill('ranger.precision')).toBe('cast')
  })
})

describe('highlights', () => {
  it('slows crits and slows executes even harder', () => {
    const crit = highlightForDamage(true, 'warrior.heavy_slash')
    const exe = highlightForDamage(false, 'blademaster.execution')
    const chip = highlightForDamage(false, 'ranger.multi_shot')
    expect(crit?.scale).toBeLessThan(0.5)
    expect(exe?.scale).toBeLessThan(crit!.scale)
    expect(chip).toBeNull()
  })

  it('keeps the slower pulse when two highlights overlap', () => {
    const held = strongerPulse(CLASH_SLOW, { scale: 0.28, durationMs: 680, zoom: 1.18 })
    expect(held.scale).toBe(0.28)
    expect(strongerPulse(held, CLASH_SLOW).scale).toBe(0.28)
  })
})

describe('shouldClash', () => {
  it('only clashes two near-simultaneous melee casts', () => {
    expect(shouldClash('warrior.heavy_slash', 'assassin.backstab', 0.1)).toBe(true)
    expect(shouldClash('warrior.heavy_slash', 'mage.fireball', 0.1)).toBe(false)
    expect(shouldClash('warrior.heavy_slash', 'assassin.backstab', 0.8)).toBe(false)
  })
})
