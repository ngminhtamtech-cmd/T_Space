import { createRoot } from 'react-dom/client'
import '@xterm/xterm/css/xterm.css'
import './styles/index.css'
import { App } from './App'
import { useStore } from './store'

// xterm render bằng WebGL nên không đọc được nội dung terminal qua DOM; gỡ lỗi UI
// phải đi qua CDP (npm run dev -- --remote-debugging-port=9222) và cần chạm store.
if (import.meta.env.DEV) {
  ;(window as unknown as { __store: typeof useStore }).__store = useStore
}

// Không bọc StrictMode: effect chạy 2 lần trong dev sẽ spawn rồi kill 2 tiến trình
// shell thật cho mỗi pane — nhiễu và tốn tài nguyên.
createRoot(document.getElementById('root')!).render(<App />)
