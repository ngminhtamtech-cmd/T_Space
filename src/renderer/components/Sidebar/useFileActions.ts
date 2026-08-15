import { useCallback } from 'react'
import type { DirEntry } from '@shared/types'
import { useStore } from '@renderer/store'
import { basename, dirname, join } from '@renderer/utils/path'
import { askConfirm, askText } from '@renderer/components/Prompt/promptStore'
import { useWorkspaceActions } from '@renderer/hooks/useWorkspaceActions'
import { usePaneActions } from '@renderer/hooks/usePaneActions'

export function useFileActions() {
  const setOpenFile = useStore((s) => s.setOpenFile)
  const setToast = useStore((s) => s.setToast)
  const { pickWorkspace } = useWorkspaceActions()
  const { newPane } = usePaneActions()

  const run = useCallback(
    async (fn: () => Promise<void>): Promise<void> => {
      try {
        await fn()
      } catch (err) {
        setToast(err instanceof Error ? err.message : String(err))
      }
    },
    [setToast]
  )

  const openFile = useCallback(
    (entry: DirEntry) =>
      run(async () => {
        const result = await window.tspace.fs.readFile(entry.path)
        if (result.kind === 'text') {
          setOpenFile({ path: result.path, content: result.content, dirty: false })
        } else if (result.kind === 'binary') {
          setToast(`${basename(entry.path)} là file nhị phân — không mở được trong editor.`)
        } else {
          setToast(
            `${basename(entry.path)} quá lớn (${(result.size / 1024 / 1024).toFixed(1)} MB) để mở.`
          )
        }
      }),
    [run, setOpenFile, setToast]
  )

  const createFile = useCallback(
    (dir: string) =>
      run(async () => {
        const name = await askText('Tên file mới')
        if (!name) return
        await window.tspace.fs.createFile(join(dir, name))
      }),
    [run]
  )

  const createDir = useCallback(
    (dir: string) =>
      run(async () => {
        const name = await askText('Tên thư mục mới')
        if (!name) return
        await window.tspace.fs.createDir(join(dir, name))
      }),
    [run]
  )

  const rename = useCallback(
    (entry: DirEntry) =>
      run(async () => {
        const name = await askText('Đổi tên thành', entry.name)
        if (!name || name === entry.name) return
        await window.tspace.fs.rename(entry.path, join(dirname(entry.path), name))
      }),
    [run]
  )

  const trash = useCallback(
    (entry: DirEntry) =>
      run(async () => {
        const ok = await askConfirm(`Xoá "${entry.name}" vào Recycle Bin?`)
        if (!ok) return
        await window.tspace.fs.trash(entry.path)
        if (useStore.getState().openFile?.path === entry.path) setOpenFile(null)
      }),
    [run, setOpenFile]
  )

  const copyPath = useCallback(
    (path: string) =>
      run(async () => {
        await navigator.clipboard.writeText(path)
        setToast('Đã copy đường dẫn.')
      }),
    [run, setToast]
  )

  const reveal = useCallback((path: string) => run(() => window.tspace.fs.reveal(path)), [run])

  const openTerminalAt = useCallback((dir: string): void => void newPane(dir), [newPane])

  return {
    openFile,
    createFile,
    createDir,
    rename,
    trash,
    copyPath,
    reveal,
    openTerminalAt,
    pickWorkspace
  }
}
