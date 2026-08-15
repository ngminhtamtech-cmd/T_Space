import { useCallback, useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { vscodeDark } from '@uiw/codemirror-theme-vscode'
import { useStore } from '@renderer/store'
import { basename } from '@renderer/utils/path'
import { languageFor } from './languages'

export function EditorPane(): React.JSX.Element | null {
  const openFile = useStore((s) => s.openFile)
  const updateOpenFile = useStore((s) => s.updateOpenFile)
  const markFileSaved = useStore((s) => s.markFileSaved)
  const setOpenFile = useStore((s) => s.setOpenFile)
  const setToast = useStore((s) => s.setToast)

  const extensions = useMemo(() => (openFile ? languageFor(openFile.path) : []), [openFile?.path])

  const save = useCallback(async (): Promise<void> => {
    const current = useStore.getState().openFile
    if (!current || !current.dirty) return
    try {
      await window.tspace.fs.writeFile(current.path, current.content)
      markFileSaved()
    } catch (err) {
      setToast(err instanceof Error ? err.message : String(err))
    }
  }, [markFileSaved, setToast])

  if (!openFile) return null

  return (
    <div className="editor">
      <div className="editor__tab">
        <span className="editor__name">
          {basename(openFile.path)}
          {openFile.dirty && <span className="editor__dirty" title="Chưa lưu" />}
        </span>
        <span className="editor__path" title={openFile.path}>
          {openFile.path}
        </span>
        <button className="editor__close" onClick={() => setOpenFile(null)} title="Đóng file">
          ✕
        </button>
      </div>
      <div
        className="editor__body"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault()
            e.stopPropagation()
            void save()
          }
        }}
      >
        <CodeMirror
          value={openFile.content}
          theme={vscodeDark}
          extensions={extensions}
          height="100%"
          onChange={updateOpenFile}
          basicSetup={{ highlightActiveLine: true, foldGutter: true }}
        />
      </div>
    </div>
  )
}
