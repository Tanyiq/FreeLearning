import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import os from 'node:os'
import path from 'node:path'
import type { IPty } from 'node-pty'
import * as pty from 'node-pty'
import type {
  SessionExitEvent,
  SessionOutputEvent,
  SessionSummary,
  StartSessionRequest,
  StartSessionResult
} from '../shared/types'
import { getRuntimeStatus } from './runtime-service'

const MAX_HISTORY_CHARS = 1_000_000

interface ManagedSession {
  summary: SessionSummary
  pty: IPty
  history: string
}

export class SessionManager extends EventEmitter {
  private readonly sessions = new Map<string, ManagedSession>()

  start(request: StartSessionRequest, codeAgentBatchPath: string): StartSessionResult {
    const runtime = getRuntimeStatus(codeAgentBatchPath)
    if (!runtime.ready) throw new Error(runtime.message ?? 'CodeAgent 尚未就绪。')
    if (request.skill.mode !== request.mode) throw new Error('所选 Skill 与工作模式不匹配。')
    if (request.mode === 'REVIEW' && (!request.review?.requirement.trim() || !request.review.commitId.trim())) {
      throw new Error('REVIEW 需要原始需求和 Target Commit。')
    }

    const normalizedRoot = path.resolve(request.projectRoot)
    if (request.mode === 'QA') {
      const existing = [...this.sessions.values()].find(
        (item) =>
          item.summary.mode === 'QA' &&
          item.summary.projectRoot.toLowerCase() === normalizedRoot.toLowerCase() &&
          item.summary.state === 'running'
      )
      if (existing) return { session: existing.summary, history: existing.history, reused: true }
    }

    const id = randomUUID()
    const commandLine = `/d /q /s /c ""${runtime.batchPath}""`
    const process = pty.spawn('cmd.exe', commandLine, {
      name: 'xterm-256color',
      cols: 120,
      rows: 32,
      cwd: normalizedRoot,
      env: { ...processEnv(), TERM: 'xterm-256color' },
      useConpty: true
    })

    const summary: SessionSummary = {
      id,
      projectRoot: normalizedRoot,
      mode: request.mode,
      skill: request.skill,
      state: 'running',
      startedAt: new Date().toISOString(),
      title: `${request.mode} · ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`
    }
    const managed: ManagedSession = { summary, pty: process, history: '' }
    this.sessions.set(id, managed)

    process.onData((data) => {
      managed.history = trimHistory(managed.history + data)
      this.emit('output', { sessionId: id, data } satisfies SessionOutputEvent)
    })
    process.onExit(({ exitCode }) => {
      summary.state = summary.state === 'stopped' ? 'stopped' : 'exited'
      summary.exitCode = exitCode
      this.emit('exit', { sessionId: id, exitCode } satisfies SessionExitEvent)
    })

    const skillInstruction = `/${request.skill.name}`
    process.write(`${skillInstruction}${os.EOL}`)
    if (request.mode === 'REVIEW' && request.review) {
      process.write(`Requirement:${os.EOL}${request.review.requirement}${os.EOL}${os.EOL}Target Commit:${os.EOL}${request.review.commitId}${os.EOL}`)
    }

    return { session: summary, history: managed.history, reused: false }
  }

  send(sessionId: string, text: string): void {
    const session = this.requireRunning(sessionId)
    session.pty.write(text)
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId)
    if (!session || session.summary.state !== 'running') return
    session.pty.resize(Math.max(2, Math.floor(cols)), Math.max(1, Math.floor(rows)))
  }

  stop(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session || session.summary.state !== 'running') return
    session.summary.state = 'stopped'
    session.pty.kill()
  }

  stopProject(projectRoot: string): void {
    const normalizedRoot = path.resolve(projectRoot).toLowerCase()
    for (const session of this.sessions.values()) {
      if (session.summary.projectRoot.toLowerCase() === normalizedRoot && session.summary.state === 'running') {
        session.summary.state = 'stopped'
        session.pty.kill()
      }
    }
  }

  list(projectRoot: string): SessionSummary[] {
    const normalizedRoot = path.resolve(projectRoot).toLowerCase()
    return [...this.sessions.values()]
      .filter((item) => item.summary.projectRoot.toLowerCase() === normalizedRoot)
      .map((item) => item.summary)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }

  history(sessionId: string): string {
    return this.sessions.get(sessionId)?.history ?? ''
  }

  dispose(): void {
    for (const session of this.sessions.values()) {
      if (session.summary.state === 'running') {
        session.summary.state = 'stopped'
        session.pty.kill()
      }
    }
  }

  private requireRunning(sessionId: string): ManagedSession {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error('Session 不存在。')
    if (session.summary.state !== 'running') throw new Error('Session 已结束，请启动新的 Session。')
    return session
  }
}

function trimHistory(value: string): string {
  return value.length <= MAX_HISTORY_CHARS ? value : value.slice(value.length - MAX_HISTORY_CHARS)
}

function processEnv(): Record<string, string> {
  return Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined))
}
