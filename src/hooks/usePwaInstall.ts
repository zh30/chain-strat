import { useCallback, useEffect, useState } from 'react'
import {
  INSTALL_DISMISS_KEY,
  IOS_HINT_DISMISS_KEY,
  isIosSafari,
  isStandaloneDisplay,
  readFlag,
  writeFlag,
} from '../lib/pwa'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() =>
    typeof window === 'undefined'
      ? false
      : isStandaloneDisplay({
          standalone: Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
          matchMedia: (q) => window.matchMedia(q),
        }),
  )
  const [dismissed, setDismissed] = useState(() =>
    typeof localStorage === 'undefined' ? false : readFlag(localStorage, INSTALL_DISMISS_KEY),
  )
  const [iosHintDismissed, setIosHintDismissed] = useState(() =>
    typeof localStorage === 'undefined' ? false : readFlag(localStorage, IOS_HINT_DISMISS_KEY),
  )
  const iosSafari = typeof navigator !== 'undefined' && isIosSafari(navigator.userAgent)

  useEffect(() => {
    const onPrompt = (event: Event): void => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    const onInstalled = (): void => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async (): Promise<void> => {
    if (!deferred) return
    await deferred.prompt()
    const choice = await deferred.userChoice
    if (choice.outcome === 'accepted') setInstalled(true)
    setDeferred(null)
  }, [deferred])

  const dismissInstall = useCallback((): void => {
    writeFlag(localStorage, INSTALL_DISMISS_KEY)
    setDismissed(true)
  }, [])

  const dismissIosHint = useCallback((): void => {
    writeFlag(localStorage, IOS_HINT_DISMISS_KEY)
    setIosHintDismissed(true)
  }, [])

  return {
    installed,
    canInstall: Boolean(deferred) && !installed && !dismissed,
    showIosHint: iosSafari && !installed && !iosHintDismissed,
    install,
    dismissInstall,
    dismissIosHint,
  }
}
