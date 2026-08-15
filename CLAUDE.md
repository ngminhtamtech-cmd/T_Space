# T_Space

Công cụ cá nhân: một cửa sổ desktop (Electron) gồm **file explorer kiểu VS Code bên trái** và
**các pane terminal/PowerShell chia tự do bên phải**, tất cả cùng trỏ vào **một thư mục workspace
chung**. Mục đích: thao tác CLI dễ hơn, thay cho việc mở nhiều cửa sổ PowerShell rời rạc.

Hai màn hình:

- **Launcher** — 3 cột (rail | danh sách Workspace | Layout + Agent), bấm `Open` để vào workspace.
- **Workspace** — tab bar, file tree, editor, và lưới pane chia được bằng Split Right / Split Down
  ngay tại pane đang focus (như Split Editor của IDE).

---

## Quy tắc làm việc với git

1. **Làm việc trực tiếp trong `D:\03_Projects\T_Space`.** Đây là checkout duy nhất. **Không tạo
   git worktree phụ** và không tạo thư mục `T_Space_worktrees` — dự án đã bỏ cách làm đó.
2. Việc nhỏ (sửa lỗi, chỉnh nhỏ) commit thẳng lên `main` cũng được. Tính năng lớn thì tạo branch
   `feat/<ten>` ngay trong thư mục này rồi merge về `main` khi xong.
3. **Đầu mỗi phiên: chạy `git status -sb` và nêu rõ đang đứng ở branch nào** trước khi sửa file.
4. Remote qua HTTPS, không có `gh` CLI → dùng `git` thuần.

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
    App.tsx                # rẽ nhánh Launcher / Workspace
    store.ts               # zustand: view, tabs[], activeTabId, agents, presets, openFile
    theme/palette.ts       # bảng màu cho xterm (bản sao TS của tokens.css)
    styles/                # tokens.css + từng màn hình một file, index.css chỉ @import
    utils/id.ts
    views/
      Launcher/            # màn hình 3 cột: rail | WorkspaceList | ConfigPanel
      LayoutEditor/        # modal chia pane trực quan
      Workspace.tsx        # TabBar + sidebar + editor + PaneStack
    components/
      TitleBar.tsx         # thanh trên 32px, cửa sổ frameless
      TabBar.tsx           # tab + nút Split Right / Split Down
      icons.tsx            # SVG inline, không dùng thư viện icon
      Sidebar/             # FileTree, FileTreeNode, ContextMenu
      Editor/              # EditorPane (CodeMirror)
      Terminal/            # PaneStack, PaneGrid, PaneDivider, TerminalPane, PaneHeader
      StatusBar.tsx
shared/
  ipc.ts                   # tên kênh IPC dùng chung 3 process
  types.ts                 # PaneNode, TabState, AgentProfile, PersistedState…
  layout.ts                # engine cây layout (thuần, không import runtime)
  presets.ts               # preset layout + agent dựng sẵn
```

### Nguyên tắc quan trọng

- **Bảo mật Electron:** `contextIsolation: true`, `nodeIntegration: false`. Renderer chỉ nói chuyện
  với main qua contextBridge — **không** expose `ipcRenderer` thô.
- **Path guard:** mọi path nhận từ renderer phải `path.resolve` rồi kiểm tra nằm trong workspace
  root; ngoài phạm vi → reject. Dùng chung một helper cho toàn bộ handler fs.
- **Giới hạn PTY:** `MAX_PANES_PER_TAB = 8` chặn ở renderer, `MAX_PTY = 16` là trần cứng enforce ở
  main process — không chỉ ở UI.
- **Output PTY gom batch, flush mỗi ~8ms.** Gửi từng chunk một sẽ nghẽn IPC khi lệnh in nhiều
  (vd `npm install`).
- **Dọn PTY trong `app.on('before-quit')`** để không để lại `powershell.exe`/`conhost.exe` mồ côi.
- **`readDir` lazy** (chỉ đọc khi expand). Không đệ quy toàn bộ — `node_modules` sẽ treo UI.
- Xoá file dùng `shell.trashItem` (vào Recycle Bin), không xoá vĩnh viễn.
- Phím tắt đăng ký trong renderer, **không dùng `globalShortcut`** (sẽ cướp phím của app khác).
  xterm nuốt hầu hết phím → đăng ký ở capture phase trên `window`.

### Ba bẫy chết người quanh xterm — đừng phá

1. **Pane render phẳng + `position: absolute`, KHÔNG lồng component theo cây layout.**
   `shared/layout.ts` tính toạ độ %, `PaneGrid` render một danh sách phẳng key theo `pane.id`.
   Nếu render cây bằng component lồng nhau, mỗi lần split pane cũ sẽ đổi độ sâu trong cây React →
   React remount → xterm bị dispose và PTY chết.
2. **Mọi tab đều mount cùng lúc, tab nền chỉ `display: none`** (`PaneStack`). Unmount tab nền sẽ gỡ
   listener `pty.onData` → mất trắng output của lệnh đang chạy ở tab đó.
3. **Chỉ bật tự lưu state sau khi khôi phục kết thúc** (`finishHydration`). Bật sớm thì một lần
   khôi phục hỏng sẽ ghi state rỗng đè lên phiên đã lưu. `store.pendingTabs` giữ bản sao tab chưa
   dựng lại được để lần lưu sau không xoá mất chúng.

### Cây layout

`PaneNode` là cây split n-ary (`shared/types.ts`). Split cùng chiều với split cha thì chèn thêm
sibling (cây phẳng, đúng cảm giác IDE); khác chiều thì thay leaf bằng split node mới.
`shared/layout.ts` **không được import runtime nào** — chỉ `import type` — nhờ vậy
`scripts/smoke-layout.mjs` chạy thẳng được bằng node (Node tự strip type). Giữ nguyên tính chất đó.

### Phím tắt

| Phím | Việc |
|---|---|
| `Ctrl+\` / `Ctrl+Shift+\` | Split Right / Split Down pane đang focus |
| `` Ctrl+Shift+` `` | Pane mới |
| `Ctrl+Shift+W` | Đóng pane đang focus |
| `Ctrl+T` / `Ctrl+Tab` / `Ctrl+Shift+Tab` | Tab mới / tab kế / tab trước |
| `Ctrl+B` | Ẩn/hiện sidebar |
| `Ctrl+1..8` | Focus pane theo thứ tự hiển thị |

---

## Lệnh dev

```powershell
npm install        # cài dependencies
npm run dev        # chạy Electron ở chế độ dev (hot reload renderer)
npm run build      # type-check + build 3 target (main/preload/renderer)
npm run dist       # đóng gói .exe bằng electron-builder → release/

npm run smoke:pty     # kiểm tra 6 PTY spawn song song được (không cần Electron)
npm run smoke:layout  # kiểm tra engine cây layout (không cần Electron)
```

### Sự cố đã gặp

- **`Error: Electron uninstall` khi chạy `npm run dev`** — postinstall của `electron` không tải
  binary về. Sửa: `node node_modules\electron\install.js` rồi chạy lại.
- **App không thoát hẳn khi đóng cửa sổ** — ConPTY đóng bất đồng bộ. `before-quit` phải
  `preventDefault`, chờ `ptyManager.disposeAll()` rồi mới `app.exit(0)`. Đừng bỏ bước chờ này.
- **Gỡ lỗi UI tự động**: `npm run dev -- --remote-debugging-port=9222` rồi điều khiển qua CDP
  (`http://127.0.0.1:9222/json/list`). Cần thiết vì xterm render bằng WebGL nên không đọc được
  nội dung terminal qua `innerText`. Ở chế độ dev, store nằm ở `window.__store` để tiện thao tác;
  chụp màn hình bằng `Page.captureScreenshot` là cách nhanh nhất để kiểm tra layout.
- **Cửa sổ frameless** (`frame: false`): title bar do `TitleBar.tsx` tự vẽ, kéo bằng
  `-webkit-app-region: drag`, các nút phải có `no-drag`. Nếu viền resize gặp vấn đề, phương án dự
  phòng là `titleBarStyle: 'hidden'` + `titleBarOverlay`.
- **Divider giao nhau**: tại điểm hai divider cắt nhau, divider render sau (nằm sâu hơn trong cây)
  nhận được chuột. Bình thường, không phải lỗi.

---

## Quy ước code

- TypeScript strict. Không dùng `any` trừ khi có lý do ghi rõ trong comment.
- Type dùng chung giữa main/preload/renderer đặt ở `shared/`, không import chéo giữa các process.
- Tên kênh IPC theo dạng `domain:action` (`pty:spawn`, `fs:readDir`, `git:status`).
- Component React: một component một file, đặt tên file trùng tên component.
- Không thêm comment giải thích những gì code đã nói rõ.
