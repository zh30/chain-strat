import type { Screen } from '../store'

export const INSTALL_DISMISS_KEY = 'chainstrat.pwa.installDismissed'
export const IOS_HINT_DISMISS_KEY = 'chainstrat.pwa.iosHintDismissed'

export const DEEP_LINK_SCREENS = ['hall', 'library', 'ladder', 'combo', 'market', 'arena'] as const
export type DeepLinkScreen = (typeof DEEP_LINK_SCREENS)[number]

export function parseScreenParam(search: string): DeepLinkScreen | null {
  const query = search.startsWith('?') ? search.slice(1) : search
  const raw = new URLSearchParams(query).get('screen')
  if (!raw) return null
  return (DEEP_LINK_SCREENS as readonly string[]).includes(raw) ? (raw as DeepLinkScreen) : null
}

export function pathForScreen(screen: Screen): string | null {
  if (screen === 'hall') return '/'
  if (
    screen === 'library' ||
    screen === 'ladder' ||
    screen === 'combo' ||
    screen === 'market' ||
    screen === 'arena'
  ) {
    return `/?screen=${screen}`
  }
  return null
}

export function isLiveScreen(screen: Screen): boolean {
  return screen === 'match' || screen === 'battle'
}

export function isStandaloneDisplay(input: {
  standalone?: boolean
  matchMedia?: (query: string) => { matches: boolean }
}): boolean {
  if (input.standalone) return true
  return Boolean(
    input.matchMedia?.('(display-mode: standalone)').matches ||
      input.matchMedia?.('(display-mode: window-controls-overlay)').matches,
  )
}

export function isIosSafari(ua: string): boolean {
  const ios = /iPad|iPhone|iPod/.test(ua)
  if (!ios) return false
  return /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
}

export function readFlag(storage: Pick<Storage, 'getItem'>, key: string): boolean {
  return storage.getItem(key) === '1'
}

export function writeFlag(storage: Pick<Storage, 'setItem'>, key: string): void {
  storage.setItem(key, '1')
}
