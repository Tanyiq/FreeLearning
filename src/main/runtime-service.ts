import { existsSync } from 'node:fs'
import path from 'node:path'
import type { RuntimeStatus } from '../shared/types'

export const DEFAULT_CODEAGENT_BATCH = 'D:\\codeagentCli\\codeagent.bat'

export function getRuntimeStatus(batchPathInput = DEFAULT_CODEAGENT_BATCH): RuntimeStatus {
  const batchPath = path.resolve(batchPathInput)
  const nodePath = path.join(path.dirname(batchPath), 'codeagent-node.exe')
  const batchExists = existsSync(batchPath)
  const nodeExists = existsSync(nodePath)
  let message: string | undefined

  if (!batchExists) {
    message = `未找到 ${batchPath}，请检查或重新配置 CodeAgent BAT 路径。`
  } else if (!nodeExists) {
    message = 'CodeAgent 可能尚未完成首次初始化，请先在 Windows Terminal 中手动运行一次 codeagent。'
  }

  return {
    batchPath,
    nodePath,
    batchExists,
    nodeExists,
    ready: batchExists && nodeExists,
    message
  }
}
