import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export type MenuItem =
  | { separator: true }
  | { label: string; danger?: boolean; onSelect: () => void; separator?: false }

interface Props {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: Props): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

  // Đẩy menu vào trong viewport nếu click gần mép phải/dưới.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({
      x: Math.min(x, window.innerWidth - rect.width - 4),
      y: Math.min(y, window.innerHeight - rect.height - 4)
    })
  }, [x, y])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  return (
    <div className="context-menu-backdrop" onMouseDown={onClose} onContextMenu={onClose}>
      <div
        ref={ref}
        className="context-menu"
        style={{ left: pos.x, top: pos.y }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {items.map((item, i) =>
          item.separator ? (
            <div key={i} className="context-menu__sep" />
          ) : (
            <button
              key={i}
              className={`context-menu__item ${item.danger ? 'context-menu__item--danger' : ''}`}
              onClick={() => {
                onClose()
                item.onSelect()
              }}
            >
              {item.label}
            </button>
          )
        )}
      </div>
    </div>
  )
}
