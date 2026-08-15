import { useRegisterSW } from 'virtual:pwa-register/react'

const HOUR_MS = 60 * 60 * 1000

export function usePwaUpdate() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      window.setInterval(() => {
        void registration.update()
      }, HOUR_MS)
    },
  })

  return {
    needRefresh,
    applyUpdate: (): void => {
      void updateServiceWorker(true)
    },
    dismissUpdate: (): void => setNeedRefresh(false),
  }
}
