import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { ProjectInfo, SkillInfo, WorkMode } from '../shared/types'

const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i

export function detectMode(skillName: string): WorkMode | null {
  const name = skillName.toLowerCase()
  if (name.endsWith('-knowledge-refresh')) return 'REFRESH'
  if (name.endsWith('-review')) return 'REVIEW'
  if (name.endsWith('-dev')) return 'DEV'
  if (name.endsWith('-qa')) return 'QA'
  return null
}

export function validateProjectName(input: string): string {
  const name = input.trim()
  if (!name) throw new Error('请输入项目名。')
  if (name === '.' || name === '..') throw new Error('项目名不能是 . 或 ..。')
  if (/[<>:"/\\|?*]/.test(name)) throw new Error('项目名包含 Windows 不允许的字符：< > : " / \\ | ? *')
  if (/[. ]$/.test(name)) throw new Error('项目名不能以句点或空格结尾。')
  if (WINDOWS_RESERVED_NAME.test(name)) throw new Error(`“${name}”是 Windows 保留名称，请换一个项目名。`)
  if (name.length > 120) throw new Error('项目名不能超过 120 个字符。')
  return name
}

export async function createDomainProject(baseDirectoryInput: string, projectNameInput: string): Promise<ProjectInfo> {
  const baseDirectory = path.resolve(baseDirectoryInput)
  const baseStat = await fs.stat(baseDirectory).catch(() => null)
  if (!baseStat?.isDirectory()) throw new Error('Base 目录不存在或不是文件夹。')

  const projectName = validateProjectName(projectNameInput)
  const root = path.join(baseDirectory, projectName)
  try {
    await fs.mkdir(root)
  } catch (reason) {
    if ((reason as NodeJS.ErrnoException).code === 'EEXIST') throw new Error(`目标路径已存在：${root}`)
    throw reason
  }
  await fs.mkdir(path.join(root, '.cac', 'skills'), { recursive: true })
  await fs.writeFile(
    path.join(root, '.cac', 'settings.json'),
    `${JSON.stringify({ permissions: { defaultMode: 'bypassPermissions' } }, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' }
  )

  return inspectProject(root)
}

export async function inspectProject(rootInput: string): Promise<ProjectInfo> {
  const root = path.resolve(rootInput)
  const projectStat = await fs.stat(root).catch(() => null)
  if (!projectStat?.isDirectory()) {
    throw new Error('所选路径不是有效的 Project 目录。')
  }

  const cacPath = path.join(root, '.cac')
  const skillsPath = path.join(cacPath, 'skills')
  const warnings: string[] = []

  const cacStat = await fs.stat(cacPath).catch(() => null)
  if (!cacStat?.isDirectory()) {
    throw new Error('Project 中未找到 .cac 目录。')
  }

  const skillsStat = await fs.stat(skillsPath).catch(() => null)
  if (!skillsStat?.isDirectory()) {
    throw new Error('Project 中未找到 .cac/skills 目录。')
  }

  const entries = await fs.readdir(skillsPath, { withFileTypes: true })
  const skills: SkillInfo[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const skillFile = path.join(skillsPath, entry.name, 'SKILL.md')
    const skillStat = await fs.stat(skillFile).catch(() => null)
    if (!skillStat?.isFile()) continue
    skills.push({
      name: entry.name,
      relativePath: path.join('.cac', 'skills', entry.name, 'SKILL.md').split(path.sep).join('/'),
      mode: detectMode(entry.name)
    })
  }

  skills.sort((a, b) => a.name.localeCompare(b.name))
  if (skills.length === 0) warnings.push('当前目录未发现可用 Skill。')

  const modeSkills: Partial<Record<WorkMode, SkillInfo>> = {}
  for (const skill of skills) {
    if (skill.mode && !modeSkills[skill.mode]) modeSkills[skill.mode] = skill
  }

  return {
    root,
    name: path.basename(root),
    skills,
    modeSkills,
    warnings
  }
}
