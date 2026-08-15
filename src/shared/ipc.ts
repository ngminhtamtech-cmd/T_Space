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
    listWorktrees: 'git:listWorktrees',
    listBranches: 'git:listBranches',
    commitAll: 'git:commitAll',
    createWorktree: 'git:createWorktree',
    removeWorktree: 'git:removeWorktree',
    suggestWorktreePath: 'git:suggestWorktreePath'
  },
  board: {
    ensure: 'board:ensure',
    read: 'board:read',
    write: 'board:write',
    /** main → renderer */
    changed: 'board:changed'
  },
  transcript: {
    save: 'transcript:save',
    read: 'transcript:read',
    clear: 'transcript:clear',
    clearWorkspace: 'transcript:clearWorkspace'
  },
  state: {
    load: 'state:load',
    save: 'state:save'
  },
  app: {
    /** main → renderer: ghi state ngay, đừng chờ hết debounce vì app sắp thoát. */
    flushState: 'app:flushState',
    /** renderer → main: đã ghi xong. */
    stateFlushed: 'app:stateFlushed'
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
