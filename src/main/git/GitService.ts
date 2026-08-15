import { existsSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { simpleGit, type SimpleGit } from 'simple-git'
import type {
  CommitResult,
  CreateWorktreeOptions,
  GitStatusInfo,
  BranchListInfo,
  WorktreeInfo
} from '@shared/types'

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

export async function listBranches(gitRoot: string): Promise<BranchListInfo> {
  const git = simpleGit(gitRoot)
  try {
    const summary = await git.branchLocal()
    return { current: summary.current || null, all: summary.all }
  } catch {
    return { current: null, all: [] }
  }
}

/**
 * Stage tất cả rồi commit. Repo sạch thì trả `committed: false` chứ không ném lỗi —
 * luồng "commit nhanh rồi tách worktree" vẫn phải chạy tiếp được.
 */
export async function commitAll(gitRoot: string, message: string): Promise<CommitResult> {
  const git = simpleGit(gitRoot)
  const before = await git.status()
  if (before.files.length === 0) return { committed: false, hash: null, files: 0 }

  await git.add(['-A'])
  const result = await git.commit(message)
  return { committed: true, hash: result.commit || null, files: before.files.length }
}

/**
 * `git worktree add`. Branch chưa tồn tại thì tạo mới bằng `-b` từ `base`, đã tồn tại
 * thì checkout thẳng branch đó vào worktree mới.
 */
export async function createWorktree(
  gitRoot: string,
  options: CreateWorktreeOptions
): Promise<WorktreeInfo> {
  const target = resolve(options.path)
  const branch = options.branch.trim()

  if (!isAbsolute(target)) throw new Error(`Đường dẫn worktree phải là tuyệt đối: ${options.path}`)
  if (!branch) throw new Error('Chưa nhập tên branch cho worktree mới.')
  if (existsSync(target)) throw new Error(`Đường dẫn đã tồn tại: ${target}`)

  const git = simpleGit(gitRoot)
  const { all } = await listBranches(gitRoot)
  const args = all.includes(branch)
    ? ['worktree', 'add', target, branch]
    : ['worktree', 'add', target, '-b', branch, ...(options.base ? [options.base] : [])]

  await git.raw(args)

  const created = (await listWorktrees(gitRoot, target)).find((w) => normalize(w.path) === normalize(target))
  if (!created) throw new Error('Đã chạy git worktree add nhưng không thấy worktree mới trong danh sách.')
  return created
}

export async function removeWorktree(gitRoot: string, path: string, force = false): Promise<void> {
  const git = simpleGit(gitRoot)
  await git.raw(['worktree', 'remove', ...(force ? ['--force'] : []), resolve(path)])
}

/** Gợi ý thư mục anh em cạnh repo: `<repo>-<branch>` với `/` trong tên branch đổi thành `-`. */
export function suggestWorktreePath(gitRoot: string, branch: string): string {
  const slug = branch.trim().replace(/[\\/]+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '') || 'worktree'
  return join(dirname(resolve(gitRoot)), `${basename(resolve(gitRoot))}-${slug}`)
}

function normalize(p: string): string {
  return resolve(p).replace(/\\/g, '/').toLowerCase()
}
