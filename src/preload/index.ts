import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/channels'
import type { SessionExitEvent, SessionOutputEvent, StartSessionRequest, WorkbenchApi } from '../shared/types'

const api: WorkbenchApi = {
  chooseProject: () => ipcRenderer.invoke(IPC.chooseProject),
  chooseProjectBaseDirectory: () => ipcRenderer.invoke(IPC.chooseProjectBaseDirectory),
  createProject: (request) => ipcRenderer.invoke(IPC.createProject, request),
  loadProject: (root) => ipcRenderer.invoke(IPC.loadProject, root),
  listProjects: () => ipcRenderer.invoke(IPC.listProjects),
  removeProject: (root) => ipcRenderer.invoke(IPC.removeProject, root),
  getRecentProject: () => ipcRenderer.invoke(IPC.recentProject),
  getGitStatus: (root) => ipcRenderer.invoke(IPC.gitStatus, root),
  getRuntimeStatus: () => ipcRenderer.invoke(IPC.runtimeStatus),
  chooseCodeAgentBatch: () => ipcRenderer.invoke(IPC.chooseCodeAgentBatch),
  resetCodeAgentBatch: () => ipcRenderer.invoke(IPC.resetCodeAgentBatch),
  startSession: (request: StartSessionRequest) => ipcRenderer.invoke(IPC.startSession, request),
  send: (id, text) => ipcRenderer.invoke(IPC.sendSession, id, text),
  resize: (id, cols, rows) => ipcRenderer.invoke(IPC.resizeSession, id, cols, rows),
  stopSession: (id) => ipcRenderer.invoke(IPC.stopSession, id),
  deleteSession: (id) => ipcRenderer.invoke(IPC.deleteSession, id),
  listSessions: (root) => ipcRenderer.invoke(IPC.listSessions, root),
  getSessionHistory: (id) => ipcRenderer.invoke(IPC.sessionHistory, id),
  onSessionOutput: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: SessionOutputEvent): void => callback(payload)
    ipcRenderer.on(IPC.sessionOutput, listener)
    return () => ipcRenderer.removeListener(IPC.sessionOutput, listener)
  },
  onSessionExit: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: SessionExitEvent): void => callback(payload)
    ipcRenderer.on(IPC.sessionExit, listener)
    return () => ipcRenderer.removeListener(IPC.sessionExit, listener)
  }
}

contextBridge.exposeInMainWorld('workbench', api)
