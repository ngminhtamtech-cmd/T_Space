let counter = 0

/**
 * Id ngắn, duy nhất trong phiên và không đụng id đã lưu ở state.json —
 * `crypto.randomUUID` không có trên file:// (không phải secure context).
 */
export function newId(prefix: string): string {
  counter += 1
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`
}
