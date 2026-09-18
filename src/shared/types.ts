export const WORK_MODES = ['QA', 'DEV', 'REVIEW', 'REFRESH'] as const

export type WorkMode = (typeof WORK_MODES)[number]

export interface SkillInfo {
  name: string
  relativePath: string
  mode: WorkMode | null
}

export interface ProjectInfo {
  root: string
  name: string
  skills: SkillInfo[]
  modeSkills: Partial<Record<WorkMode, SkillInfo>>
  warnings: string[]
}

export interface RegisteredProject {
  root: string
  name: string
  available: boolean
  error?: string
}

export interface GitStatus {
  available: boolean
  isRepository: boolean
  branch: string
  commit: string
  workingTree: 'clean' | 'dirty' | 'unknown'
  changedFiles: number
  error?: string
}

export interface RuntimeStatus {
  batchPath: string
  nodePath: string
  batchExists: boolean
  nodeExists: boolean
  ready: boolean
  message?: string
}

export type SessionState = 'running' | 'exited' | 'stopped' | 'failed'

export interface SessionSummary {
  id: string
  projectRoot: string
  mode: WorkMode
  skill: SkillInfo
  state: SessionState
  exitCode?: number
  startedAt: string
  title: string
}

export interface StartSessionRequest {
  projectRoot: string
  mode: WorkMode
  skill: SkillInfo
  review?: {
    requirement: string
    commitId: string
  }
}

export interface StartSessionResult {
  session: SessionSummary
  history: string
  reused: boolean
}

export interface SessionOutputEvent {
  sessionId: string
  data: string
}

export interface SessionExitEvent {
  sessionId: string
  exitCode: number
}

export interface WorkbenchApi {
  chooseProject(): Promise<ProjectInfo | null>
  loadProject(root: string): Promise<ProjectInfo>
  listProjects(): Promise<RegisteredProject[]>
  removeProject(root: string): Promise<RegisteredProject[]>
  getRecentProject(): Promise<string | null>
  getGitStatus(root: string): Promise<GitStatus>
  getRuntimeStatus(): Promise<RuntimeStatus>
  chooseCodeAgentBatch(): Promise<RuntimeStatus | null>
  resetCodeAgentBatch(): Promise<RuntimeStatus>
  startSession(request: StartSessionRequest): Promise<StartSessionResult>
  send(sessionId: string, text: string): Promise<void>
  resize(sessionId: string, cols: number, rows: number): Promise<void>
  stopSession(sessionId: string): Promise<void>
  listSessions(projectRoot: string): Promise<SessionSummary[]>
  getSessionHistory(sessionId: string): Promise<string>
  onSessionOutput(callback: (event: SessionOutputEvent) => void): () => void
  onSessionExit(callback: (event: SessionExitEvent) => void): () => void
}
