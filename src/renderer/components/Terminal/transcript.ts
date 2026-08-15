import type { Terminal } from '@xterm/xterm'

/**
 * Lịch sử phiên được lưu dưới dạng **text đã render**, lấy thẳng từ buffer của xterm.
 *
 * Không lưu luồng byte của PTY: ConPTY là giao thức vẽ màn hình, nó rải `ESC[2J`,
 * `ESC[H`, `ESC[K` khắp nơi — kể cả lúc shell khởi động và lúc thoát. Phát lại byte
 * thô sẽ tự xoá sạch màn hình vừa vẽ. xterm đã làm xong phần emulation, buffer của
 * nó chính là kết quả cần lưu.
 *
 * Cũng vì lẽ đó, lịch sử được hiển thị trong một khung riêng phía trên terminal chứ
 * không ghi ngược vào xterm: ConPTY sở hữu viewport và vẽ lại toàn bộ sau mỗi lần
 * resize, nên mọi thứ chèn vào đó đều bị xoá.
 */

/** Trần số dòng lấy từ buffer; phần vượt trần theo byte do main cắt tiếp. */
const MAX_LINES = 3000

export function serializeTerminal(term: Terminal, maxLines = MAX_LINES): string {
  // Dùng buffer `normal`: app toàn màn hình (TUI) chạy trên alt-screen, nội dung
  // hội thoại thật vẫn nằm ở buffer thường.
  const buffer = term.buffer.normal
  const start = Math.max(0, buffer.length - maxLines)
  const lines: string[] = []

  for (let i = start; i < buffer.length; i += 1) {
    const line = buffer.getLine(i)
    lines.push(line ? line.translateToString(true) : '')
  }

  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines.join('\n')
}

/* ---------- Sổ đăng ký để ghi nốt lịch sử lúc thoát app ---------- */

const savers = new Map<string, () => Promise<void>>()

export function registerTranscriptSaver(paneId: string, save: () => Promise<void>): () => void {
  savers.set(paneId, save)
  return () => {
    savers.delete(paneId)
  }
}

/**
 * Ghi lịch sử của mọi pane đang mở. Gọi lúc app sắp thoát — component không unmount
 * khi đóng cửa sổ nên không thể trông vào cleanup của effect.
 */
export async function flushAllTranscripts(): Promise<void> {
  await Promise.all([...savers.values()].map((save) => save().catch(() => undefined)))
}
