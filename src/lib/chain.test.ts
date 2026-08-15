import { describe, expect, it } from 'vitest'
import { fighterTag, isZeroAddress, shortAddress } from './chain'
import { BOT_ADDRESS } from './types'

describe('fighterTag', () => {
  const me = '0x1872277f92af762768c5280fa9fa65f92674a304'

  it('shortens a wallet and marks the local player', () => {
    expect(shortAddress(me)).toBe('0x1872…a304')
    expect(fighterTag(me, me)).toBe('0x1872…a304 · 你')
    expect(fighterTag('0x1111111111111111111111111111111111111111', me)).toBe('0x1111…1111')
  })

  it('labels the zero address as a bot', () => {
    expect(isZeroAddress(BOT_ADDRESS)).toBe(true)
    expect(fighterTag(BOT_ADDRESS, me)).toBe('人机')
  })
})
