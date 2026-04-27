import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import "@xterm/xterm/css/xterm.css";
import { useAgentStore } from "../../stores/agent.store";

interface PtyTerminalProps {
  sessionId: string | null;
  className?: string;
}

export function PtyTerminal({ sessionId, className }: PtyTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  // Tracks which sessionId has already been spawned to prevent double-spawn
  // when a re-render fires mid-async.
  const processedSpawnRef = useRef<string | null>(null);

  const pendingPtySpawn = useAgentStore((s) => s.pendingPtySpawn);

  const initTerminal = useCallback(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: {
        background: "#0a0a0a",
        foreground: "#e4e4e4",
        cursor: "#e4e4e4",
        selectionBackground: "#3a3a3a",
        black: "#000000",
        red: "#cc0000",
        green: "#4e9a06",
        yellow: "#c4a000",
        blue: "#3465a4",
        magenta: "#75507b",
        cyan: "#06989a",
        white: "#d3d7cf",
        brightBlack: "#555753",
        brightRed: "#ef2929",
        brightGreen: "#8ae234",
        brightYellow: "#fce94f",
        brightBlue: "#729fcf",
        brightMagenta: "#ad7fa8",
        brightCyan: "#34e2e2",
        brightWhite: "#eeeeec",
      },
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", monospace',
      fontSize: 13,
      lineHeight: 1.3,
      cursorBlink: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    return { term, fitAddon };
  }, []);

  // Initialize terminal on mount
  useEffect(() => {
    const result = initTerminal();
    if (!result) return;

    return () => {
      result.term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [initTerminal]);

  // When sessionId changes: clear terminal, show indicator, wire keystrokes
  useEffect(() => {
    if (!sessionId) {
      if (termRef.current) {
        termRef.current.clear();
        termRef.current.write("\r\n\x1b[2m(no active session)\x1b[0m\r\n");
      }
      return;
    }

    let term = termRef.current;
    let fitAddon = fitAddonRef.current;

    if (!term || !fitAddon) {
      const result = initTerminal();
      if (!result) return;
      term = result.term;
      fitAddon = result.fitAddon;
    }

    term.clear();
    term.write(`\x1b[2m(session: ${sessionId})\x1b[0m\r\n`);

    // Forward keystrokes to PTY
    const dataDisposable = term.onData((data) => {
      invoke("write_pty", { sessionId, data }).catch(console.error);
    });

    return () => {
      dataDisposable.dispose();
    };
  }, [sessionId, initTerminal]);

  // Handle pending spawn: register listeners FIRST, then spawn PTY.
  //
  // IMPORTANT: We do NOT call setPendingPtySpawn(null) from inside this effect.
  // Doing so causes React to re-render, which runs this effect's cleanup
  // (setting mounted=false) before the awaited listen() calls resolve,
  // killing the spawn. We use processedSpawnRef instead to prevent re-processing.
  useEffect(() => {
    if (!pendingPtySpawn || pendingPtySpawn.sessionId !== sessionId) return;
    if (processedSpawnRef.current === pendingPtySpawn.sessionId) return;

    const term = termRef.current;
    if (!term) return;

    processedSpawnRef.current = pendingPtySpawn.sessionId;
    const spawn = { ...pendingPtySpawn };

    let mounted = true;
    const unlistens: (() => void)[] = [];

    (async () => {
      // 1. Register output + exit listeners BEFORE spawning
      const unlistenOutput = await listen<string>(
        `pty:output:${spawn.sessionId}`,
        (event) => {
          termRef.current?.write(event.payload);
        },
      );
      const unlistenExit = await listen<number>(
        `pty:exit:${spawn.sessionId}`,
        (event) => {
          termRef.current?.write(
            `\r\n\x1b[2m(process exited with code ${event.payload})\x1b[0m\r\n`,
          );
        },
      );
      unlistens.push(unlistenOutput, unlistenExit);

      if (!mounted) {
        unlistens.forEach((f) => f());
        return;
      }

      // 2. Now spawn the PTY
      try {
        await invoke("spawn_pty", {
          sessionId: spawn.sessionId,
          command: spawn.command,
          args: spawn.args,
          cwd: spawn.cwd,
          envVars: spawn.envVars,
          cols: spawn.cols,
          rows: spawn.rows,
        });
      } catch (err) {
        termRef.current?.write(
          `\r\n\x1b[31mFailed to spawn PTY: ${err}\x1b[0m\r\n`,
        );
      }
    })();

    return () => {
      mounted = false;
      processedSpawnRef.current = null;
      unlistens.forEach((f) => f());
    };
  }, [pendingPtySpawn, sessionId]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (fitAddonRef.current && termRef.current) {
        try {
          fitAddonRef.current.fit();
          const dims = fitAddonRef.current.proposeDimensions();
          if (dims && sessionId) {
            invoke("resize_pty", {
              sessionId,
              cols: dims.cols,
              rows: dims.rows,
            }).catch(console.error);
          }
        } catch {
          // ignore resize errors
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [sessionId]);

  if (!sessionId) {
    return (
      <div
        className={`flex items-center justify-center text-sm text-neutral-500 ${className ?? ""}`}
      >
        No active terminal session
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`w-full h-full overflow-hidden bg-[#0a0a0a] ${className ?? ""}`}
    />
  );
}
