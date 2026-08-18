import { useEffect } from 'react'
import { useAccount } from 'wagmi'
import { BattleView } from './components/BattleView'
import { DemoBattle, isDemoBattleRequest } from './components/DemoBattle'
import { ComboBuilder } from './components/ComboBuilder'
import { ArenaView } from './components/ArenaView'
import { ComboMarket } from './components/ComboMarket'
import { GameHud } from './components/GameHud'
import { Hall } from './components/Hall'
import { HeroLibrary } from './components/HeroLibrary'
import { Ladder } from './components/Ladder'
import { MatchGate } from './components/MatchGate'
import { PwaChrome } from './components/PwaChrome'
import { ResultView } from './components/ResultView'
import { TitleScreen } from './components/TitleScreen'
import { usePwaInstall } from './hooks/usePwaInstall'
import { useStarterPack } from './hooks/useStarterPack'
import { pathForScreen } from './lib/pwa'
import { useGame } from './store'

const PLAY_SCREENS = new Set(['combo', 'match', 'battle', 'result', 'arena'])

export default function App() {
  const { address, isConnected } = useAccount()
  const screen = useGame((s) => s.screen)
  const setScreen = useGame((s) => s.setScreen)
  const { claimed, checking } = useStarterPack()
  const installApi = usePwaInstall()

  useEffect(() => {
    if (isDemoBattleRequest()) return
    if (!checking && !claimed && PLAY_SCREENS.has(screen)) {
      setScreen('hall')
    }
  }, [claimed, checking, screen, setScreen])

  useEffect(() => {
    if (isDemoBattleRequest()) return
    const next = pathForScreen(screen)
    if (!next) return
    const url = new URL(next, window.location.origin)
    const current = `${window.location.pathname}${window.location.search}`
    const desired = `${url.pathname}${url.search}`
    if (current !== desired) window.history.replaceState(null, '', desired)
  }, [screen])

  if (isDemoBattleRequest()) return <DemoBattle />

  if (!isConnected) {
    return (
      <>
        <PwaChrome screen={screen} installApi={installApi} />
        <TitleScreen />
      </>
    )
  }

  return (
    <div className="app-shell">
      <PwaChrome screen={screen} installApi={installApi} />
      <GameHud address={address ?? ''} installApi={installApi} />
      <main className={screen === 'match' ? 'game-stage !pt-16' : 'game-stage'}>
        {screen === 'hall' && <Hall />}
        {screen === 'library' && <HeroLibrary />}
        {screen === 'combo' && <ComboBuilder />}
        {screen === 'match' && <MatchGate />}
        {screen === 'battle' && <BattleView />}
        {screen === 'result' && <ResultView />}
        {screen === 'ladder' && <Ladder />}
        {screen === 'market' && <ComboMarket />}
        {screen === 'arena' && <ArenaView />}
      </main>
    </div>
  )
}
