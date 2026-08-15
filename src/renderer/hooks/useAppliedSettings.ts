import { useEffect } from 'react'
import { useStore } from '@renderer/store'

/**
 * Đẩy phần settings mang tính giao diện xuống DOM. `tokens.css` vẫn là giá trị mặc
 * định; ở đây chỉ ghi đè biến trên `:root` khi người dùng đổi.
 *
 * Bảng màu của xterm nằm ở `theme/palette.ts` và không đọc được CSS variable, nên
 * accent chỉ ảnh hưởng giao diện React — terminal giữ nguyên palette.
 */
export function useAppliedSettings(): void {
  const accent = useStore((s) => s.settings.ui.accent)
  const density = useStore((s) => s.settings.ui.density)

  useEffect(() => {
    const style = document.documentElement.style
    style.setProperty('--accent', accent)
    style.setProperty('--accent-hover', shade(accent, -0.15))
    style.setProperty('--accent-soft', rgba(accent, 0.12))
    style.setProperty('--accent-ring', rgba(accent, 0.35))
  }, [accent])

  useEffect(() => {
    document.documentElement.dataset['density'] = density
  }, [density])
}

function parse(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const value = parseInt(match[1]!, 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function rgba(hex: string, alpha: number): string {
  const rgb = parse(hex)
  if (!rgb) return hex
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`
}

/** amount âm = tối đi, dương = sáng lên. */
function shade(hex: string, amount: number): string {
  const rgb = parse(hex)
  if (!rgb) return hex
  const mix = (channel: number): number =>
    Math.round(Math.min(255, Math.max(0, channel + 255 * amount)))
  return `#${rgb.map((c) => mix(c).toString(16).padStart(2, '0')).join('')}`
}
