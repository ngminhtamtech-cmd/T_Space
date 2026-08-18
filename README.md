# 🚀 T_Space

<p align="center">
  <b>Multi-Pane Terminal Workspace & Multi-Agent Git Worktree Orchestrator for Windows</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078D6?style=flat-square&logo=windows" alt="Platform" />
  <img src="https://img.shields.io/badge/Electron-43.x-47848F?style=flat-square&logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-7.x-646CFF?style=flat-square&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

---

## 📖 Giới thiệu (Overview)

**T_Space** là không gian làm việc terminal đa màn hình thế hệ mới dành cho Windows, tích hợp **File Explorer**, **Trình soạn thảo Code** và khả năng **chia lưới nhiều Terminal (PowerShell / cmd / Git Bash)** độc lập trong một cửa sổ duy nhất.

Đặc biệt, **T_Space** được thiết kế chuyên biệt để **điều phối nhiều AI Agent (Claude Code, OpenCode, Codex, Aider...) chạy song song trên cùng một Git Worktree** thông qua hệ thống Task Board tự động, giúp giải quyết triệt để sự lộn xộn khi phải mở hàng chục cửa sổ dòng lệnh riêng lẻ.

---

## ✨ Tính năng nổi bật (Key Features)

- 🖥️ **Lưới Terminal đa năng (Multi-Pane PTY)**:
  - Chia tách màn hình tự do theo chiều ngang hoặc dọc (`Split Right` / `Split Down`), hỗ trợ tối đa 8 pane trên mỗi tab.
  - Mỗi pane là một tiến trình ConPTY hoàn toàn độc lập (PowerShell 5.1/7, cmd, Git Bash...).
  - Phóng to toàn màn hình pane đang thao tác (`Ctrl+Shift+Z` hoặc double-click header) và thu nhỏ lại tức thì.
  - Quản lý đa dự án với hệ thống Tabs trực quan.

- 🤖 **Điều phối Đa Agent trên Shared Git Worktree**:
  - Tạo nhanh Git Worktree riêng biệt chỉ với 1 click và phân chia slot cho từng AI Agent (`a1`, `a2`, `a3`...).
  - Đồng bộ và giao việc cho Agent qua hệ thống bảng nhiệm vụ `.tspace/board.json` với CLI tool `board.ps1` an toàn (hỗ trợ lock chống ghi đè).
  - Tích hợp sẵn mẫu hướng dẫn `AGENTS.md` chuẩn hóa quy trình làm việc.

- 📁 **File Explorer & Editor tích hợp**:
  - Trình duyệt cây thư mục kiểu VS Code, hỗ trợ tạo mới, đổi tên, xoá an toàn (chuyển vào Recycle Bin).
  - Trình soạn thảo Code tích hợp (CodeMirror) với syntax highlighting đa ngôn ngữ (JavaScript, TypeScript, Python, HTML, CSS, Markdown, JSON...), lưu nhanh với `Ctrl+S`.

- 📜 **Lịch sử phiên & Smart Transcript**:
  - Tự động lưu lại transcript của từng pane theo từng workspace.
  - Cơ chế hiển thị buffer thông minh ngoài ConPTY, đảm bảo không bị mất log khi terminal resize hoặc clear screen.
  - Tự động khôi phục toàn bộ layout và trạng thái làm việc khi mở lại ứng dụng.

- ⚡ **Hiệu năng cao & Thiết kế tinh tế**:
  - Giao diện Dark theme hiện đại, cửa sổ Frameless tinh gọn tối đa diện tích hiển thị.
  - Xterm WebGL rendering mượt mà kết hợp cơ chế batching output PTY (8ms) chống giật lag khi chạy lệnh nặng (như `npm install`).

---

## 📥 Hướng dẫn cài đặt nhanh (Installation)

Bạn có thể lựa chọn 1 trong 2 cách cài đặt dưới đây tùy theo nhu cầu sử dụng:

### Cách 1: Cài đặt từ File `.exe` (Khuyên dùng cho người dùng)

Không cần cài đặt Node.js hay cấu hình môi trường phức tạp.

1. Truy cập mục **[Releases](https://github.com/ngminhtamtech-cmd/T_Space/releases)** của dự án.
2. Chọn phiên bản phù hợp để tải về:
   - 📦 **Bản Cài đặt (Setup Installer)**: `T_Space Setup <version>.exe`
     - Tự động cài đặt vào máy, tạo shortcut trên Desktop và Start Menu.
   - 🚀 **Bản Di động (Portable)**: `T_Space-<version>-portable.exe`
     - Không cần cài đặt, chỉ cần tải về và nhấp đúp chuột để chạy ngay (tiện lợi khi lưu trong USB).
3. Mở **T_Space**, chọn thư mục dự án của bạn và bắt đầu trải nghiệm!

---

### Cách 2: Cài đặt & Chạy từ Terminal / Mã nguồn (Dành cho Lập trình viên)

Dành cho các bạn muốn phát triển, chỉnh sửa mã nguồn hoặc tự build ứng dụng.

#### 1. Yêu cầu hệ thống (Prerequisites)
- Hệ điều hành: **Windows 10 / 11 (64-bit)**
- **Node.js**: Phiên bản `20.x` trở lên (Khuyến nghị Node.js 20 LTS hoặc 22/24)
- **Git** đã được cài đặt trên hệ thống.

#### 2. Các bước thực hiện

```powershell
# Bước 1: Clone mã nguồn từ GitHub
git clone https://github.com/ngminhtamtech-cmd/T_Space.git
cd T_Space

# Bước 2: Cài đặt các gói phụ thuộc (Dependencies)
npm install

# (Tùy chọn) Nếu gặp thông báo tải binary Electron khi cài đặt:
node node_modules\electron\install.js

# Bước 3: Khởi chạy ứng dụng ở chế độ Phát triển (Dev Mode với Hot Reload)
npm run dev
```

#### 3. Đóng gói ứng dụng thành file `.exe`
Khi muốn tự tạo bộ cài đặt `.exe`:
```powershell
npm run dist
```
Sau khi hoàn tất, các file `.exe` cài đặt sẽ nằm trong thư mục `release/`.

---

## ⌨️ Phím tắt tiện ích (Keyboard Shortcuts)

| Phím tắt | Chức năng |
|---|---|
| `Ctrl + \` | **Split Right** — Chia đôi màn hình sang phải tại pane hiện tại |
| `Ctrl + Shift + \` | **Split Down** — Chia đôi màn hình xuống dưới tại pane hiện tại |
| `Ctrl + Shift + \`` | Mở thêm pane mới |
| `Ctrl + Shift + W` | Đóng pane đang focus |
| `Ctrl + Shift + Z` | Phóng to (Maximize) / Khôi phục kích thước pane |
| `Esc` | Thu nhỏ pane đang phóng to về lại lưới layout |
| `Ctrl + T` | Mở Tab mới |
| `Ctrl + Tab` / `Ctrl + Shift + Tab` | Chuyển đổi qua lại giữa các tab |
| `Ctrl + B` | Ẩn / hiện thanh Sidebar (File Explorer & Task Board) |
| `Ctrl + 1..8` | Focus nhanh vào pane thứ 1 đến 8 theo thứ tự |
| `Ctrl + S` | Lưu file đang mở trong trình soạn thảo |

---

## 🛠️ Các lệnh NPM Scripts hữu ích

```powershell
npm run dev           # Chạy Electron ở chế độ dev (hot reload renderer)
npm run build         # Kiểm tra typecheck và build bundle (main, preload, renderer)
npm run typecheck     # Kiểm tra kiểu dữ liệu TypeScript (node + web)
npm run dist          # Đóng gói bộ cài đặt .exe cho Windows x64
npm run smoke:pty     # Kiểm tra khả năng spawn 6 PTY song song
npm run smoke:layout  # Chạy test kiểm thử động cơ phân chia layout
```

---

## 🏗️ Cấu trúc dự án (Architecture)

```text
T_Space/
├── src/
│   ├── main/                 # Electron Main Process (PTY manager, Git, File Service, Board)
│   ├── preload/              # Secure IPC contextBridge exposure
│   ├── renderer/             # React 19 UI (Launcher, Workspace, FileTree, Terminal, Editor)
│   └── shared/               # TypeScript interfaces, layout engine & board schemas
├── scripts/                  # Smoke tests cho PTY và layout engine
├── release/                  # Thư mục chứa file .exe sau khi đóng gói
└── electron.vite.config.ts   # Cấu hình Vite & Electron build
```

---

## 🤝 Đóng góp & Phát triển (Contributing)

Mọi đóng góp, báo lỗi (Issue) hoặc đề xuất tính năng (Pull Request) đều được hoan nghênh:

1. **Fork** repository này.
2. Tạo nhánh tính năng mới: `git checkout -b feat/ten-tinh-nang`.
3. Commit các thay đổi: `git commit -m 'feat: them tinh nang moi'`.
4. Push nhánh lên GitHub: `git push origin feat/ten-tinh-nang`.
5. Tạo **Pull Request** trên GitHub.

---

## 📄 Bản quyền (License)

Dự án được phân phối dưới giấy phép **MIT License**. Xem chi tiết tại file `LICENSE` (nếu có).

---

<p align="center">
  Phát triển với ❤️ bởi <b><a href="https://github.com/ngminhtamtech-cmd">ngminhtamtech</a></b>
</p>
