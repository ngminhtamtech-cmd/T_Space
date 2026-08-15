/**
 * Icon vẽ tay bằng SVG stroke. Không thêm thư viện icon: bundle nhẹ và tất cả
 * icon cùng một độ dày nét.
 */

interface Props {
  size?: number
}

function Svg({
  size = 16,
  children
}: Props & { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

/** Khung chữ nhật chia đôi theo chiều dọc — pane mới nằm bên phải. */
export function SplitRightIcon({ size = 18 }: Props = {}): React.JSX.Element {
  return (
    <Svg size={size}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <line x1="8" y1="2.5" x2="8" y2="13.5" />
    </Svg>
  )
}

/** Khung chữ nhật chia đôi theo chiều ngang — pane mới nằm bên dưới. */
export function SplitDownIcon({ size = 18 }: Props = {}): React.JSX.Element {
  return (
    <Svg size={size}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <line x1="1.5" y1="8" x2="14.5" y2="8" />
    </Svg>
  )
}

export function SidebarIcon({ size = 16 }: Props = {}): React.JSX.Element {
  return (
    <Svg size={size}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <line x1="6" y1="2.5" x2="6" y2="13.5" />
    </Svg>
  )
}

export function FolderIcon({ size = 16 }: Props = {}): React.JSX.Element {
  return (
    <Svg size={size}>
      <path d="M1.5 4.5a1 1 0 0 1 1-1h3l1.5 1.5h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1z" />
    </Svg>
  )
}

export function LayersIcon({ size = 16 }: Props = {}): React.JSX.Element {
  return (
    <Svg size={size}>
      <path d="M8 1.8 14.5 5 8 8.2 1.5 5z" />
      <path d="M1.5 8.5 8 11.7l6.5-3.2" />
      <path d="M1.5 11.5 8 14.7l6.5-3.2" />
    </Svg>
  )
}

export function GearIcon({ size = 16 }: Props = {}): React.JSX.Element {
  return (
    <Svg size={size}>
      <circle cx="8" cy="8" r="2.3" />
      <path d="M8 1.5v1.7M8 12.8v1.7M14.5 8h-1.7M3.2 8H1.5M12.6 3.4l-1.2 1.2M4.6 11.4l-1.2 1.2M12.6 12.6l-1.2-1.2M4.6 4.6 3.4 3.4" />
    </Svg>
  )
}

export function PlusIcon({ size = 14 }: Props = {}): React.JSX.Element {
  return (
    <Svg size={size}>
      <line x1="8" y1="3" x2="8" y2="13" />
      <line x1="3" y1="8" x2="13" y2="8" />
    </Svg>
  )
}

export function CloseIcon({ size = 12 }: Props = {}): React.JSX.Element {
  return (
    <Svg size={size}>
      <line x1="3.5" y1="3.5" x2="12.5" y2="12.5" />
      <line x1="12.5" y1="3.5" x2="3.5" y2="12.5" />
    </Svg>
  )
}

export function HomeIcon({ size = 16 }: Props = {}): React.JSX.Element {
  return (
    <Svg size={size}>
      <path d="M2.5 7 8 2.5 13.5 7v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" />
    </Svg>
  )
}

export function TrashIcon({ size = 14 }: Props = {}): React.JSX.Element {
  return (
    <Svg size={size}>
      <path d="M2.5 4.5h11M6 4.5V3a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1.5M4 4.5l.6 8a1 1 0 0 0 1 .95h4.8a1 1 0 0 0 1-.95l.6-8" />
    </Svg>
  )
}

/* ---------- Nút điều khiển cửa sổ (theo chuẩn Windows 11) ---------- */

export function WinMinimizeIcon(): React.JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
    </svg>
  )
}

export function WinMaximizeIcon(): React.JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" />
    </svg>
  )
}

export function WinRestoreIcon(): React.JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <rect x="0.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" />
      <path d="M2.5 2.5V0.5h7v7h-2" fill="none" stroke="currentColor" />
    </svg>
  )
}

export function WinCloseIcon(): React.JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" stroke="currentColor" fill="none" />
    </svg>
  )
}
