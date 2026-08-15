import * as pty from '@lydell/node-pty'

const shell = `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`

function runPane(i) {
  return new Promise((resolve) => {
    const p = pty.spawn(shell, ['-NoLogo', '-NoProfile'], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env,
      useConpty: true
    })

    let out = ''
    let matched = false
    const marker = `MARKER-${i}-OK`

    p.onData((d) => {
      out += d
      // Bo qua lan echo lai chinh cau lenh; chi tinh khi marker xuat hien lan thu 2.
      if (!matched && out.split(marker).length > 2) {
        matched = true
        resolve({ i, ok: true, pid: p.pid, proc: p })
      }
    })

    p.onExit(({ exitCode }) => {
      if (!matched) resolve({ i, ok: false, reason: `thoat som, ma ${exitCode}`, proc: null })
    })

    // Cho shell in prompt xong roi moi gui lenh.
    setTimeout(() => p.write(`Write-Output "${marker}"\r`), 1200)
    setTimeout(() => {
      if (!matched) resolve({ i, ok: false, reason: 'timeout', proc: p })
    }, 15000)
  })
}

const results = await Promise.all([1, 2, 3, 4, 5, 6].map(runPane))

for (const r of results) {
  console.log(r.ok ? `pane ${r.i}: OK (pid ${r.pid})` : `pane ${r.i}: FAIL - ${r.reason}`)
}

const okCount = results.filter((r) => r.ok).length
console.log(`\nRESULT: ${okCount}/6 pane phan hoi doc lap`)

for (const r of results) {
  try {
    r.proc?.kill()
  } catch {}
}

setTimeout(() => process.exit(okCount === 6 ? 0 : 1), 500)
