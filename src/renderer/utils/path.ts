export function basename(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? p
}

export function dirname(p: string): string {
  const normalized = p.replace(/[\\/]+$/, '')
  const idx = Math.max(normalized.lastIndexOf('\\'), normalized.lastIndexOf('/'))
  return idx <= 0 ? normalized : normalized.slice(0, idx)
}

export function join(dir: string, name: string): string {
  return `${dir.replace(/[\\/]+$/, '')}\\${name}`
}

/** Rút gọn cho pane header: giữ 2 đoạn cuối, phần đầu thay bằng "…". */
export function shortenPath(p: string, keep = 2): string {
  const parts = p.split(/[\\/]/).filter(Boolean)
  if (parts.length <= keep + 1) return p
  return `…\\${parts.slice(-keep).join('\\')}`
}

export function extname(p: string): string {
  const name = basename(p)
  const idx = name.lastIndexOf('.')
  return idx <= 0 ? '' : name.slice(idx + 1).toLowerCase()
}
