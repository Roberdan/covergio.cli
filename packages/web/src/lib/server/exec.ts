import { execSync } from 'child_process';
import { join } from 'path';

const SCRIPTS_DIR = join(process.env.HOME || '~', '.claude', 'scripts');
const DEFAULT_TIMEOUT = 10000;

interface ExecResult<T = unknown> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export function execScript<T = unknown>(
  script: string,
  args: string[] = [],
  timeout = DEFAULT_TIMEOUT
): ExecResult<T> {
  try {
    const cmd = join(SCRIPTS_DIR, script);
    const fullCmd = [cmd, ...args].join(' ');
    const output = execSync(fullCmd, {
      timeout,
      encoding: 'utf-8',
      env: { ...process.env, PATH: `${SCRIPTS_DIR}:${process.env.PATH}` }
    });
    const data = JSON.parse(output.trim()) as T;
    return { success: true, data, error: null };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, data: null, error };
  }
}

export function execCommand(cmd: string, timeout = DEFAULT_TIMEOUT): string {
  try {
    return execSync(cmd, { timeout, encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}
