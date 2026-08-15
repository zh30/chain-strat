import { useOnline } from '../hooks/useOnline'
import type { usePwaInstall } from '../hooks/usePwaInstall'
import { usePwaUpdate } from '../hooks/usePwaUpdate'
import { isLiveScreen } from '../lib/pwa'
import type { Screen } from '../store'

type InstallApi = ReturnType<typeof usePwaInstall>

export function PwaChrome({ screen, installApi }: { screen: Screen; installApi: InstallApi }) {
  const online = useOnline()
  const { canInstall, showIosHint, install, dismissInstall, dismissIosHint } = installApi
  const { needRefresh, applyUpdate, dismissUpdate } = usePwaUpdate()
  const showUpdate = needRefresh && !isLiveScreen(screen)

  if (online && !canInstall && !showIosHint && !showUpdate) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {!online && (
        <div className="pointer-events-auto panel mx-auto w-full max-w-xl rounded-2xl border-cinnabar/40 px-4 py-3 text-sm">
          当前离线。大厅、英雄库和编招仍可浏览，匹配与上链需要网络。
        </div>
      )}
      {showUpdate && (
        <div className="pointer-events-auto panel mx-auto flex w-full max-w-xl items-center justify-between gap-3 rounded-2xl px-4 py-3">
          <p className="text-sm">新版本已就绪。对决中不会强制刷新。</p>
          <div className="flex shrink-0 gap-2">
            <button type="button" className="text-sm text-mute" onClick={dismissUpdate}>
              稍后
            </button>
            <button
              type="button"
              className="rounded-full bg-gold px-4 py-1.5 text-sm font-medium text-ink"
              onClick={applyUpdate}
            >
              刷新
            </button>
          </div>
        </div>
      )}
      {canInstall && (
        <div className="pointer-events-auto panel mx-auto flex w-full max-w-xl items-center justify-between gap-3 rounded-2xl px-4 py-3">
          <div>
            <div className="font-display text-gold">安装连环计</div>
            <p className="text-xs text-mute">加到主屏幕，全屏打开，离线也能看英雄和编招。</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" className="text-sm text-mute" onClick={dismissInstall}>
              以后
            </button>
            <button
              type="button"
              className="rounded-full bg-gold px-4 py-1.5 text-sm font-medium text-ink"
              onClick={() => void install()}
            >
              安装
            </button>
          </div>
        </div>
      )}
      {showIosHint && (
        <div className="pointer-events-auto panel mx-auto w-full max-w-xl rounded-2xl px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-display text-gold">添加到主屏幕</div>
              <p className="mt-1 text-xs text-mute">
                iPhone / iPad：点底部分享按钮，再选「添加到主屏幕」。
              </p>
            </div>
            <button type="button" className="text-sm text-mute" onClick={dismissIosHint}>
              知道了
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function InstallNavButton({ installApi }: { installApi: InstallApi }) {
  if (installApi.installed || !installApi.canInstall) return null
  return (
    <button type="button" className="text-mute hover:text-paper" onClick={() => void installApi.install()}>
      安装
    </button>
  )
}
