import { describe, expect, it } from 'vitest'
import { HEROES } from './heroes'
import { HERO_LORE, LORE, heroLore } from './lore'

describe('lore', () => {
  it('covers every hero and keeps the enter-line short', () => {
    for (const hero of HEROES) {
      const entry = heroLore(hero.id)
      expect(entry.title.length).toBeGreaterThan(2)
      expect(HERO_LORE[hero.id].line.length).toBeGreaterThan(4)
    }
    expect(LORE.enter).toBe('进入策场')
    expect(LORE.hook.includes('写死')).toBe(true)
  })
})
