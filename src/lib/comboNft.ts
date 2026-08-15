import { getHero, getSkill, heroByTypeId } from './heroes'
import { planCombo } from './combo'
import type { Hero, HeroId } from './types'

export const COMBO_SKILL_SLOTS = 3
export const COMBO_MAX_SKILLS = 64

export interface ComboRecord {
  tokenId: bigint
  heroType: number
  skillIndexes: number[]
  priceWei: bigint
  seller: `0x${string}` | null
}

export function encodeComboIndexes(hero: Hero, skillIds: string[]): number[] {
  if (skillIds.length === 0) throw new Error('empty combo')
  if (skillIds.length > COMBO_MAX_SKILLS) throw new Error('combo too long')
  return skillIds.map((id) => {
    const index = hero.skills.findIndex((skill) => skill.id === id)
    if (index < 0) throw new Error(`skill ${id} is not on ${hero.id}`)
    if (index >= COMBO_SKILL_SLOTS) throw new Error(`skill index ${index} out of range`)
    return index
  })
}

export function decodeComboIndexes(hero: Hero, indexes: readonly number[]): string[] {
  return indexes.map((index) => {
    const skill = hero.skills[index]
    if (!skill) throw new Error(`bad skill index ${index} for ${hero.id}`)
    return skill.id
  })
}

export function comboFromOnchain(heroType: number, indexes: readonly number[]): {
  heroId: HeroId
  combo: string[]
} {
  const hero = heroByTypeId(heroType)
  if (!hero) throw new Error(`unknown hero type ${heroType}`)
  return { heroId: hero.id, combo: decodeComboIndexes(hero, indexes) }
}

export function comboLabel(hero: Hero, skillIds: string[]): string {
  return skillIds.map((id) => getSkill(hero, id).nameZh).join(' → ')
}

export function comboIsLegal(hero: Hero, skillIds: string[]): boolean {
  return skillIds.length > 0 && planCombo(hero, skillIds).legal
}

export function sameCombo(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i])
}

export function getHeroByType(heroType: number): Hero {
  const hero = heroByTypeId(heroType)
  if (!hero) throw new Error(`unknown hero type ${heroType}`)
  return getHero(hero.id)
}
