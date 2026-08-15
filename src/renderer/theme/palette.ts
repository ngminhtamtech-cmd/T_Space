/**
 * Bản sao TypeScript của bảng màu trong `styles/tokens.css`. xterm và CodeMirror
 * nhận màu qua object JS chứ không đọc được CSS custom property, nên hai nơi phải
 * sửa cùng lúc.
 */
export const palette = {
  bgBase: '#0f1115',
  bgSurface: '#14171c',
  bgRaised: '#1a1e24',
  border: '#262a31',
  fg: '#e6e8eb',
  fgMuted: '#8b929e',
  accent: '#3b82f6',
  danger: '#ef4444',
  warn: '#f59e0b',
  ok: '#22c55e',
  selection: 'rgba(59, 130, 246, 0.30)'
} as const

/** 16 màu ANSI cho terminal. */
export const ansi = {
  black: '#1a1e24',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#f59e0b',
  blue: '#3b82f6',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#d7dbe0',
  brightBlack: '#5c6470',
  brightRed: '#f87171',
  brightGreen: '#4ade80',
  brightYellow: '#fbbf24',
  brightBlue: '#60a5fa',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#f5f7fa'
} as const
