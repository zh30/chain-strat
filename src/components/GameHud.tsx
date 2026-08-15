import { ConnectButton } from '@rainbow-me/rainbowkit'
import { InstallNavButton } from './PwaChrome'
import type { usePwaInstall } from '../hooks/usePwaInstall'
import { shortAddress } from '../lib/chain'
import { LORE } from '../lib/lore'
import { useGame, type Screen } from '../store'

const TABS: { id: Screen; label: string }[] = [
  { id: 'hall', label: '策场' },
  { id: 'library', label: '选将' },
  { id: 'combo', label: '编计' },
  { id: 'ladder', label: '名册' },
  { id: 'market', label: '玉市' },
]

export function GameHud({
  address,
  installApi,
}: {
  address: string
  installApi: ReturnType<typeof usePwaInstall>
}) {
  const screen = useGame((s) => s.screen)
  const setScreen = useGame((s) => s.setScreen)
  const heroId = useGame((s) => s.heroId)

  return (
    <header className="hud">
      <button type="button" className="hud-brand" onClick={() => setScreen('hall')}>
        <span className="hud-mark" aria-hidden />
        <span>
          <strong>{LORE.title}</strong>
          <em>连环渊</em>
        </span>
      </button>
      <nav className="hud-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={screen === tab.id ? 'is-on' : ''}
            disabled={tab.id === 'combo' && !heroId}
            onClick={() => setScreen(tab.id === 'combo' && !heroId ? 'library' : tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="hud-right">
        <span className="hud-id">{shortAddress(address)}</span>
        <InstallNavButton installApi={installApi} />
        <ConnectButton chainStatus="icon" showBalance={false} accountStatus="avatar" />
      </div>
    </header>
  )
}
