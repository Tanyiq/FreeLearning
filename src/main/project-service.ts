import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { ProjectInfo, SkillInfo, WorkMode } from '../shared/types'

export function detectMode(skillName: string): WorkMode | null {
  const name = skillName.toLowerCase()
  if (name.endsWith('-knowledge-refresh')) return 'REFRESH'
  if (name.endsWith('-review')) return 'REVIEW'
  if (name.endsWith('-dev')) return 'DEV'
  if (name.endsWith('-qa')) return 'QA'
  return null
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
