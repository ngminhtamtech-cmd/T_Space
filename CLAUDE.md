# T_Space

Công cụ cá nhân: một cửa sổ desktop (Electron) gồm **file explorer kiểu VS Code bên trái** và
**tối đa 6 pane terminal/PowerShell bên phải**, tất cả cùng trỏ vào **một git worktree chung**.
Mục đích: thao tác CLI dễ hơn, thay cho việc mở nhiều cửa sổ PowerShell rời rạc.

---

## ⚠️ QUY TẮC WORKTREE (BẮT BUỘC — đọc trước mọi phiên làm việc)

1. **Mọi phiên làm việc phải diễn ra trong một git worktree cụ thể.** Không code trực tiếp ở
   checkout gốc.
2. **Nếu nhiệm vụ không nêu rõ dùng worktree mới hay worktree có sẵn nào → PHẢI HỎI người dùng
   trước khi thao tác.** Không tự suy đoán. Không mặc định lấy worktree gần nhất hay worktree đang
   đứng. Hỏi rồi chờ trả lời.
3. **Không bao giờ commit trực tiếp lên `main` từ checkout gốc** `D:\03_Projects\T_Space`.
   Checkout gốc chỉ dùng để quản lý worktree và đồng bộ với remote.
4. Worktree mới đặt tại `D:\03_Projects\T_Space_worktrees\<tên-branch-đã-slug-hoá>`.
   Ví dụ branch `feat/t-space-shell` → `D:\03_Projects\T_Space_worktrees\feat-t-space-shell`.
5. **Đầu mỗi phiên: chạy `git worktree list` và nêu rõ đang đứng ở worktree/branch nào** trước khi
   sửa bất cứ file nào.

### Lệnh worktree thường dùng

```powershell
# Xem danh sách worktree hiện có
git worktree list

# Tạo worktree mới kèm branch mới
git worktree add -b feat/<ten> D:\03_Projects\T_Space_worktrees\feat-<ten>

# Tạo worktree từ branch đã có
git worktree add D:\03_Projects\T_Space_worktrees\<slug> <branch-da-co>

# Gỡ worktree khi xong việc (chạy từ checkout gốc)
git worktree remove D:\03_Projects\T_Space_worktrees\<slug>
git worktree prune
```

---

## Môi trường máy (đã kiểm chứng)

- Windows 11 Pro, Node 24.13.0, npm 11.6.2
- **Không có MSVC build tools** (`cl.exe` / `msbuild` không tồn tại) → không compile được native
  module. Mọi native dependency phải có sẵn binary prebuilt.
- **Không có `pwsh`** (PowerShell 7). Shell mặc định là Windows PowerShell 5.1 (`powershell.exe`).
- Không có `gh` CLI → dùng `git` thuần, remote qua HTTPS.

Hệ quả cho PowerShell 5.1 khi chạy lệnh: không có `&&`, `||`, toán tử ternary, `??`, `?.`.
Dùng `;` và `if ($?) { ... }`.

---

## Kiến trúc

```
src/
  main/                    # Electron main process (Node)
    index.ts               # createWindow, app lifecycle
    pty/PtyManager.ts      # vòng đời PTY, hard limit 6 session, batch output
    fs/FileService.ts      # readDir/readFile/writeFile/rename/trash + chokidar watcher
    git/GitService.ts      # simple-git: toplevel, branch, status, worktree list
    state/Persist.ts       # đọc/ghi state.json trong app.getPath('userData')
    ipc/handlers.ts        # toàn bộ ipcMain.handle tập trung một chỗ
  preload/
    index.ts               # contextBridge.exposeInMainWorld('tspace', api)
  renderer/                # React 19 + TypeScript
    App.tsx
    store.ts               # zustand: workspace, panes[], layout, activePaneId, openFile
    components/
      Sidebar/             # FileTree, FileTreeNode, ContextMenu
      Editor/              # EditorPane (CodeMirror)
      Terminal/            # TerminalPane (xterm), PaneGrid, PaneHeader
      StatusBar.tsx
shared/
  ipc.ts                   # tên kênh IPC + type payload dùng chung 3 process
```

### Nguyên tắc quan trọng

- **Bảo mật Electron:** `contextIsolation: true`, `nodeIntegration: false`. Renderer chỉ nói chuyện
  với main qua contextBridge — **không** expose `ipcRenderer` thô.
- **Path guard:** mọi path nhận từ renderer phải `path.resolve` rồi kiểm tra nằm trong workspace
  root; ngoài phạm vi → reject. Dùng chung một helper cho toàn bộ handler fs.
- **Giới hạn 6 PTY enforce ở main process**, không chỉ ở UI.
- **Output PTY gom batch, flush mỗi ~8ms.** Gửi từng chunk một sẽ nghẽn IPC khi lệnh in nhiều
  (vd `npm install`).
- **Dọn PTY trong `app.on('before-quit')`** để không để lại `powershell.exe`/`conhost.exe` mồ côi.
- **`readDir` lazy** (chỉ đọc khi expand). Không đệ quy toàn bộ — `node_modules` sẽ treo UI.
- Xoá file dùng `shell.trashItem` (vào Recycle Bin), không xoá vĩnh viễn.
- Phím tắt đăng ký trong renderer, **không dùng `globalShortcut`** (sẽ cướp phím của app khác).
  xterm nuốt hầu hết phím → đăng ký qua `term.attachCustomKeyEventHandler`.

---

## Lệnh dev

```powershell
npm install        # cài dependencies
npm run dev        # chạy Electron ở chế độ dev (hot reload renderer)
npm run build      # type-check + build 3 target (main/preload/renderer)
npm run dist       # đóng gói .exe bằng electron-builder → release/
```

---

## Quy ước code

- TypeScript strict. Không dùng `any` trừ khi có lý do ghi rõ trong comment.
- Type dùng chung giữa main/preload/renderer đặt ở `shared/`, không import chéo giữa các process.
- Tên kênh IPC theo dạng `domain:action` (`pty:spawn`, `fs:readDir`, `git:status`).
- Component React: một component một file, đặt tên file trùng tên component.
- Không thêm comment giải thích những gì code đã nói rõ.
