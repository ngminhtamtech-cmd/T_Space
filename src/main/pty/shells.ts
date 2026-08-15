import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ShellId, ShellProfile } from '@shared/types'

function firstExisting(candidates: string[]): string | null {
  return candidates.find((p) => existsSync(p)) ?? null
}

/**
 * Máy dev hiện chỉ có Windows PowerShell 5.1 (không có pwsh), nhưng vẫn ưu tiên pwsh
 * nếu người dùng cài sau này.
 */
function detectPowerShell(): string {
  const systemRoot = process.env.SystemRoot ?? 'C:\\Windows'
  const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files'
  return (
    firstExisting([
      join(programFiles, 'PowerShell', '7', 'pwsh.exe'),
      join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    ]) ?? 'powershell.exe'
  )
}

function detectGitBash(): string | null {
  const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files'
  const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
  const localAppData = process.env.LOCALAPPDATA ?? ''
  return firstExisting(
    [
      join(programFiles, 'Git', 'bin', 'bash.exe'),
      join(programFilesX86, 'Git', 'bin', 'bash.exe'),
      localAppData ? join(localAppData, 'Programs', 'Git', 'bin', 'bash.exe') : ''
    ].filter(Boolean)
  )
}

let cached: ShellProfile[] | null = null

export function listShells(): ShellProfile[] {
  if (cached) return cached

  const psPath = detectPowerShell()
  const profiles: ShellProfile[] = [
    {
      id: 'powershell',
      label: psPath.endsWith('pwsh.exe') ? 'PowerShell 7' : 'Windows PowerShell',
      path: psPath,
      args: ['-NoLogo']
    },
    {
      id: 'cmd',
      label: 'Command Prompt',
      path: join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'cmd.exe'),
      args: []
    }
  ]

  const gitBash = detectGitBash()
  if (gitBash) {
    profiles.push({ id: 'gitbash', label: 'Git Bash', path: gitBash, args: ['--login', '-i'] })
  }

  cached = profiles
  return profiles
}

export function resolveShell(id: ShellId): ShellProfile {
  const shells = listShells()
  return shells.find((s) => s.id === id) ?? shells[0]
}
