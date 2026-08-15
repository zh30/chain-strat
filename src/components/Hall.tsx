import { useStarterPack } from '../hooks/useStarterPack'
import { getHero } from '../lib/heroes'
import { LORE, heroLore } from '../lib/lore'
import { ARENA_ART, HERO_ART } from '../lib/visuals'
import { useGame } from '../store'

export function Hall() {
  const heroId = useGame((s) => s.heroId)
  const setScreen = useGame((s) => s.setScreen)
  const { claimed, checking, phase, error, wrongNetwork, canClaim, claim } = useStarterPack()
  const selected = claimed && heroId ? getHero(heroId) : null
  const art = selected ? HERO_ART[selected.id] : ARENA_ART
  const lore = selected ? heroLore(selected.id) : null

  return (
    <section className="lobby">
      <div className="lobby-hero">
        <img src={art} alt="" />
        <div className="lobby-hero-copy">
          <span className="page-kicker">连环渊</span>
          <strong>{selected ? lore?.title : '策场'}</strong>
          <p className="mt-2 max-w-md text-sm text-paper/80">
            {selected ? lore?.line : LORE.hook}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {wrongNetwork && (
          <div className="lobby-door border-cinnabar/50">
            <b>断线</b>
            <div>
              <strong>旗不认这座渊</strong>
              <p className="mt-1 text-sm text-mute">把钱包切到 Monad Testnet。右上角网络图标。</p>
            </div>
          </div>
        )}

        {checking && <p className="text-sm text-mute">渊正在认你的旗…</p>}

        {!wrongNetwork && !checking && !claimed && (
          <div className="lobby-door">
            <b>召旗</b>
            <div>
              <strong>{LORE.claimTitle}</strong>
              <p className="mt-1 text-sm text-mute">{LORE.claimBody}</p>
              {phase === 'wallet' && <p className="mt-2 text-sm text-gold">钱包里确认这一笔。四旗一起烙，不会连弹四次。</p>}
              {phase === 'pending' && <p className="mt-2 text-sm text-gold">旗已投下，渊正在确认…</p>}
              {error && <p className="mt-2 text-sm text-cinnabar">{error}</p>}
              <button
                type="button"
                disabled={!canClaim}
                onClick={() => void claim()}
                className="btn-enter mt-4 !min-w-0 !px-6 !py-2 !text-lg"
              >
                {phase === 'wallet' || phase === 'pending' ? '等待烙印…' : '烙下四旗'}
              </button>
            </div>
          </div>
        )}

        <div className="lobby-doors">
          <button type="button" className="lobby-door" onClick={() => setScreen('library')}>
            <b>01</b>
            <div>
              <strong>选将</strong>
              <p className="mt-1 text-sm text-mute">从魂旗里点出战的那一面。</p>
            </div>
          </button>
          <button
            type="button"
            className="lobby-door"
            disabled={!claimed}
            onClick={() => setScreen(selected ? 'combo' : 'library')}
          >
            <b>02</b>
            <div>
              <strong>编计</strong>
              <p className="mt-1 text-sm text-mute">
                {claimed
                  ? selected
                    ? `出战：${heroLore(selected.id).title}`
                    : '先去选将。'
                  : '四旗未烙，不能写计。'}
              </p>
            </div>
          </button>
          <button type="button" className="lobby-door" onClick={() => setScreen('ladder')}>
            <b>03</b>
            <div>
              <strong>名册</strong>
              <p className="mt-1 text-sm text-mute">上链之后，石阶才认你的名字。</p>
            </div>
          </button>
          <button type="button" className="lobby-door" onClick={() => setScreen('market')}>
            <b>04</b>
            <div>
              <strong>玉市</strong>
              <p className="mt-1 text-sm text-mute">买别人写死的连环。买的是计，不是将。</p>
            </div>
          </button>
        </div>
      </div>
    </section>
  )
}
