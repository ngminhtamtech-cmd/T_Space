import { join } from 'node:path'
import { app, BrowserWindow, shell } from 'electron'
import { registerHandlers } from './ipc/handlers'
import { ptyManager } from './pty/PtyManager'
import { fileService } from './fs/FileService'

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    // Title bar tự vẽ trong renderer (TitleBar.tsx). Vẫn resize được từ viền —
    // Chromium tự xử lý hit-test cho cửa sổ frameless trên Windows.
    frame: false,
    backgroundColor: '#0f1115',
    title: 'T_Space',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // Preload cần require('electron') nên không bật sandbox; renderer vẫn bị
      // cách ly hoàn toàn qua contextIsolation.
      sandbox: false
    }
  })

  window.once('ready-to-show', () => window.show())

  // Link ngoài mở bằng trình duyệt hệ thống, không điều hướng cửa sổ app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (devServerUrl) {
    window.loadURL(devServerUrl)
  } else {
    window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }

  return window
}

app.whenReady().then(() => {
  const window = createWindow()
  registerHandlers(window)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const next = createWindow()
      registerHandlers(next)
    }
  })
})

// Dọn PTY trước khi thoát, nếu không sẽ để lại powershell.exe/conhost.exe mồ côi.
// Phải chờ ConPTY đóng hẳn rồi mới thoát, nếu không tiến trình Electron sẽ treo lại.
let quitting = false
app.on('before-quit', (event) => {
  if (quitting) return
  quitting = true
  event.preventDefault()

  void Promise.all([ptyManager.disposeAll(), fileService.dispose()]).finally(() => app.exit(0))
})

app.on('window-all-closed', () => {
  app.quit()
})
