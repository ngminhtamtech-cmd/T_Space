export const IPC = {
  pty: {
    listShells: 'pty:listShells',
    spawn: 'pty:spawn',
    write: 'pty:write',
    resize: 'pty:resize',
    kill: 'pty:kill',
    /** main → renderer */
    data: 'pty:data',
    /** main → renderer */
    exit: 'pty:exit'
  },
  fs: {
    readDir: 'fs:readDir',
    readFile: 'fs:readFile',
    writeFile: 'fs:writeFile',
    createFile: 'fs:createFile',
    createDir: 'fs:createDir',
    rename: 'fs:rename',
    trash: 'fs:trash',
    revealInExplorer: 'fs:revealInExplorer',
    /** main → renderer */
    changed: 'fs:changed'
  },
  workspace: {
    pickFolder: 'workspace:pickFolder',
    open: 'workspace:open'
  },
  git: {
    status: 'git:status',
    listWorktrees: 'git:listWorktrees'
  },
  state: {
    load: 'state:load',
    save: 'state:save'
  },
  window: {
    minimize: 'window:minimize',
    /** Toggle maximize/restore. */
    toggleMaximize: 'window:toggleMaximize',
    close: 'window:close',
    isMaximized: 'window:isMaximized',
    /** main → renderer */
    maximizeChanged: 'window:maximizeChanged'
  }
} as const
