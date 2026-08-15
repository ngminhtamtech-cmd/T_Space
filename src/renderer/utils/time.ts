const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * Mốc thời gian đọc nhanh cho danh sách workspace: gần thì tương đối, xa thì ngày
 * tháng cụ thể. Đủ để biết "hôm nay mình đã mở cái nào" mà không phải đọc số.
 */
export function formatLastOpened(ts: number, now = Date.now()): string {
  if (!Number.isFinite(ts) || ts <= 0) return 'chưa mở lần nào'

  const diff = now - ts
  if (diff < 0) return formatFullDate(ts)
  if (diff < MINUTE) return 'vừa xong'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} phút trước`
  if (diff < DAY && isSameDay(ts, now)) return `${Math.floor(diff / HOUR)} giờ trước`
  if (isSameDay(ts, now - DAY)) return `hôm qua ${clock(ts)}`
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} ngày trước`
  return formatDate(ts)
}

export function formatFullDate(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return 'Chưa mở lần nào'
  return `Mở gần nhất: ${formatDate(ts)} ${clock(ts)}`
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function clock(ts: number): string {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function isSameDay(a: number, b: number): boolean {
  const x = new Date(a)
  const y = new Date(b)
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  )
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
