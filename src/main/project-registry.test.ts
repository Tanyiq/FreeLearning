import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ProjectRegistry } from './project-registry'

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('ProjectRegistry', () => {
  it('persists added projects and the active project without copying content', async () => {
    const fixture = await createFixture()
    const projectRoot = await createProject(fixture, 'domain-a')
    const registryPath = path.join(fixture, 'settings', 'projects.json')

    await new ProjectRegistry(registryPath).add(projectRoot)
    const reloaded = new ProjectRegistry(registryPath)

    expect(await reloaded.getActive()).toBe(projectRoot)
    expect(await reloaded.list()).toEqual([
      { root: projectRoot, name: 'domain-a', available: true }
    ])
  })

  it('removes only the registration and leaves the project on disk', async () => {
    const fixture = await createFixture()
    const projectRoot = await createProject(fixture, 'domain-b')
    const registry = new ProjectRegistry(path.join(fixture, 'settings', 'projects.json'))
    await registry.add(projectRoot)

    await registry.remove(projectRoot)

    expect(await registry.list()).toEqual([])
    expect(await registry.getActive()).toBeNull()
    expect((await fs.stat(projectRoot)).isDirectory()).toBe(true)
  })
})

async function createFixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-registry-'))
  temporaryRoots.push(root)
  return root
}

async function createProject(parent: string, name: string): Promise<string> {
  const root = path.join(parent, name)
  const skillDirectory = path.join(root, '.cac', 'skills', `${name}-qa`)
  await fs.mkdir(skillDirectory, { recursive: true })
  await fs.writeFile(path.join(skillDirectory, 'SKILL.md'), '# QA\n', 'utf8')
  return root
}
