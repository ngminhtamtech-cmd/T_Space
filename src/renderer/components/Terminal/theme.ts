import type { ITheme } from '@xterm/xterm'
import { ansi, palette } from '@renderer/theme/palette'

export const terminalTheme: ITheme = {
  background: palette.bgBase,
  foreground: palette.fg,
  cursor: palette.fg,
  cursorAccent: palette.bgBase,
  selectionBackground: palette.selection,
  ...ansi
}
