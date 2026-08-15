import { useCallback } from 'react'
import { useStore } from '@renderer/store'

export function useWorkspaceActions() {
  const setWorkspace = useStore((s) => s.setWorkspace)
  const setGitStatus = useStore((s) => s.setGitStatus)
  const setOpenFile = useStore((s) => s.setOpenFile)
  const setToast = useStore((s) => s.setToast)

  const openWorkspace = useCallback(
    async (root: string): Promise<void> => {
      try {
        const info = await window.tspace.workspace.open(root)
        setWorkspace(info)
        setOpenFile(null)
        setGitStatus(info.gitRoot ? await window.tspace.git.status(info.gitRoot) : null)
      } catch (err) {
        setToast(err instanceof Error ? err.message : String(err))
      }
    },
    [setWorkspace, setGitStatus, setOpenFile, setToast]
  )

  const pickWorkspace = useCallback(async (): Promise<void> => {
    const picked = await window.tspace.workspace.pickFolder()
    if (picked) await openWorkspace(picked)
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
