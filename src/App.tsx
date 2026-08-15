import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useEffect } from 'react'
import { useAccount } from 'wagmi'
import { BattleView } from './components/BattleView'
import { ComboBuilder } from './components/ComboBuilder'
import { ComboMarket } from './components/ComboMarket'
import { Hall } from './components/Hall'
import { HeroLibrary } from './components/HeroLibrary'
import { Ladder } from './components/Ladder'
import { MatchGate } from './components/MatchGate'
import { InstallNavButton, PwaChrome } from './components/PwaChrome'
import { ResultView } from './components/ResultView'
import { usePwaInstall } from './hooks/usePwaInstall'
import { useStarterPack } from './hooks/useStarterPack'
import { shortAddress } from './lib/chain'
import { pathForScreen } from './lib/pwa'
import { useGame } from './store'

const PLAY_SCREENS = new Set(['combo', 'match', 'battle', 'result'])

export default function App() {
  const { address, isConnected } = useAccount()
  const screen = useGame((s) => s.screen)
  const setScreen = useGame((s) => s.setScreen)
  const { claimed, checking } = useStarterPack()
  const installApi = usePwaInstall()

  useEffect(() => {
    if (!checking && !claimed && PLAY_SCREENS.has(screen)) {
      setScreen('hall')
    }
  }, [claimed, checking, screen, setScreen])

  useEffect(() => {
    const next = pathForScreen(screen)
    if (!next) return
    const url = new URL(next, window.location.origin)
    const current = `${window.location.pathname}${window.location.search}`
    const desired = `${url.pathname}${url.search}`
    if (current !== desired) window.history.replaceState(null, '', desired)
  }, [screen])

  return (
    <div className="app-shell mx-auto flex min-h-dvh max-w-6xl flex-col">
      <PwaChrome screen={screen} installApi={installApi} />
      <header className="mb-8 flex items-center justify-between gap-4">
        <button type="button" className="text-left" onClick={() => setScreen('hall')}>
          <div className="font-display text-2xl tracking-wide text-gold">连环计</div>
          <div className="text-xs uppercase tracking-[0.28em] text-gold-dim">Chain Stratagem</div>
        </button>
        <nav className="flex items-center gap-3 text-sm">
          <button type="button" className="text-mute hover:text-paper" onClick={() => setScreen('hall')}>
            大厅
          </button>
          <button type="button" className="text-mute hover:text-paper" onClick={() => setScreen('library')}>
            英雄库
          </button>
          <button type="button" className="text-mute hover:text-paper" onClick={() => setScreen('ladder')}>
            天梯
          </button>
          <button type="button" className="text-mute hover:text-paper" onClick={() => setScreen('market')}>
            市集
          </button>
          <InstallNavButton installApi={installApi} />
          <ConnectButton chainStatus="icon" showBalance={false} />
        </nav>
      </header>

      {!isConnected ? (
        <section className="panel mx-auto mt-16 max-w-xl rounded-2xl p-10 text-center">
          <h1 className="font-display text-4xl text-gold">先谋后动</h1>
          <p className="mt-4 text-mute">
            在 Monad 上设定英雄连环技能，观看确定性对决。连上钱包后领取四名免费英雄，即可匹配或人机对战。
          </p>
          <div className="mt-8 flex justify-center">
            <ConnectButton />
          </div>
        </section>
      ) : (
        <>
          <p className="mb-4 text-xs text-mute">已连接 {shortAddress(address ?? '')} · Monad Testnet</p>
          {screen === 'hall' && <Hall />}
          {screen === 'library' && <HeroLibrary />}
          {screen === 'combo' && <ComboBuilder />}
          {screen === 'match' && <MatchGate />}
          {screen === 'battle' && <BattleView />}
          {screen === 'result' && <ResultView />}
          {screen === 'ladder' && <Ladder />}
          {screen === 'market' && <ComboMarket />}
        </>
      )}
    </div>
  )
}
