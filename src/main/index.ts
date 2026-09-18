import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import path from 'node:path'
import { IPC } from '../shared/channels'
import type { StartSessionRequest } from '../shared/types'
import { readGitStatus } from './git-service'
import { inspectProject } from './project-service'
import { ProjectRegistry } from './project-registry'
import { getRuntimeStatus } from './runtime-service'
import { RuntimeSettings } from './runtime-settings'
import { SessionManager } from './session-manager'

const sessions = new SessionManager()
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 920,
    minHeight: 620,
    title: 'Domain Agent Workbench',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  const projects = new ProjectRegistry(path.join(app.getPath('userData'), 'projects.json'))
  const runtimeSettings = new RuntimeSettings(path.join(app.getPath('userData'), 'settings.json'))
  ipcMain.handle(IPC.chooseProject, async () => {
    const options: Electron.OpenDialogOptions = {
      title: '选择 Domain Project 根目录',
      properties: ['openDirectory']
    }
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return null
    const project = await inspectProject(result.filePaths[0])
    await projects.add(project.root)
    return project
  })
  ipcMain.handle(IPC.loadProject, async (_event, root: string) => {
    const project = await inspectProject(root)
    await projects.setActive(project.root)
    return project
  })
  ipcMain.handle(IPC.listProjects, () => projects.list())
  ipcMain.handle(IPC.removeProject, async (_event, root: string) => {
    sessions.stopProject(root)
    await projects.remove(root)
    return projects.list()
  })
  ipcMain.handle(IPC.recentProject, () => projects.getActive())
  ipcMain.handle(IPC.gitStatus, (_event, root: string) => readGitStatus(root))
  ipcMain.handle(IPC.runtimeStatus, async () => getRuntimeStatus(await runtimeSettings.getCodeAgentBatchPath()))
  ipcMain.handle(IPC.chooseCodeAgentBatch, async () => {
    const options: Electron.OpenDialogOptions = {
      title: '选择 CodeAgent 启动 BAT',
      properties: ['openFile'],
      filters: [{ name: 'Windows Batch File', extensions: ['bat'] }]
    }
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return null
    const batchPath = result.filePaths[0]
    if (path.extname(batchPath).toLowerCase() !== '.bat') throw new Error('请选择 .bat 文件。')
    await runtimeSettings.setCodeAgentBatchPath(batchPath)
    return getRuntimeStatus(batchPath)
  })
  ipcMain.handle(IPC.resetCodeAgentBatch, async () => {
    await runtimeSettings.resetCodeAgentBatchPath()
    return getRuntimeStatus(await runtimeSettings.getCodeAgentBatchPath())
  })
  ipcMain.handle(IPC.startSession, async (_event, request: StartSessionRequest) => {
    const project = await inspectProject(request.projectRoot)
    const skill = project.skills.find(
      (candidate) => candidate.name === request.skill.name && candidate.relativePath === request.skill.relativePath
    )
    if (!skill || skill.mode !== request.mode) throw new Error('所选 Skill 不属于当前 Project 或与工作模式不匹配。')
    const batchPath = await runtimeSettings.getCodeAgentBatchPath()
    return sessions.start({ ...request, projectRoot: project.root, skill }, batchPath)
  })
  ipcMain.handle(IPC.sendSession, (_event, id: string, text: string) => sessions.send(id, text))
  ipcMain.handle(IPC.resizeSession, (_event, id: string, cols: number, rows: number) => sessions.resize(id, cols, rows))
  ipcMain.handle(IPC.stopSession, (_event, id: string) => sessions.stop(id))
  ipcMain.handle(IPC.listSessions, (_event, root: string) => sessions.list(root))
  ipcMain.handle(IPC.sessionHistory, (_event, id: string) => sessions.history(id))

  sessions.on('output', (payload) => mainWindow?.webContents.send(IPC.sessionOutput, payload))
  sessions.on('exit', (payload) => mainWindow?.webContents.send(IPC.sessionExit, payload))
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => sessions.dispose())
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
