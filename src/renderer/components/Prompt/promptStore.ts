import { create } from 'zustand'

/**
 * Electron vô hiệu hoá window.prompt/confirm trong renderer, nên tự dựng dialog.
 * Store này giữ request đang chờ và hàm resolve của Promise tương ứng.
 */
export interface PromptRequest {
  kind: 'text' | 'confirm'
  title: string
  initial: string
  confirmLabel: string
  danger: boolean
}

interface PromptState {
  request: PromptRequest | null
  resolve: ((value: string | null) => void) | null
  open: (request: PromptRequest, resolve: (value: string | null) => void) => void
  close: (value: string | null) => void
}

const usePromptStore = create<PromptState>((set, get) => ({
  request: null,
  resolve: null,
  open: (request, resolve) => set({ request, resolve }),
  close: (value) => {
    get().resolve?.(value)
    set({ request: null, resolve: null })
  }
}))

export { usePromptStore }

export function askText(title: string, initial = ''): Promise<string | null> {
  return new Promise((resolve) => {
    usePromptStore
      .getState()
      .open({ kind: 'text', title, initial, confirmLabel: 'OK', danger: false }, resolve)
  })
}

export function askConfirm(title: string, confirmLabel = 'Xoá'): Promise<boolean> {
  return new Promise((resolve) => {
    usePromptStore
      .getState()
      .open({ kind: 'confirm', title, initial: '', confirmLabel, danger: true }, (value) =>
        resolve(value !== null)
      )
  })
}
