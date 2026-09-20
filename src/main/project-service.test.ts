import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createDomainProject, detectMode, inspectProject, validateProjectName } from './project-service'

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('detectMode', () => {
  it.each([
    ['topo-qa', 'QA'],
    ['billing-dev', 'DEV'],
    ['security-review', 'REVIEW'],
    ['docs-knowledge-refresh', 'REFRESH'],
    ['MY-DOMAIN-QA', 'QA']
  ])('maps %s to %s', (skillName, expected) => {
    expect(detectMode(skillName)).toBe(expected)
  })

  it('ignores unrelated skill names', () => {
    expect(detectMode('topo-writer')).toBeNull()
    expect(detectMode('qa')).toBeNull()
  })
})

describe('inspectProject', () => {
  it('discovers domain-independent skills and normalizes relative paths', async () => {
    const root = await createProject(['finance-qa', 'finance-dev', 'finance-knowledge-refresh', 'notes'])
    const project = await inspectProject(root)

    expect(project.skills).toHaveLength(4)
    expect(project.modeSkills.QA?.name).toBe('finance-qa')
    expect(project.modeSkills.DEV?.relativePath).toBe('.cac/skills/finance-dev/SKILL.md')
    expect(project.modeSkills.REFRESH?.name).toBe('finance-knowledge-refresh')
    expect(project.modeSkills.REVIEW).toBeUndefined()
  })

  it('returns the required warning when no SKILL.md exists', async () => {
    const root = await createProject([])
    const project = await inspectProject(root)
    expect(project.warnings).toEqual(['当前目录未发现可用 Skill。'])
  })
})

describe('createDomainProject', () => {
  it('creates an empty skills directory and the default permissions settings', async () => {
    const baseDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'domain-workbench-base-'))
    temporaryRoots.push(baseDirectory)

    const project = await createDomainProject(baseDirectory, 'topo')
    const settings = JSON.parse(await fs.readFile(path.join(project.root, '.cac', 'settings.json'), 'utf8'))

    expect(project.root).toBe(path.join(baseDirectory, 'topo'))
    expect((await fs.stat(path.join(project.root, '.cac', 'skills'))).isDirectory()).toBe(true)
    expect(settings).toEqual({ permissions: { defaultMode: 'bypassPermissions' } })
    expect(project.warnings).toEqual(['当前目录未发现可用 Skill。'])
  })

  it('does not overwrite an existing project directory', async () => {
    const baseDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'domain-workbench-base-'))
    temporaryRoots.push(baseDirectory)
    await fs.mkdir(path.join(baseDirectory, 'existing'))

    await expect(createDomainProject(baseDirectory, 'existing')).rejects.toThrow('目标路径已存在')
  })
})

describe('validateProjectName', () => {
  it('rejects Windows reserved names and invalid path characters', () => {
    expect(() => validateProjectName('CON')).toThrow('Windows 保留名称')
    expect(() => validateProjectName('COM1.txt')).toThrow('Windows 保留名称')
    expect(() => validateProjectName('bad/name')).toThrow('Windows 不允许的字符')
    expect(() => validateProjectName('trailing.')).toThrow('句点或空格结尾')
  })

  it('trims and accepts a normal project name', () => {
    expect(validateProjectName('  topology  ')).toBe('topology')
  })
})

async function createProject(skills: string[]): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'domain-workbench-'))
  temporaryRoots.push(root)
  const skillsRoot = path.join(root, '.cac', 'skills')
  await fs.mkdir(skillsRoot, { recursive: true })
  for (const skill of skills) {
    const directory = path.join(skillsRoot, skill)
    await fs.mkdir(directory)
    await fs.writeFile(path.join(directory, 'SKILL.md'), `# ${skill}\n`, 'utf8')
  }
  return root
}
