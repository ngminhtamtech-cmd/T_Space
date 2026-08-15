import { createRoot } from 'react-dom/client'
import '@xterm/xterm/css/xterm.css'
import './styles.css'
import { App } from './App'

// Không bọc StrictMode: effect chạy 2 lần trong dev sẽ spawn rồi kill 2 tiến trình
// shell thật cho mỗi pane — nhiễu và tốn tài nguyên.
createRoot(document.getElementById('root')!).render(<App />)
