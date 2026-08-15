# T_Space

Multi-pane terminal workspace cho Windows — một cửa sổ duy nhất gồm file explorer bên trái và
tối đa 6 pane terminal/PowerShell bên phải, tất cả cùng làm việc trên một git worktree chung.

## Tính năng

- **Tối đa 6 pane terminal** chạy song song, mỗi pane là một PTY độc lập (PowerShell / cmd / Git Bash)
- **Chế độ shared worktree** — mọi pane cùng trỏ vào một git worktree, status bar hiện branch chung
- **File explorer** kiểu VS Code: duyệt cây thư mục, tạo/đổi tên/xoá, "Open Terminal Here"
- **Editor tích hợp** với syntax highlight, Ctrl+S để lưu
- **Layout linh hoạt**: 1 · 2 ngang · 2 dọc · 3 · 4 (2×2) · 6 (3×2), kéo thả đổi kích thước
- Khôi phục layout và workspace khi mở lại

## Yêu cầu

- Windows 10/11
- Node.js 20+ (dev)

## Chạy thử

```powershell
npm install
npm run dev
```

## Đóng gói

```powershell
npm run dist
```

Kết quả ở `release/`.

## Phát triển

Xem [CLAUDE.md](./CLAUDE.md) — kiến trúc, quy ước code, và **quy tắc worktree bắt buộc**.
