import type { Extension } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { python } from '@codemirror/lang-python'
import { StreamLanguage } from '@codemirror/language'
import { powerShell } from '@codemirror/legacy-modes/mode/powershell'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { yaml } from '@codemirror/legacy-modes/mode/yaml'
import { extname } from '@renderer/utils/path'

export function languageFor(path: string): Extension[] {
  switch (extname(path)) {
    case 'ts':
      return [javascript({ typescript: true })]
    case 'tsx':
      return [javascript({ typescript: true, jsx: true })]
    case 'js':
    case 'mjs':
    case 'cjs':
      return [javascript()]
    case 'jsx':
      return [javascript({ jsx: true })]
    case 'json':
      return [json()]
    case 'md':
      return [markdown()]
    case 'css':
    case 'scss':
      return [css()]
    case 'html':
      return [html()]
    case 'py':
      return [python()]
    case 'ps1':
    case 'psm1':
      return [StreamLanguage.define(powerShell)]
    case 'sh':
    case 'bash':
      return [StreamLanguage.define(shell)]
    case 'yml':
    case 'yaml':
      return [StreamLanguage.define(yaml)]
    default:
      return []
  }
}
