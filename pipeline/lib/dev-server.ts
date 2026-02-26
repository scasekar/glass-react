import { spawn, ChildProcess } from 'child_process';
import { resolve } from 'path';

let viteProcess: ChildProcess | null = null;
const PROJECT_ROOT = resolve(import.meta.dirname, '../..');

export async function startDevServer(port: number): Promise<string> {
  const url = `http://localhost:${port}`;

  // Check if already running
  try {
    const res = await fetch(url);
    if (res.ok) {
      console.log(`  Dev server already running at ${url}`);
      return url;
    }
  } catch { /* not running */ }

  console.log(`  Starting Vite dev server on port ${port}...`);
  viteProcess = spawn('npx', ['vite', '--config', 'vite.demo.config.ts', '--port', String(port)], {
    cwd: PROJECT_ROOT,
    stdio: 'pipe',
    env: { ...process.env },
  });

  // Wait for "Local:" in stdout indicating server is ready
  await new Promise<void>((resolvePromise, reject) => {
    const timeout = setTimeout(() => reject(new Error('Vite dev server start timeout (30s)')), 30000);
    viteProcess!.stdout?.on('data', (data: Buffer) => {
      if (data.toString().includes('Local:')) {
        clearTimeout(timeout);
        resolvePromise();
      }
    });
    viteProcess!.stderr?.on('data', (data: Buffer) => {
      // Log stderr for debugging but don't fail on it
      const msg = data.toString().trim();
      if (msg) console.log(`  [vite stderr] ${msg}`);
    });
    viteProcess!.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    viteProcess!.on('exit', (code) => {
      if (code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`Vite exited with code ${code}`));
      }
    });
  });

  console.log(`  Dev server ready at ${url}`);
  return url;
}

export function stopDevServer(): void {
  if (viteProcess) {
    console.log('  Stopping dev server...');
    viteProcess.kill('SIGTERM');
    viteProcess = null;
  }
}
