import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useEffect, useState } from 'react'
import { FREE_HEROES } from '../lib/heroes'
import { LORE, heroLore } from '../lib/lore'
import { ARENA_ART, HERO_ART, HERO_POSES } from '../lib/visuals'

export function TitleScreen() {
  const { openConnectModal } = useConnectModal()
  const [focus, setFocus] = useState(0)
  const featured = FREE_HEROES[focus] ?? FREE_HEROES[0]!
  const lore = heroLore(featured.id)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const id = window.setInterval(() => {
      setFocus((n) => (n + 1) % FREE_HEROES.length)
    }, 5200)
    return () => window.clearInterval(id)
  }, [])

  return (
    <section className="title-stage">
      <div className="title-bg" style={{ backgroundImage: `url(${ARENA_ART})` }} />
      <div className="title-vignette" />
      <div className="title-embers" aria-hidden />

      <img
        key={featured.id}
        src={HERO_POSES[featured.id].stance ?? HERO_ART[featured.id]}
        alt=""
        className="title-hero"
      />

      <div className="title-copy">
        <p className="title-kicker">策都 · 连环渊</p>
        <h1 className="title-word">{LORE.title}</h1>
        <p className="title-hook">
          先把杀招写死，
          <br />
          再把人放进去。
        </p>
        <p className="title-sub">{LORE.sub}</p>
        <button type="button" className="btn-enter" onClick={() => openConnectModal?.()}>
          {LORE.enter}
        </button>
        <p className="title-seal">{LORE.seal}</p>
      </div>

      <div className="title-roster">
        {FREE_HEROES.map((hero, index) => (
          <button
            key={hero.id}
            type="button"
            className={`title-chip ${index === focus ? 'is-on' : ''}`}
            onClick={() => setFocus(index)}
          >
            <img src={HERO_POSES[hero.id].stance ?? HERO_ART[hero.id]} alt="" />
            <span>
              <strong>{heroLore(hero.id).title}</strong>
              <em>{heroLore(hero.id).epithet}</em>
            </span>
          </button>
        ))}
      </div>

      <p className="title-feat">{lore.line}</p>
    </section>
  )
}
