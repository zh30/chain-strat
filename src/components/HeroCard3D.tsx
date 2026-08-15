import type { Hero } from '../lib/types'
import { HERO_ART } from '../lib/visuals'

interface Props {
  hero: Hero
  active: boolean
  onSelect: () => void
}

export function HeroCard3D({ hero, active, onSelect }: Props) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={`hero-stage relative rounded-2xl p-3 text-left ${active ? 'hero-stage-on' : ''}`}
    >
      {active && (
        <span className="absolute top-3 right-3 z-10 rounded-full bg-gold px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-ink">
          已选中
        </span>
      )}
      <div className="hero-stage-frame">
        <img src={HERO_ART[hero.id]} alt={hero.nameZh} className="hero-stage-img" />
        <div className="hero-stage-shine" />
      </div>
      <div className={`mt-3 font-display text-xl ${active ? 'text-gold' : ''}`}>{hero.nameZh}</div>
      <div className="text-xs uppercase tracking-widest text-gold-dim">{hero.name}</div>
      <div className="mt-1 text-sm text-mute">HP {hero.hp}</div>
    </button>
  )
}
