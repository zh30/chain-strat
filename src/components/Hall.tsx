import { useStarterPack } from '../hooks/useStarterPack'
import { getHero } from '../lib/heroes'
import { useGame } from '../store'

export function Hall() {
  const heroId = useGame((s) => s.heroId)
  const setScreen = useGame((s) => s.setScreen)
  const { claimed, checking, phase, error, wrongNetwork, canClaim, claim } = useStarterPack()
  const selected = claimed && heroId ? getHero(heroId) : null

  return (
    <section>
      <div className="mb-8">
        <h2 className="font-display text-3xl">大厅</h2>
        <p className="mt-1 text-sm text-mute">先谋后动。英雄、连招、对战从这里进入。</p>
      </div>

      {wrongNetwork && (
        <div className="panel mb-6 rounded-2xl border-cinnabar/40 p-4 text-sm">
          钱包还在别的网络。点右上角网络图标，切换到 <span className="text-gold">Monad Testnet</span>。
        </div>
      )}

      {checking && <p className="mb-6 text-sm text-mute">正在确认你的英雄…</p>}

      {!wrongNetwork && !checking && !claimed && (
        <div className="panel mb-6 rounded-2xl p-5">
          <div className="font-display text-lg text-gold">先领取四名英雄</div>
          <p className="mt-2 text-sm text-mute">
            战士、法师、刺客、游侠会一次性铸成灵魂绑定 NFT，随后进入你的英雄库。
            钱包里只需确认
            <strong className="mx-1 text-paper">一笔交易</strong>
            。拒绝的话无法进入匹配或人机对战。
          </p>
          {phase === 'wallet' && (
            <p className="mt-3 text-sm text-gold">请在 MetaMask 里确认这一笔。四个英雄一起铸造，不会连弹四次。</p>
          )}
          {phase === 'pending' && <p className="mt-3 text-sm text-gold">交易已提交，正在等测试网确认…</p>}
          {error && <p className="mt-3 text-sm text-cinnabar">{error}</p>}
          <button
            type="button"
            disabled={!canClaim}
            onClick={() => void claim()}
            className="mt-4 rounded-full bg-gold px-5 py-2 text-sm font-medium text-ink"
          >
            {phase === 'wallet' || phase === 'pending' ? '等待钱包…' : '领取四名英雄（1 笔）'}
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setScreen('library')}
          className="panel rounded-2xl p-6 text-left transition hover:border-gold-dim"
        >
          <div className="text-xs uppercase tracking-[0.25em] text-gold-dim">收藏</div>
          <div className="font-display mt-2 text-2xl text-gold">我的英雄库</div>
          <p className="mt-3 text-sm text-mute">查看属于你的全部英雄，选出战名单。</p>
        </button>

        <button
          type="button"
          disabled={!claimed}
          onClick={() => setScreen(selected ? 'combo' : 'library')}
          className="panel rounded-2xl p-6 text-left transition hover:border-gold-dim"
        >
          <div className="text-xs uppercase tracking-[0.25em] text-gold-dim">出战</div>
          <div className="font-display mt-2 text-2xl">编连招</div>
          <p className="mt-3 text-sm text-mute">
            {claimed
              ? selected
                ? `当前出战：${selected.nameZh}`
                : '先去英雄库选一个人。'
              : '领取英雄后才能编招对战。'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setScreen('ladder')}
          className="panel rounded-2xl p-6 text-left transition hover:border-gold-dim"
        >
          <div className="text-xs uppercase tracking-[0.25em] text-gold-dim">排名</div>
          <div className="font-display mt-2 text-2xl">天梯</div>
          <p className="mt-3 text-sm text-mute">查看测试网上链后的积分榜。</p>
        </button>

        <button
          type="button"
          onClick={() => setScreen('market')}
          className="panel rounded-2xl p-6 text-left transition hover:border-gold-dim"
        >
          <div className="text-xs uppercase tracking-[0.25em] text-gold-dim">交易</div>
          <div className="font-display mt-2 text-2xl">连招市集</div>
          <p className="mt-3 text-sm text-mute">买入别人挂出的 SkillCombo NFT，给对应英雄直接出战。</p>
        </button>
      </div>
    </section>
  )
}
