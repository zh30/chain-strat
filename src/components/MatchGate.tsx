import { useMatch } from '../hooks/useMatch'
import { getHero } from '../lib/heroes'
import { QUEUE_TIMEOUT_MS } from '../lib/types'
import { useGame } from '../store'

export function MatchGate() {
  const { status, error, leftMs, cancel } = useMatch()
  const mode = useGame((s) => s.matchMode)
  const heroId = useGame((s) => s.heroId)
  const hero = heroId ? getHero(heroId) : null
  const seconds = Math.ceil(leftMs / 1000)
  const hunting = mode === 'pvp' && status !== 'error'
  const critical = hunting && seconds <= 5
  const progress = hunting ? Math.max(0, Math.min(1, 1 - leftMs / QUEUE_TIMEOUT_MS)) : 0.18
  const ring = 2 * Math.PI * 88
  const dash = ring * (1 - progress)

  const title = status === 'error' ? '匹配中断' : mode === 'bot' ? '锁定人机' : '搜寻对手'
  const line =
    status === 'error'
      ? error
      : mode === 'bot'
        ? '正在生成对手连招，战场即将开启。'
        : critical
          ? '无人应战。倒计时结束将派出机器人。'
          : seconds <= 12
            ? '扫描半径扩大。仍在等待旗鼓相当的对手。'
            : '按积分最近匹配。二十秒内无人，则派出机器人。'

  return (
    <section className="relative -mx-4 flex min-h-[70vh] flex-col items-center justify-center overflow-hidden px-4">
      <div
        className={`pointer-events-none absolute inset-0 ${
          critical
            ? 'bg-[radial-gradient(circle_at_50%_45%,rgba(194,59,59,0.28),transparent_58%)]'
            : 'bg-[radial-gradient(circle_at_50%_45%,rgba(228,195,106,0.16),transparent_58%)]'
        }`}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cinnabar/40 to-transparent" />

      <div className={`hunt-flicker mb-2 text-xs uppercase tracking-[0.55em] ${critical ? 'text-cinnabar' : 'text-gold-dim'}`}>
        {mode === 'bot' ? 'PVE LOCK' : 'PVP HUNT'}
      </div>
      <h2 className={`font-display text-5xl tracking-[0.28em] sm:text-6xl ${critical ? 'text-cinnabar' : 'text-gold'}`}>
        {title}
      </h2>
      <p className="mt-4 max-w-md text-center text-sm text-mute">{line}</p>
      {hero && (
        <p className="mt-2 text-xs tracking-[0.3em] text-gold-dim">出战 · {hero.nameZh}</p>
      )}

      <div className={`relative mt-10 h-64 w-64 ${critical ? 'hunt-tick' : ''}`}>
        <div
          className="hunt-pulse absolute inset-6 rounded-full border border-gold/30"
          style={{ animationDuration: critical ? '0.55s' : '1.15s' }}
        />
        <div
          className="hunt-pulse absolute inset-0 rounded-full border border-cinnabar/25"
          style={{ animationDelay: '0.35s', animationDuration: critical ? '0.7s' : '1.6s' }}
        />
        <div className="hunt-sweep pointer-events-none absolute inset-4">
          <div className="h-full w-full rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,transparent_300deg,rgba(228,195,106,0.55)_360deg)] opacity-70" />
        </div>
        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 200 200" aria-hidden>
          <circle cx="100" cy="100" r="88" fill="none" stroke="#2a2d38" strokeWidth="3" />
          <circle
            cx="100"
            cy="100"
            r="88"
            fill="none"
            stroke={critical ? '#c23b3b' : '#e4c36a'}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={ring}
            strokeDashoffset={dash}
            className="transition-[stroke-dashoffset,stroke] duration-200"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={`font-display leading-none ${critical ? 'text-7xl text-cinnabar' : 'text-7xl text-paper'}`}>
            {mode === 'bot' || status === 'connecting' ? '…' : seconds}
          </div>
          <div className="mt-2 text-[11px] uppercase tracking-[0.4em] text-mute">
            {mode === 'bot' || status === 'connecting' ? '锁定中' : '剩余秒'}
          </div>
        </div>
      </div>

      {hunting && (
        <div className="mt-8 h-1 w-64 overflow-hidden rounded-full bg-ink-2">
          <div
            className={`h-full ${critical ? 'bg-cinnabar' : 'bg-gold'}`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      {status === 'error' && error && <p className="mt-6 text-sm text-cinnabar">{error}</p>}

      <button type="button" className="mt-10 text-xs tracking-[0.35em] text-mute uppercase" onClick={cancel}>
        取消搜寻
      </button>
    </section>
  )
}
