import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { useEffect, useRef } from 'react'

interface TerminalOptions {
  sessionId: string | null
  history: string
}

export function useTerminal({ sessionId, history }: TerminalOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const activeIdRef = useRef<string | null>(sessionId)

  useEffect(() => {
    activeIdRef.current = sessionId
  }, [sessionId])

  useEffect(() => {
    if (!containerRef.current) return
    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: 'Cascadia Code, JetBrains Mono, Consolas, monospace',
      fontSize: 14,
      lineHeight: 1.32,
      scrollback: 10_000,
      theme: {
        background: '#0a0d12',
        foreground: '#d9e1ea',
        cursor: '#5ee1ae',
        selectionBackground: '#315246',
        black: '#151a21',
        brightBlack: '#65717f',
        green: '#5ee1ae',
        brightGreen: '#7bf5c2',
        cyan: '#69c5dc',
        brightCyan: '#8bdcf0',
        yellow: '#e5c07b',
        red: '#ef7b87'
      }
    })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    terminal.open(containerRef.current)
    terminalRef.current = terminal

    const fitAndResize = (): void => {
      try {
        fit.fit()
        const id = activeIdRef.current
        if (id) void window.workbench.resize(id, terminal.cols, terminal.rows)
      } catch {
        // The terminal can be between mount and layout during a window resize.
      }
    }
    const resizeObserver = new ResizeObserver(fitAndResize)
    resizeObserver.observe(containerRef.current)
    const inputSubscription = terminal.onData((data) => {
      const id = activeIdRef.current
      if (id) void window.workbench.send(id, data)
    })
    const removeOutput = window.workbench.onSessionOutput(({ sessionId: outputId, data }) => {
      if (outputId === activeIdRef.current) terminal.write(data)
    })
    queueMicrotask(fitAndResize)

    return () => {
      removeOutput()
      resizeObserver.disconnect()
      inputSubscription.dispose()
      terminal.dispose()
      terminalRef.current = null
    }
  }, [])

  useEffect(() => {
    const terminal = terminalRef.current
    if (!terminal) return
    terminal.reset()
    if (history) terminal.write(history)
    if (!sessionId) terminal.writeln('\x1b[38;2;101;113;127m选择 Project 和工作模式，然后启动 Session。\x1b[0m')
    terminal.focus()
  }, [sessionId, history])

  return { containerRef, terminal: terminalRef }
}

