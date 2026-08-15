import type { DirEntry } from '@shared/types'
import { extname } from '@renderer/utils/path'

const BY_EXT: Record<string, string> = {
  ts: '🟦',
  tsx: '🟦',
  js: '🟨',
  jsx: '🟨',
  json: '🔧',
  md: '📝',
  css: '🎨',
  scss: '🎨',
  html: '🌐',
  py: '🐍',
  ps1: '💠',
  sh: '💠',
  yml: '⚙️',
  yaml: '⚙️',
  png: '🖼️',
  jpg: '🖼️',
  jpeg: '🖼️',
  gif: '🖼️',
  svg: '🖼️',
  zip: '📦',
  exe: '⚡'
}

export function fileIcon(entry: DirEntry): string {
  if (entry.isDirectory) return '📁'
  return BY_EXT[extname(entry.path)] ?? '📄'
}
