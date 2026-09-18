import { promises as fs } from 'node:fs'
import path from 'node:path'
import { DEFAULT_CODEAGENT_BATCH } from './runtime-service'

interface RuntimeSettingsData {
  version: 1
  codeAgentBatchPath: string
}

export class RuntimeSettings {
  constructor(private readonly filePath: string) {}

  async getCodeAgentBatchPath(): Promise<string> {
    try {
      const value = JSON.parse(await fs.readFile(this.filePath, 'utf8')) as Partial<RuntimeSettingsData>
      return typeof value.codeAgentBatchPath === 'string' && value.codeAgentBatchPath.trim()
        ? path.resolve(value.codeAgentBatchPath)
        : DEFAULT_CODEAGENT_BATCH
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOENT' || error instanceof SyntaxError) return DEFAULT_CODEAGENT_BATCH
      throw error
    }
  }

  async setCodeAgentBatchPath(batchPath: string): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    const value: RuntimeSettingsData = {
      version: 1,
      codeAgentBatchPath: path.resolve(batchPath)
    }
    await fs.writeFile(this.filePath, JSON.stringify(value, null, 2), 'utf8')
  }

  async resetCodeAgentBatchPath(): Promise<void> {
    await this.setCodeAgentBatchPath(DEFAULT_CODEAGENT_BATCH)
  }
}
