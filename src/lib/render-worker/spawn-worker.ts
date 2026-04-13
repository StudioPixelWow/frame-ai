/**
 * PixelFrameAI — Worker Spawner
 * Spawns the render worker as a child process from the Next.js server.
 * Called from the render API when needed.
 */
import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";

let workerProcess: ChildProcess | null = null;
let workerStartedAt: Date | null = null;

const LOG_DIR = path.join(process.cwd(), ".frameai/logs");

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

/** Check if the worker is alive */
export function isWorkerRunning(): boolean {
  if (!workerProcess) return false;
  try {
    // Sends signal 0 to check if process exists
    process.kill(workerProcess.pid!, 0);
    return true;
  } catch {
    workerProcess = null;
    return false;
  }
}

/** Start the render worker if not already running */
export function ensureWorkerRunning(): { pid: number | null; started: boolean } {
  if (isWorkerRunning()) {
    return { pid: workerProcess!.pid ?? null, started: false };
  }

  ensureLogDir();
  const logFile = path.join(LOG_DIR, `render-worker-${Date.now()}.log`);
  const logStream = fs.createWriteStream(logFile, { flags: "a" });

  console.log("[Spawner] Starting render worker...");

  workerProcess = spawn("npx", ["tsx", path.join(process.cwd(), "src/lib/render-worker/worker.ts")], {
    cwd: process.cwd(),
    stdio: ["ignore", logStream, logStream],
    detached: true,
    env: { ...process.env, NODE_ENV: "production" },
  });

  workerProcess.unref();
  workerStartedAt = new Date();

  const pid = workerProcess.pid ?? null;
  console.log(`[Spawner] Worker started with PID: ${pid}, log: ${logFile}`);

  workerProcess.on("exit", (code) => {
    console.log(`[Spawner] Worker exited with code: ${code}`);
    workerProcess = null;
  });

  return { pid, started: true };
}

/** Get worker status info */
export function getWorkerStatus(): {
  running: boolean;
  pid: number | null;
  startedAt: string | null;
} {
  return {
    running: isWorkerRunning(),
    pid: workerProcess?.pid ?? null,
    startedAt: workerStartedAt?.toISOString() ?? null,
  };
}
