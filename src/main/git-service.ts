import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { GitStatus } from '../shared/types'

const execFileAsync = promisify(execFile)

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    windowsHide: true,
    timeout: 10_000,
    encoding: 'utf8'
  })
  return stdout.trim()
}

export async function readGitStatus(cwd: string): Promise<GitStatus> {
  try {
    const inside = await git(cwd, ['rev-parse', '--is-inside-work-tree'])
    if (inside !== 'true') {
      return emptyGitStatus(false, '当前 Project 不是 Git 仓库。')
    }

    const [branchResult, commit, porcelain] = await Promise.all([
      git(cwd, ['branch', '--show-current']),
      git(cwd, ['rev-parse', '--short', 'HEAD']),
      git(cwd, ['status', '--porcelain'])
    ])
    const changedFiles = porcelain ? porcelain.split(/\r?\n/).filter(Boolean).length : 0

    return {
      available: true,
      isRepository: true,
      branch: branchResult || '(detached HEAD)',
      commit,
      workingTree: changedFiles === 0 ? 'clean' : 'dirty',
      changedFiles
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const gitMissing = /ENOENT|not recognized|找不到/i.test(message)
    return {
      ...emptyGitStatus(!gitMissing, gitMissing ? '系统未找到 Git。' : '当前 Project 不是 Git 仓库。'),
      error: message
    }
  }
}

function emptyGitStatus(available: boolean, error: string): GitStatus {
  return {
    available,
    isRepository: false,
    branch: '—',
    commit: '—',
    workingTree: 'unknown',
    changedFiles: 0,
    error
  }
}

