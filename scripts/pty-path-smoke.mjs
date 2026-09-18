import path from 'node:path'
import process from 'node:process'
import * as pty from 'node-pty'

const batchPath = path.resolve(process.argv[2] ?? '')
let output = ''
const commandLine = `/d /q /s /c ""${batchPath}""`
const terminal = pty.spawn('cmd.exe', commandLine, {
  name: 'xterm-256color',
  cols: 80,
  rows: 24,
  cwd: path.dirname(batchPath),
  env: process.env,
  useConpty: true
})

terminal.onData((data) => {
  output += data
  process.stdout.write(data)
})

terminal.onExit(({ exitCode }) => {
  process.exitCode = exitCode === 0 && output.includes('PTY_QUOTE_OK') ? 0 : 1
})
