import { describe, expect, it } from 'vitest'
import { buildDemoMatch } from './demoMatch'

describe('buildDemoMatch', () => {
  it('builds a signed-shaped replay with a crit and a death', () => {
    const match = buildDemoMatch()
    expect(match.vsBot).toBe(true)
    expect(match.players[0].heroId).toBe('warrior')
    expect(match.players[1].heroId).toBe('assassin')
    expect(match.result.events.some((e) => e.type === 'start_cast')).toBe(true)
    expect(match.result.events.some((e) => e.type === 'damage' && e.isCrit)).toBe(true)
    expect(match.result.events.some((e) => e.type === 'death')).toBe(true)
    expect(match.result.events.some((e) => e.type === 'battle_end')).toBe(true)
    const end = match.result.events.find((e) => e.type === 'battle_end')
    const death = match.result.events.find((e) => e.type === 'death')
    if (end && end.type === 'battle_end') {
      expect(end.t).toBeGreaterThan(6)
    }
    expect(death && 't' in death ? death.t : 0).toBeGreaterThan(6)
  })
})