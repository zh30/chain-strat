import { getHero, getSkill } from './heroes'
import { mulberry32 } from './rng'
import type { ComboPlan, ComboPlanEntry, Hero, HeroId } from './types'
import { COMBO_MAX_SEC } from './types'

export function planCombo(hero: Hero, skillIds: string[], maxSec = COMBO_MAX_SEC): ComboPlan {
  const entries: ComboPlanEntry[] = []
  let playhead = 0
  const cdReady = new Map<string, number>()

  for (const id of skillIds) {
    const skill = getSkill(hero, id)
    const ready = cdReady.get(id) ?? 0
    const waitBefore = Math.max(0, ready - playhead)
    const start = playhead + waitBefore
    const end = start + skill.duration
    if (end > maxSec + 1e-9) {
      return { entries, totalTime: playhead, legal: false }
    }
    entries.push({ skillId: id, start, end, waitBefore })
    cdReady.set(id, start + skill.cd)
    playhead = end
  }

  return { entries, totalTime: playhead, legal: true }
}

export function canAppendSkill(hero: Hero, skillIds: string[], nextId: string, maxSec = COMBO_MAX_SEC): boolean {
  return planCombo(hero, [...skillIds, nextId], maxSec).legal
}

export function generateAutoCombo(hero: Hero, seed: number, maxSec = COMBO_MAX_SEC): string[] {
  const rng = mulberry32(seed)
  const combo: string[] = []
  for (let i = 0; i < 64; i++) {
    const options = hero.skills.filter((s) => canAppendSkill(hero, combo, s.id, maxSec))
    if (options.length === 0) break
    const pick = options[Math.floor(rng() * options.length)]
    if (!pick) break
    combo.push(pick.id)
  }
  return combo
}

export function generateBotLoadout(seed: number): { heroId: HeroId; combo: string[] } {
  const rng = mulberry32(seed)
  const free = (['warrior', 'mage', 'assassin', 'ranger'] as const)
  const heroId = free[Math.floor(rng() * free.length)] ?? 'warrior'
  const hero = getHero(heroId)
  const combo = generateAutoCombo(hero, Math.floor(rng() * 0xffffffff))
  return { heroId, combo }
}
