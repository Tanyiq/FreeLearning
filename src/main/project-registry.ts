import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { RegisteredProject } from '../shared/types'
import { inspectProject } from './project-service'

interface RegistryData {
  version: 1
  roots: string[]
  activeRoot: string | null
}

function emptyRegistry(): RegistryData {
  return { version: 1, roots: [], activeRoot: null }
}

export class ProjectRegistry {
  constructor(private readonly filePath: string) {}

  async list(): Promise<RegisteredProject[]> {
    const registry = await this.read()
    return Promise.all(registry.roots.map(async (root) => {
      try {
        const project = await inspectProject(root)
        return { root: project.root, name: project.name, available: true }
      } catch (error) {
        return {
          root,
          name: path.basename(root) || root,
          available: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }))
  }

  async add(rootInput: string): Promise<void> {
    const root = path.resolve(rootInput)
    const registry = await this.read()
    const duplicate = registry.roots.some((candidate) => candidate.toLowerCase() === root.toLowerCase())
    if (!duplicate) registry.roots.push(root)
    registry.activeRoot = root
    await this.write(registry)
  }

  async remove(rootInput: string): Promise<void> {
    const root = path.resolve(rootInput)
    const registry = await this.read()
    registry.roots = registry.roots.filter((candidate) => candidate.toLowerCase() !== root.toLowerCase())
    if (registry.activeRoot?.toLowerCase() === root.toLowerCase()) registry.activeRoot = null
    await this.write(registry)
  }

  async setActive(rootInput: string): Promise<void> {
    const root = path.resolve(rootInput)
    const registry = await this.read()
    if (!registry.roots.some((candidate) => candidate.toLowerCase() === root.toLowerCase())) {
      registry.roots.push(root)
    }
    registry.activeRoot = root
    await this.write(registry)
  }

  async getActive(): Promise<string | null> {
    return (await this.read()).activeRoot
  }

  private async read(): Promise<RegistryData> {
    try {
      const value = JSON.parse(await fs.readFile(this.filePath, 'utf8')) as Partial<RegistryData>
      if (value.version !== 1 || !Array.isArray(value.roots)) return emptyRegistry()
      return {
        version: 1,
        roots: value.roots.filter((root): root is string => typeof root === 'string'),
        activeRoot: typeof value.activeRoot === 'string' ? value.activeRoot : null
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOENT' || error instanceof SyntaxError) return emptyRegistry()
      throw error
    }
  }

  private async write(registry: RegistryData): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    await fs.writeFile(this.filePath, JSON.stringify(registry, null, 2), 'utf8')
  }
}
