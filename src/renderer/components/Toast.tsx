import { useEffect } from 'react'
import { useStore } from '@renderer/store'

const TOAST_MS = 4000

export function Toast(): React.JSX.Element | null {
  const toast = useStore((s) => s.toast)
  const setToast = useStore((s) => s.setToast)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast, setToast])

  if (!toast) return null

  return (
    <div className="toast" onClick={() => setToast(null)} role="status">
      {toast}
    </div>
  )
}
