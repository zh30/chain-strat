import type { HeroId } from './types'

export const ARENA_ART = '/assets/arena/coliseum.jpg'

export const HERO_ART: Record<HeroId, string> = {
  warrior: '/assets/heroes/warrior.jpg',
  mage: '/assets/heroes/mage.jpg',
  assassin: '/assets/heroes/assassin.jpg',
  ranger: '/assets/heroes/ranger.jpg',
  guardian: '/assets/heroes/guardian.jpg',
  necromancer: '/assets/heroes/necromancer.jpg',
  blademaster: '/assets/heroes/blademaster.jpg',
}

export interface SkillLook {
  tint: number
  motion: 'slash' | 'bash' | 'aura' | 'bolt' | 'spike' | 'shield' | 'dash' | 'mist' | 'shots' | 'trap' | 'mark' | 'drain' | 'curse' | 'execute'
}

export const SKILL_LOOK: Record<string, SkillLook> = {
  'warrior.heavy_slash': { tint: 0xe4c36a, motion: 'slash' },
  'warrior.shield_bash': { tint: 0x7ec8ff, motion: 'bash' },
  'warrior.war_cry': { tint: 0xc23b3b, motion: 'aura' },
  'mage.fireball': { tint: 0xff6a2a, motion: 'bolt' },
  'mage.ice_spike': { tint: 0x6ad4ff, motion: 'spike' },
  'mage.mana_shield': { tint: 0x4aa3ff, motion: 'shield' },
  'assassin.backstab': { tint: 0xff4da6, motion: 'dash' },
  'assassin.shadow_strike': { tint: 0xa855f7, motion: 'dash' },
  'assassin.venom_blade': { tint: 0x3ecf8e, motion: 'mist' },
  'ranger.multi_shot': { tint: 0x8fe36a, motion: 'shots' },
  'ranger.snare_trap': { tint: 0x5ad18a, motion: 'trap' },
  'ranger.precision': { tint: 0xe4c36a, motion: 'mark' },
  'guardian.iron_guard': { tint: 0x6ad4c8, motion: 'shield' },
  'guardian.shield_slam': { tint: 0x8aa0b8, motion: 'bash' },
  'guardian.fortify': { tint: 0x6ad4c8, motion: 'aura' },
  'necromancer.soul_drain': { tint: 0x7cff7c, motion: 'drain' },
  'necromancer.bone_spear': { tint: 0xd8d0c0, motion: 'spike' },
  'necromancer.weakening_curse': { tint: 0x8b5cf6, motion: 'curse' },
  'blademaster.triple_slash': { tint: 0xff4d4d, motion: 'slash' },
  'blademaster.blade_dance': { tint: 0xff8a3d, motion: 'slash' },
  'blademaster.execution': { tint: 0xffd36a, motion: 'execute' },
}

export function skillLook(skillId: string): SkillLook {
  return SKILL_LOOK[skillId] ?? { tint: 0xe4c36a, motion: 'slash' }
}
