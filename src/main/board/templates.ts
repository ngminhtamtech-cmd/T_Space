/**
 * Nội dung của `.tspace/` sinh ra trong worktree dùng chung.
 *
 * Đây là hợp đồng giữa T_Space và các agent CLI (Opencode, Claude Code, Codex…).
 * Agent không gọi IPC được, nên toàn bộ giao tiếp đi qua `board.json` + `board.ps1`.
 * Viết bằng tiếng Việt vì đó là ngôn ngữ người dùng đang làm việc.
 */

export function boardAgentsDoc(): string {
  return `# Task board dùng chung (T_Space)

Worktree này đang được **nhiều agent làm cùng lúc**. Mỗi agent chạy trong một pane
terminal riêng, nhưng tất cả trỏ vào chính thư mục này. Việc điều phối đi qua một file
duy nhất: \`.tspace/board.json\`.

## Bạn là ai

Shell của bạn có sẵn các biến môi trường:

| Biến | Ý nghĩa |
|---|---|
| \`$env:TSPACE_AGENT_SLOT\` | Định danh của bạn trên board: \`a1\`, \`a2\`… |
| \`$env:TSPACE_BOARD\` | Đường dẫn tuyệt đối tới \`board.json\` |
| \`$env:TSPACE_WORKTREE\` | Gốc worktree dùng chung |

Kiểm tra bằng \`echo $env:TSPACE_AGENT_SLOT\`. Nếu rỗng thì bạn đang chạy ngoài T_Space,
cứ làm việc bình thường và bỏ qua tài liệu này.

## Luật

1. **Đừng tự sửa \`board.json\` bằng tay.** Luôn dùng \`.tspace\\board.ps1\` — script đó
   khoá file và ghi kiểu tmp + rename, nên nhiều agent ghi cùng lúc vẫn an toàn.
2. **Nhận việc trước khi làm.** Chỉ động vào code sau khi đã \`claim\` task; nếu không,
   hai agent sẽ sửa cùng một file và giẫm lên nhau.
3. **Không tự chấm bài của mình.** Làm xong thì chuyển task sang trạng thái \`review\` và
   giao cho một slot khác.
4. **Chấm chéo là việc bắt buộc.** Khi có task nằm chờ bạn review, đọc thay đổi rồi ghi
   nhận xét kèm verdict \`pass\` hoặc \`fail\`.
5. **Commit nhỏ, thường xuyên**, ghi rõ id task trong message: \`feat(t3): …\`.

## Vòng đời một task

\`\`\`
todo ──claim──> doing ──done -Reviewer aX──> review ──note -Verdict pass──> done
                  ▲                              │
                  └──────── note -Verdict fail ──┘
\`\`\`

## Lệnh

Chạy từ gốc worktree:

\`\`\`powershell
.\\.tspace\\board.ps1 list                  # toàn bộ board
.\\.tspace\\board.ps1 mine                  # task đang giao cho tôi
.\\.tspace\\board.ps1 review                # task đang chờ tôi chấm
.\\.tspace\\board.ps1 add -Title "Viết test cho PtyManager" -Detail "..."
.\\.tspace\\board.ps1 claim t3              # nhận task t3
.\\.tspace\\board.ps1 done t3 -Reviewer a2  # làm xong, nhờ a2 chấm
.\\.tspace\\board.ps1 note t3 -Verdict pass -Text "Logic đúng, đã chạy thử."
.\\.tspace\\board.ps1 note t3 -Verdict fail -Text "Thiếu case cwd không tồn tại."
.\\.tspace\\board.ps1 block t3 -Text "Chờ quyết định về schema"
\`\`\`

\`list\`, \`mine\`, \`review\` nhận thêm \`-Json\` nếu bạn muốn tự parse thay vì đọc bảng.

## Thói quen nên có

- Đầu phiên: \`.\\.tspace\\board.ps1 mine\` và \`review\` để biết mình đang nợ gì.
- Chia việc lớn thành nhiều task \`add\` rồi để các agent khác \`claim\`, thay vì ôm hết.
- Khi \`fail\` một task, nói rõ **cần sửa gì** — người nhận là một agent khác, không đọc
  được suy nghĩ của bạn.
`
}

export const ROOT_AGENTS_BLOCK = `## Phối hợp nhiều agent (T_Space)

Worktree này đang được nhiều agent dùng chung. Trước khi sửa code, **đọc
\`.tspace/AGENTS.md\`** và nhận việc trên task board:

\`\`\`powershell
.\\.tspace\\board.ps1 mine
.\\.tspace\\board.ps1 review
\`\`\`

Đừng sửa \`.tspace/board.json\` bằng tay; mọi thay đổi đi qua \`.tspace\\board.ps1\`.`

/**
 * Helper cho agent. Yêu cầu chạy được trên Windows PowerShell 5.1: không `&&`, không
 * ternary, không `??`, `ConvertFrom-Json` trả PSCustomObject (không có `-AsHashtable`).
 *
 * Ghi file bằng `[System.IO.File]::WriteAllText` với UTF8Encoding($false) để không dính
 * BOM — `JSON.parse` phía main không nuốt được BOM.
 */
export const BOARD_HELPER_PS1 = String.raw`<#
  board.ps1 - task board dung chung cho nhieu agent trong mot worktree (T_Space).
  Xem luat choi o .tspace/AGENTS.md. Moi thao tac ghi deu qua lock + tmp/rename.
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet('list', 'mine', 'review', 'add', 'claim', 'done', 'note', 'block', 'status', 'agents')]
  [string]$Command = 'list',

  [Parameter(Position = 1)]
  [string]$Id,

  [string]$Title,
  [string]$Detail = '',
  [string]$Assignee,
  [string]$Reviewer,
  [ValidateSet('pass', 'fail', 'comment')]
  [string]$Verdict = 'comment',
  [string]$Text = '',
  [ValidateSet('todo', 'doing', 'review', 'done', 'blocked')]
  [string]$State,
  [switch]$Json
)

$ErrorActionPreference = 'Stop'

$BoardPath = $env:TSPACE_BOARD
if ([string]::IsNullOrWhiteSpace($BoardPath)) {
  $BoardPath = Join-Path $PSScriptRoot 'board.json'
}
$LockPath = "$BoardPath.lock"

$Me = $env:TSPACE_AGENT_SLOT
if ([string]::IsNullOrWhiteSpace($Me)) { $Me = 'unknown' }

function Read-Board {
  if (-not (Test-Path $BoardPath)) {
    return [pscustomobject]@{ version = 1; updatedAt = 0; agents = @(); tasks = @() }
  }
  $raw = [System.IO.File]::ReadAllText($BoardPath)
  $raw = $raw.TrimStart([char]0xFEFF)
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return [pscustomobject]@{ version = 1; updatedAt = 0; agents = @(); tasks = @() }
  }
  return $raw | ConvertFrom-Json
}

function Write-Board($board) {
  $board.updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $json = $board | ConvertTo-Json -Depth 10
  $tmp = "$BoardPath.$PID.tmp"
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($tmp, $json, $utf8)
  Move-Item -LiteralPath $tmp -Destination $BoardPath -Force
}

function Lock-Board {
  # Lock cu hon 30s coi nhu mo coi (agent bi kill giua chung).
  if (Test-Path $LockPath) {
    $age = (Get-Date) - (Get-Item $LockPath).LastWriteTime
    if ($age.TotalSeconds -gt 30) { Remove-Item $LockPath -Force -ErrorAction SilentlyContinue }
  }
  for ($i = 0; $i -lt 150; $i++) {
    try {
      return [System.IO.File]::Open($LockPath, [System.IO.FileMode]::CreateNew,
        [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    } catch {
      Start-Sleep -Milliseconds (20 + (Get-Random -Maximum 60))
    }
  }
  throw "Khong lay duoc lock board sau 150 lan thu: $LockPath"
}

function Unlock-Board($handle) {
  if ($null -ne $handle) { $handle.Close() }
  Remove-Item $LockPath -Force -ErrorAction SilentlyContinue
}

function Edit-Board([scriptblock]$change) {
  $handle = Lock-Board
  try {
    $board = Read-Board
    $result = & $change $board
    Write-Board $board
    return $result
  } finally {
    Unlock-Board $handle
  }
}

function Get-Task($board, [string]$taskId) {
  $task = @($board.tasks) | Where-Object { $_.id -eq $taskId } | Select-Object -First 1
  if ($null -eq $task) { throw "Khong tim thay task '$taskId'. Chay: board.ps1 list" }
  return $task
}

function Show-Tasks($tasks) {
  if ($Json) {
    @($tasks) | ConvertTo-Json -Depth 10
    return
  }
  if (@($tasks).Count -eq 0) {
    Write-Host '(khong co task nao)' -ForegroundColor DarkGray
    return
  }
  @($tasks) | ForEach-Object {
    [pscustomobject]@{
      id       = $_.id
      status   = $_.status
      assignee = $_.assignee
      reviewer = $_.reviewer
      notes    = @($_.notes).Count
      title    = $_.title
    }
  } | Format-Table -AutoSize
}

function New-TaskId($board) {
  $max = 0
  foreach ($task in @($board.tasks)) {
    if ($task.id -match '^t(\d+)$') {
      $n = [int]$Matches[1]
      if ($n -gt $max) { $max = $n }
    }
  }
  return "t$($max + 1)"
}

function Now { return [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }

switch ($Command) {

  'list' {
    Show-Tasks (Read-Board).tasks
  }

  'mine' {
    Show-Tasks (@((Read-Board).tasks) | Where-Object { $_.assignee -eq $Me -and $_.status -ne 'done' })
  }

  'review' {
    Show-Tasks (@((Read-Board).tasks) | Where-Object { $_.reviewer -eq $Me -and $_.status -eq 'review' })
  }

  'agents' {
    $board = Read-Board
    if ($Json) { @($board.agents) | ConvertTo-Json -Depth 10 }
    else { @($board.agents) | Format-Table -AutoSize }
  }

  'add' {
    if ([string]::IsNullOrWhiteSpace($Title)) { throw 'Thieu -Title.' }
    $newId = Edit-Board {
      param($board)
      $taskId = New-TaskId $board
      $assignedTo = $null
      if (-not [string]::IsNullOrWhiteSpace($Assignee)) { $assignedTo = $Assignee }
      $task = [pscustomobject]@{
        id        = $taskId
        title     = $Title
        detail    = $Detail
        status    = 'todo'
        assignee  = $assignedTo
        reviewer  = $null
        createdBy = $Me
        createdAt = (Now)
        updatedAt = (Now)
        notes     = @()
      }
      $board.tasks = @(@($board.tasks) + $task)
      return $taskId
    }
    Write-Host "Da them $newId : $Title" -ForegroundColor Green
  }

  'claim' {
    if ([string]::IsNullOrWhiteSpace($Id)) { throw 'Thieu id task.' }
    Edit-Board {
      param($board)
      $task = Get-Task $board $Id
      if ($task.status -eq 'doing' -and $task.assignee -ne $Me) {
        throw "Task $Id dang do '$($task.assignee)' lam. Chon task khac."
      }
      $task.status = 'doing'
      $task.assignee = $Me
      $task.updatedAt = (Now)
    } | Out-Null
    Write-Host "$Me da nhan $Id" -ForegroundColor Green
  }

  'done' {
    if ([string]::IsNullOrWhiteSpace($Id)) { throw 'Thieu id task.' }
    Edit-Board {
      param($board)
      $task = Get-Task $board $Id
      if ([string]::IsNullOrWhiteSpace($Reviewer)) {
        $task.status = 'done'
      } else {
        if ($Reviewer -eq $Me) { throw 'Khong tu cham bai cua chinh minh. Chon slot khac.' }
        $task.status = 'review'
        $task.reviewer = $Reviewer
      }
      $task.updatedAt = (Now)
    } | Out-Null
    if ([string]::IsNullOrWhiteSpace($Reviewer)) { Write-Host "$Id -> done" -ForegroundColor Green }
    else { Write-Host "$Id -> review, cho $Reviewer cham" -ForegroundColor Yellow }
  }

  'note' {
    if ([string]::IsNullOrWhiteSpace($Id)) { throw 'Thieu id task.' }
    if ([string]::IsNullOrWhiteSpace($Text)) { throw 'Thieu -Text.' }
    Edit-Board {
      param($board)
      $task = Get-Task $board $Id
      $note = [pscustomobject]@{ by = $Me; verdict = $Verdict; text = $Text; at = (Now) }
      $task.notes = @(@($task.notes) + $note)
      # pass thi dong task, fail thi tra ve cho nguoi lam sua tiep.
      if ($Verdict -eq 'pass') { $task.status = 'done' }
      if ($Verdict -eq 'fail') { $task.status = 'doing' }
      $task.updatedAt = (Now)
    } | Out-Null
    Write-Host "Da ghi nhan xet ($Verdict) vao $Id" -ForegroundColor Green
  }

  'block' {
    if ([string]::IsNullOrWhiteSpace($Id)) { throw 'Thieu id task.' }
    Edit-Board {
      param($board)
      $task = Get-Task $board $Id
      $task.status = 'blocked'
      if (-not [string]::IsNullOrWhiteSpace($Text)) {
        $note = [pscustomobject]@{ by = $Me; verdict = 'comment'; text = $Text; at = (Now) }
        $task.notes = @(@($task.notes) + $note)
      }
      $task.updatedAt = (Now)
    } | Out-Null
    Write-Host "$Id -> blocked" -ForegroundColor Yellow
  }

  'status' {
    if ([string]::IsNullOrWhiteSpace($Id)) { throw 'Thieu id task.' }
    if ([string]::IsNullOrWhiteSpace($State)) { throw 'Thieu -State.' }
    Edit-Board {
      param($board)
      $task = Get-Task $board $Id
      $task.status = $State
      $task.updatedAt = (Now)
    } | Out-Null
    Write-Host "$Id -> $State" -ForegroundColor Green
  }
}
`
