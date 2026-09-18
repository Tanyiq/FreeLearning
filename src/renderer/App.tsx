import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GitStatus, ProjectInfo, RegisteredProject, RuntimeStatus, SessionSummary, WorkMode } from '../shared/types'
import { WORK_MODES } from '../shared/types'
import { ReviewDialog } from './ReviewDialog'
import { useTerminal } from './use-terminal'

const MODE_DESCRIPTIONS: Record<WorkMode, string> = {
  QA: '问答与领域检索',
  DEV: '独立开发任务',
  REVIEW: '独立提交审查',
  REFRESH: '知识刷新任务'
}

export default function App() {
  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [registeredProjects, setRegisteredProjects] = useState<RegisteredProject[]>([])
  const [mode, setMode] = useState<WorkMode>('QA')
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null)
  const [git, setGit] = useState<GitStatus | null>(null)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [activeSession, setActiveSession] = useState<SessionSummary | null>(null)
  const [terminalHistory, setTerminalHistory] = useState('')
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [showProjects, setShowProjects] = useState(false)
  const [showRuntime, setShowRuntime] = useState(false)
  const { containerRef } = useTerminal({ sessionId: activeSession?.id ?? null, history: terminalHistory })

  const selectedSkill = project?.modeSkills[mode]
  const activeRunning = activeSession?.state === 'running'

  const refreshSessions = useCallback(async (root: string) => {
    setSessions(await window.workbench.listSessions(root))
  }, [])

  const acceptProject = useCallback(async (next: ProjectInfo) => {
    setProject(next)
    setActiveSession(null)
    setTerminalHistory('')
    setError(next.warnings[0] ?? null)
    const firstMode = WORK_MODES.find((candidate) => next.modeSkills[candidate])
    if (firstMode) setMode(firstMode)
    setGit(await window.workbench.getGitStatus(next.root))
    await refreshSessions(next.root)
  }, [refreshSessions])

  const refreshProjects = useCallback(async () => {
    const items = await window.workbench.listProjects()
    setRegisteredProjects(items)
    return items
  }, [])

  useEffect(() => {
    void window.workbench.getRuntimeStatus().then(setRuntime)
    void (async () => {
      try {
        const [items, recentRoot] = await Promise.all([
          refreshProjects(),
          window.workbench.getRecentProject()
        ])
        const initial = items.find((item) => item.available && samePath(item.root, recentRoot))
          ?? items.find((item) => item.available)
        if (initial) await acceptProject(await window.workbench.loadProject(initial.root))
      } catch (reason) {
        setError(errorMessage(reason))
      }
    })()
    const removeExit = window.workbench.onSessionExit(({ sessionId, exitCode }) => {
      setActiveSession((current) => current?.id === sessionId ? { ...current, state: 'exited', exitCode } : current)
      setProject((currentProject) => {
        if (currentProject) void refreshSessions(currentProject.root)
        return currentProject
      })
    })
    return removeExit
  }, [acceptProject, refreshProjects, refreshSessions])

  const chooseProject = async (): Promise<void> => {
    setError(null)
    try {
      const next = await window.workbench.chooseProject()
      if (next) {
        await refreshProjects()
        await acceptProject(next)
      }
    } catch (reason) {
      setError(errorMessage(reason))
    }
  }

  const selectProject = async (root: string): Promise<void> => {
    if (!root || samePath(root, project?.root)) return
    setError(null)
    try {
      await acceptProject(await window.workbench.loadProject(root))
    } catch (reason) {
      setError(errorMessage(reason))
      await refreshProjects()
    }
  }

  const removeRegisteredProject = async (root: string, name: string): Promise<void> => {
    const shouldRemove = window.confirm(`从 Workbench 移除“${name}”？\n\n只会移除路径记录，不会删除项目或知识库文件。`)
    if (!shouldRemove) return
    try {
      const removingActive = samePath(root, project?.root)
      const remaining = await window.workbench.removeProject(root)
      setRegisteredProjects(remaining)
      if (removingActive) {
        setProject(null)
        setGit(null)
        setSessions([])
        setActiveSession(null)
        setTerminalHistory('')
        const next = remaining.find((item) => item.available)
        if (next) await acceptProject(await window.workbench.loadProject(next.root))
      }
    } catch (reason) {
      setError(errorMessage(reason))
    }
  }

  const refreshGit = async (): Promise<void> => {
    if (!project) return
    setGit(await window.workbench.getGitStatus(project.root))
  }

  const chooseRuntime = async (): Promise<void> => {
    try {
      const next = await window.workbench.chooseCodeAgentBatch()
      if (next) setRuntime(next)
    } catch (reason) {
      setError(errorMessage(reason))
    }
  }

  const resetRuntime = async (): Promise<void> => {
    try {
      setRuntime(await window.workbench.resetCodeAgentBatch())
    } catch (reason) {
      setError(errorMessage(reason))
    }
  }

  const start = async (review?: { requirement: string; commitId: string }): Promise<void> => {
    if (!project || !selectedSkill) return
    setBusy(true)
    setError(null)
    try {
      const result = await window.workbench.startSession({ projectRoot: project.root, mode, skill: selectedSkill, review })
      setActiveSession(result.session)
      setTerminalHistory(result.history)
      setShowReview(false)
      await refreshSessions(project.root)
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  const handleStart = (): void => {
    if (mode === 'REVIEW') setShowReview(true)
    else void start()
  }

  const stop = async (): Promise<void> => {
    if (!activeSession) return
    await window.workbench.stopSession(activeSession.id)
    setActiveSession({ ...activeSession, state: 'stopped' })
    if (project) await refreshSessions(project.root)
  }

  const switchSession = async (session: SessionSummary): Promise<void> => {
    const history = await window.workbench.getSessionHistory(session.id)
    setMode(session.mode)
    setActiveSession(session)
    setTerminalHistory(history)
  }

  const send = async (): Promise<void> => {
    if (!activeSession || !input.trim() || !activeRunning) return
    const message = input
    setInput('')
    try {
      await window.workbench.send(activeSession.id, `${message}\r`)
    } catch (reason) {
      setError(errorMessage(reason))
    }
  }

  const sessionLabel = useMemo(() => {
    if (!activeSession) return 'NO SESSION'
    return `${activeSession.mode} / ${activeSession.state.toUpperCase()}`
  }, [activeSession])

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">DA</div>
          <div>
            <h1>Domain Agent Workbench</h1>
            <p>LOCAL CODEAGENT CONSOLE</p>
          </div>
        </div>
        <div className="project-picker">
          <div className="project-copy">
            <span>PROJECT</span>
            <select
              aria-label="当前 Project"
              value={project?.root ?? ''}
              onChange={(event) => void selectProject(event.target.value)}
            >
              <option value="">尚未选择 Domain Project</option>
              {registeredProjects.map((item) => (
                <option key={item.root} value={item.root} disabled={!item.available}>
                  {item.name}{item.available ? '' : '（路径不可用）'} — {item.root}
                </option>
              ))}
            </select>
          </div>
          <button className="button secondary add-project" onClick={() => void chooseProject()}>+ Add Project</button>
          <button className="button subtle-danger" disabled={!registeredProjects.length} onClick={() => setShowProjects(true)}>Manage</button>
          <button className="button runtime-button" onClick={() => setShowRuntime(true)}>Runtime</button>
        </div>
      </header>

      {runtime && !runtime.ready && <div className="notice warning"><span>!</span><div><strong>CodeAgent 未就绪</strong><p>{runtime.message}</p></div><button onClick={() => setShowRuntime(true)}>Configure</button></div>}
      {error && <div className="notice error"><span>×</span><div><strong>需要处理</strong><p>{error}</p></div><button onClick={() => setError(null)}>关闭</button></div>}

      <section className="workspace">
        <aside className="sidebar">
          <div className="section-label">WORKFLOW</div>
          <nav className="mode-list" aria-label="工作模式">
            {WORK_MODES.map((item) => {
              const skill = project?.modeSkills[item]
              return (
                <button
                  key={item}
                  className={`mode-item ${mode === item ? 'active' : ''}`}
                  disabled={!skill}
                  onClick={() => setMode(item)}
                >
                  <span className="mode-icon">{item.slice(0, 1)}</span>
                  <span><strong>{item}</strong><small>{skill ? MODE_DESCRIPTIONS[item] : '未发现 Skill'}</small></span>
                </button>
              )
            })}
          </nav>

          <div className="session-heading"><span className="section-label">SESSIONS</span><span>{sessions.length}</span></div>
          <div className="session-list">
            {sessions.length === 0 && <p className="empty-copy">还没有 Session</p>}
            {sessions.map((session) => (
              <button key={session.id} className={`session-item ${activeSession?.id === session.id ? 'active' : ''}`} onClick={() => void switchSession(session)}>
                <span className={`status-dot ${session.state}`} />
                <span><strong>{session.title}</strong><small>{session.skill.name}</small></span>
              </button>
            ))}
          </div>
        </aside>

        <section className="content">
          <div className="control-row">
            <div className="skill-summary">
              <span className="section-label">ACTIVE SKILL</span>
              <strong>{selectedSkill?.name ?? '—'}</strong>
              <code>{selectedSkill?.relativePath ?? '选择包含匹配 Skill 的 Project'}</code>
            </div>
            <div className="session-controls">
              {activeRunning && <button className="button danger" onClick={() => void stop()}>Stop Session</button>}
              <button className="button primary" disabled={!project || !selectedSkill || busy || !runtime?.ready} onClick={handleStart}>
                {busy ? 'Starting…' : mode === 'REVIEW' ? 'Start Review' : mode === 'QA' ? 'Start / Reuse QA' : `Start ${mode}`}
              </button>
            </div>
          </div>

          <div className="terminal-card">
            <div className="terminal-toolbar">
              <div className="traffic-lights"><i /><i /><i /></div>
              <span>CODEAGENT TERMINAL</span>
              <span className={`terminal-state ${activeSession?.state ?? 'idle'}`}>{sessionLabel}</span>
            </div>
            <div className="terminal-host" ref={containerRef} />
            <div className="input-row">
              <textarea
                value={input}
                disabled={!activeRunning}
                placeholder={activeRunning ? '输入消息；Enter 发送，Shift+Enter 换行' : '启动或切换到运行中的 Session 后输入'}
                rows={2}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void send()
                  }
                }}
              />
              <button className="send-button" disabled={!activeRunning || !input.trim()} onClick={() => void send()} aria-label="发送">➜</button>
            </div>
          </div>

          <div className="info-grid">
            <article className="info-card">
              <div><span className="section-label">GIT STATUS</span><button onClick={() => void refreshGit()}>Refresh</button></div>
              <dl>
                <dt>Branch</dt><dd>{git?.branch ?? '—'}</dd>
                <dt>Commit</dt><dd>{git?.commit ?? '—'}</dd>
                <dt>Working Tree</dt><dd className={git?.workingTree}>{git?.workingTree ?? '—'}{git?.changedFiles ? ` · ${git.changedFiles} files` : ''}</dd>
              </dl>
            </article>
            <article className="info-card">
              <div><span className="section-label">PROJECT SKILLS</span><span className="count-badge">{project?.skills.length ?? 0}</span></div>
              <div className="skill-tags">
                {project?.skills.map((skill) => <span key={skill.name}>{skill.name}</span>)}
                {!project?.skills.length && <p className="empty-copy">选择 Project 后自动扫描 .cac/skills</p>}
              </div>
            </article>
          </div>
        </section>
      </section>

      {showReview && <ReviewDialog onCancel={() => setShowReview(false)} onStart={(requirement, commitId) => void start({ requirement, commitId })} />}
      {showProjects && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowProjects(false)}>
          <section className="dialog project-dialog" role="dialog" aria-modal="true" aria-labelledby="projects-title">
            <div className="dialog-heading">
              <div><span className="eyebrow">PLUGGABLE KNOWLEDGE BASES</span><h2 id="projects-title">Manage Projects</h2></div>
              <button className="icon-button" onClick={() => setShowProjects(false)} aria-label="关闭">×</button>
            </div>
            <div className="registered-project-list">
              {registeredProjects.map((item) => (
                <div className={`registered-project ${item.available ? '' : 'unavailable'}`} key={item.root}>
                  <span className={`status-dot ${item.available ? 'running' : 'failed'}`} />
                  <div><strong>{item.name}</strong><code>{item.root}</code>{item.error && <small>{item.error}</small>}</div>
                  <button className="button subtle-danger" onClick={() => void removeRegisteredProject(item.root, item.name)}>Remove</button>
                </div>
              ))}
            </div>
            <div className="dialog-actions">
              <button className="button secondary" onClick={() => void chooseProject()}>+ Add Project</button>
              <button className="button primary" onClick={() => setShowProjects(false)}>Done</button>
            </div>
          </section>
        </div>
      )}
      {showRuntime && runtime && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowRuntime(false)}>
          <section className="dialog runtime-dialog" role="dialog" aria-modal="true" aria-labelledby="runtime-title">
            <div className="dialog-heading">
              <div><span className="eyebrow">CODEAGENT RUNTIME</span><h2 id="runtime-title">Runtime Settings</h2></div>
              <button className="icon-button" onClick={() => setShowRuntime(false)} aria-label="关闭">×</button>
            </div>
            <div className="runtime-path-block">
              <span className="section-label">STARTUP BAT</span>
              <code>{runtime.batchPath}</code>
              <small className={runtime.batchExists ? 'valid' : 'invalid'}>{runtime.batchExists ? 'Found' : 'Not found'}</small>
            </div>
            <div className="runtime-path-block">
              <span className="section-label">NODE RUNTIME (SAME DIRECTORY)</span>
              <code>{runtime.nodePath}</code>
              <small className={runtime.nodeExists ? 'valid' : 'invalid'}>{runtime.nodeExists ? 'Found' : 'Not found'}</small>
            </div>
            {runtime.message && <p className="runtime-message">{runtime.message}</p>}
            <div className="dialog-actions spread">
              <button className="button subtle-danger" onClick={() => void resetRuntime()}>Restore Default</button>
              <div><button className="button secondary" onClick={() => void chooseRuntime()}>Choose BAT…</button><button className="button primary" onClick={() => setShowRuntime(false)}>Done</button></div>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

function errorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message.replace(/^Error invoking remote method '[^']+': Error:\s*/, '')
  return String(reason)
}

function samePath(left: string | null | undefined, right: string | null | undefined): boolean {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase())
}
