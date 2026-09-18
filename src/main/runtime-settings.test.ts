import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_CODEAGENT_BATCH, getRuntimeStatus } from './runtime-service'
import { RuntimeSettings } from './runtime-settings'

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('RuntimeSettings', () => {
  it('uses the required CodeAgent path by default', async () => {
    const root = await createFixture()
    const settings = new RuntimeSettings(path.join(root, 'settings.json'))
    expect(await settings.getCodeAgentBatchPath()).toBe(DEFAULT_CODEAGENT_BATCH)
  })

  it('persists a custom batch path and derives codeagent-node.exe beside it', async () => {
    const root = await createFixture()
    const batchPath = path.join(root, 'custom-codeagent.bat')
    await fs.writeFile(batchPath, '@echo off\n', 'utf8')
    await fs.writeFile(path.join(root, 'codeagent-node.exe'), '', 'utf8')
    const settingsPath = path.join(root, 'settings', 'settings.json')

    await new RuntimeSettings(settingsPath).setCodeAgentBatchPath(batchPath)
    const persistedPath = await new RuntimeSettings(settingsPath).getCodeAgentBatchPath()
    const status = getRuntimeStatus(persistedPath)

    expect(persistedPath).toBe(batchPath)
    expect(status.ready).toBe(true)
    expect(status.nodePath).toBe(path.join(root, 'codeagent-node.exe'))
  })
})

async function createFixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-runtime-'))
  temporaryRoots.push(root)
  return root
}
