import { useCallback } from 'react'
import { useStore } from '@renderer/store'

export function useWorkspaceActions() {
  const setWorkspace = useStore((s) => s.setWorkspace)
  const setGitStatus = useStore((s) => s.setGitStatus)
  const setOpenFile = useStore((s) => s.setOpenFile)
  const addRecentWorkspace = useStore((s) => s.addRecentWorkspace)
  const removeRecentWorkspace = useStore((s) => s.removeRecentWorkspace)
  const setToast = useStore((s) => s.setToast)

  const openWorkspace = useCallback(
    async (root: string): Promise<boolean> => {
      try {
        const info = await window.tspace.workspace.open(root)
        setWorkspace(info)
        setOpenFile(null)
        addRecentWorkspace(info.root)
        setGitStatus(info.gitRoot ? await window.tspace.git.status(info.gitRoot) : null)
        return true
      } catch (err) {
        setToast(err instanceof Error ? err.message : String(err))
        // Thư mục đã bị xoá/đổi tên thì bỏ khỏi danh sách gần đây luôn.
        removeRecentWorkspace(root)
        return false
      }
    },
    [setWorkspace, setGitStatus, setOpenFile, addRecentWorkspace, removeRecentWorkspace, setToast]
  )

  const pickWorkspace = useCallback(async (): Promise<string | null> => {
    const picked = await window.tspace.workspace.pickFolder()
    if (!picked) return null
    return (await openWorkspace(picked)) ? picked : null
  }, [openWorkspace])

  const refreshGit = useCallback(async (): Promise<void> => {
    const gitRoot = useStore.getState().workspace?.gitRoot
    if (!gitRoot) return setGitStatus(null)
    try {
      setGitStatus(await window.tspace.git.status(gitRoot))
    } catch {
      setGitStatus(null)
    }
  }, [setGitStatus])

  return { openWorkspace, pickWorkspace, refreshGit }
}
