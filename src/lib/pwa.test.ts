import { describe, expect, it } from 'vitest'
import {
  IOS_HINT_DISMISS_KEY,
  isIosSafari,
  isLiveScreen,
  isStandaloneDisplay,
  parseScreenParam,
  pathForScreen,
  readFlag,
  writeFlag,
} from './pwa'

describe('parseScreenParam', () => {
  it('reads deep-link screens and ignores the rest', () => {
    expect(parseScreenParam('?screen=library')).toBe('library')
    expect(parseScreenParam('screen=ladder')).toBe('ladder')
    expect(parseScreenParam('?screen=combo&x=1')).toBe('combo')
    expect(parseScreenParam('?screen=market')).toBe('market')
    expect(parseScreenParam('?screen=arena')).toBe('arena')
    expect(parseScreenParam('?screen=battle')).toBeNull()
    expect(parseScreenParam('')).toBeNull()
  })
})

describe('pathForScreen', () => {
  it('only persists hall-library-ladder-combo-arena', () => {
    expect(pathForScreen('hall')).toBe('/')
    expect(pathForScreen('ladder')).toBe('/?screen=ladder')
    expect(pathForScreen('market')).toBe('/?screen=market')
    expect(pathForScreen('arena')).toBe('/?screen=arena')
    expect(pathForScreen('match')).toBeNull()
    expect(pathForScreen('battle')).toBeNull()
  })
})

describe('display helpers', () => {
  it('treats iOS standalone and CSS display-mode as installed', () => {
    expect(isStandaloneDisplay({ standalone: true })).toBe(true)
    expect(
      isStandaloneDisplay({
        matchMedia: (q) => ({ matches: q.includes('standalone') }),
      }),
    ).toBe(true)
    expect(isStandaloneDisplay({ matchMedia: () => ({ matches: false }) })).toBe(false)
  })

  it('detects iOS Safari but not Chrome-on-iOS', () => {
    expect(
      isIosSafari(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(true)
    expect(
      isIosSafari(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(false)
    expect(isIosSafari('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(false)
  })

  it('hides update reload during a live match', () => {
    expect(isLiveScreen('battle')).toBe(true)
    expect(isLiveScreen('match')).toBe(true)
    expect(isLiveScreen('hall')).toBe(false)
  })
})

describe('dismiss flags', () => {
  it('round-trips localStorage-like maps', () => {
    const bag = new Map<string, string>()
    const storage = {
      getItem: (k: string) => bag.get(k) ?? null,
      setItem: (k: string, v: string) => {
        bag.set(k, v)
      },
    }
    expect(readFlag(storage, IOS_HINT_DISMISS_KEY)).toBe(false)
    writeFlag(storage, IOS_HINT_DISMISS_KEY)
    expect(readFlag(storage, IOS_HINT_DISMISS_KEY)).toBe(true)
  })
})
