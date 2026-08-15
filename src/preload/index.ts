import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  DirEntry,
  FileReadResult,
  FsChangeEvent,
  GitStatusInfo,
  PersistedState,
  PtyDataEvent,
  PtyExitEvent,
  ShellProfile,
  SpawnOptions,
  WorkspaceInfo,
  WorktreeInfo
} from '@shared/types'

function subscribe<T>(channel: string, handler: (payload: T) => void): () => void {
  const listener = (_e: Electron.IpcRendererEvent, payload: T): void => handler(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.off(channel, listener)
}

const api = {
  pty: {
    listShells: (): Promise<ShellProfile[]> => ipcRenderer.invoke(IPC.pty.listShells),
    spawn: (options: SpawnOptions): Promise<string> => ipcRenderer.invoke(IPC.pty.spawn, options),
    write: (paneId: string, data: string): void => ipcRenderer.send(IPC.pty.write, paneId, data),
    resize: (paneId: string, cols: number, rows: number): void =>
      ipcRenderer.send(IPC.pty.resize, paneId, cols, rows),
    kill: (paneId: string): Promise<void> => ipcRenderer.invoke(IPC.pty.kill, paneId),
    onData: (handler: (e: PtyDataEvent) => void): (() => void) =>
      subscribe<PtyDataEvent>(IPC.pty.data, handler),
    onExit: (handler: (e: PtyExitEvent) => void): (() => void) =>
      subscribe<PtyExitEvent>(IPC.pty.exit, handler)
  },
  fs: {
    readDir: (dir: string): Promise<DirEntry[]> => ipcRenderer.invoke(IPC.fs.readDir, dir),
    readFile: (file: string): Promise<FileReadResult> => ipcRenderer.invoke(IPC.fs.readFile, file),
    writeFile: (file: string, content: string): Promise<void> =>
      ipcRenderer.invoke(IPC.fs.writeFile, file, content),
    createFile: (file: string): Promise<void> => ipcRenderer.invoke(IPC.fs.createFile, file),
    createDir: (dir: string): Promise<void> => ipcRenderer.invoke(IPC.fs.createDir, dir),
    rename: (from: string, to: string): Promise<void> =>
      ipcRenderer.invoke(IPC.fs.rename, from, to),
    trash: (target: string): Promise<void> => ipcRenderer.invoke(IPC.fs.trash, target),
    reveal: (target: string): Promise<void> =>
      ipcRenderer.invoke(IPC.fs.revealInExplorer, target),
    onChanged: (handler: (e: FsChangeEvent) => void): (() => void) =>
      subscribe<FsChangeEvent>(IPC.fs.changed, handler)
  },
  workspace: {
    pickFolder: (title?: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC.workspace.pickFolder, title),
    open: (root: string): Promise<WorkspaceInfo> => ipcRenderer.invoke(IPC.workspace.open, root)
  },
  git: {
    status: (gitRoot: string): Promise<GitStatusInfo> => ipcRenderer.invoke(IPC.git.status, gitRoot),
    listWorktrees: (gitRoot: string, currentRoot: string): Promise<WorktreeInfo[]> =>
      ipcRenderer.invoke(IPC.git.listWorktrees, gitRoot, currentRoot)
  },
  state: {
    load: (): Promise<PersistedState> => ipcRenderer.invoke(IPC.state.load),
    save: (state: PersistedState): Promise<void> => ipcRenderer.invoke(IPC.state.save, state)
  },
  window: {
    minimize: (): void => ipcRenderer.send(IPC.window.minimize),
    toggleMaximize: (): void => ipcRenderer.send(IPC.window.toggleMaximize),
    close: (): void => ipcRenderer.send(IPC.window.close),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke(IPC.window.isMaximized),
    onMaximizeChanged: (handler: (maximized: boolean) => void): (() => void) =>
      subscribe<boolean>(IPC.window.maximizeChanged, handler)
  }
}

export type TSpaceApi = typeof api

contextBridge.exposeInMainWorld('tspace', api)
