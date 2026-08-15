import { useEffect, useRef, useState } from 'react'
import { usePromptStore } from './promptStore'

export function PromptDialog(): React.JSX.Element | null {
  const request = usePromptStore((s) => s.request)
  const close = usePromptStore((s) => s.close)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!request) return
    setValue(request.initial)
    // Chọn sẵn phần tên không kể đuôi file, giống hành vi đổi tên của Explorer.
    const timer = window.setTimeout(() => {
      const input = inputRef.current
      if (!input) return
      input.focus()
      const dot = request.initial.lastIndexOf('.')
      input.setSelectionRange(0, dot > 0 ? dot : request.initial.length)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [request])

  if (!request) return null

  const submit = (): void => {
    if (request.kind === 'confirm') return close('')
    const trimmed = value.trim()
    if (trimmed) close(trimmed)
  }

  return (
    <div className="modal-backdrop" onMouseDown={() => close(null)}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__title">{request.title}</div>
        {request.kind === 'text' && (
          <input
            ref={inputRef}
            className="modal__input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              if (e.key === 'Escape') close(null)
            }}
          />
        )}
        <div className="modal__actions">
          <button className="btn" onClick={() => close(null)}>
            Huỷ
          </button>
          <button
            className={`btn ${request.danger ? 'btn--danger' : 'btn--primary'}`}
            onClick={submit}
            autoFocus={request.kind === 'confirm'}
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
