import { resolve } from 'node:path'
import { simpleGit, type SimpleGit } from 'simple-git'
import type { GitStatusInfo, WorktreeInfo } from '@shared/types'

/**
 * Trả về gốc repo git chứa `dir`, hoặc null nếu dir không nằm trong repo nào.
 */
export async function findGitRoot(dir: string): Promise<string | null> {
  try {
    const git = simpleGit(dir)
    const top = await git.revparse(['--show-toplevel'])
    return resolve(top.trim())
  } catch {
    return null
  }
}

export async function getStatus(gitRoot: string): Promise<GitStatusInfo> {
  const git: SimpleGit = simpleGit(gitRoot)
  const status = await git.status()
  return {
    branch: status.current,
    changed: status.files.length,
    ahead: status.ahead,
    behind: status.behind
  }
}

/**
 * `git worktree list --porcelain` trả về các khối cách nhau bằng dòng trống:
 *   worktree D:/path
 *   HEAD <sha>
 *   branch refs/heads/main      (hoặc "detached")
 * Khối đầu tiên luôn là worktree chính.
 */
export async function listWorktrees(gitRoot: string, currentRoot: string): Promise<WorktreeInfo[]> {
  const git = simpleGit(gitRoot)
  const raw = await git.raw(['worktree', 'list', '--porcelain'])
  const normalizedCurrent = normalize(currentRoot)

  const result: WorktreeInfo[] = []
  let path: string | null = null
  let head = ''
  let branch: string | null = null

  const commit = (): void => {
    if (!path) return
    result.push({
      path,
      branch,
      head,
      isMain: result.length === 0,
      isCurrent: normalize(path) === normalizedCurrent
    })
    path = null
    head = ''
    branch = null
  }

  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith('worktree ')) {
      commit()
      path = resolve(line.slice('worktree '.length).trim())
    } else if (line.startsWith('HEAD ')) {
      head = line.slice('HEAD '.length).trim()
    } else if (line.startsWith('branch ')) {
      branch = line.slice('branch '.length).trim().replace(/^refs\/heads\//, '')
    }
  }
  commit()

  return result
}

function normalize(p: string): string {
  return resolve(p).replace(/\\/g, '/').toLowerCase()
}
