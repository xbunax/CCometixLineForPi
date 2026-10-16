import { spawn } from "node:child_process";

/** Bounded subprocess; argv avoids shell interpolation of paths and theme names. */
export function renderStatusline(binary: string, args: string[], payload: unknown, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["pipe", "pipe", "pipe"], signal, windowsHide: true });
    let output = "";
    let error = "";
    let failure: Error | undefined;
    const timer = setTimeout(() => { failure = new Error("Renderer timed out"); child.kill(); }, 2500);
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      output += chunk;
      if (output.length > 65536) { failure = new Error("Renderer output too large"); child.kill(); }
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => { error = (error + chunk).slice(-2048); });
    child.stdin.on("error", () => {}); // Early process exit is handled by close/error.
    child.on("error", (err) => { clearTimeout(timer); reject(err); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (failure) reject(failure);
      else if (code !== 0) reject(new Error(error || `Renderer exited with ${code}`));
      else resolve(output.trimEnd());
    });
    child.stdin.end(JSON.stringify(payload));
  });
}
