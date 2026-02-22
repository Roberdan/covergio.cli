import { execSync } from 'child_process';
import { join } from 'path';

const DB_PATH = join(process.env.HOME || '~', '.claude', 'data', 'dashboard.db');
const SCRIPTS_DIR = join(process.env.HOME || '~', '.claude', 'scripts');

function sqliteQuery<T = Record<string, unknown>>(sql: string): T[] {
  try {
    const output = execSync(`sqlite3 -json "${DB_PATH}" "${sql.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
      timeout: 5000
    }).trim();
    if (!output) return [];
    return JSON.parse(output) as T[];
  } catch {
    return [];
  }
}

function planDbCmd<T = unknown>(args: string): T | null {
  try {
    const output = execSync(`${join(SCRIPTS_DIR, 'plan-db.sh')} ${args}`, {
      encoding: 'utf-8',
      timeout: 10000,
      env: { ...process.env, PATH: `${SCRIPTS_DIR}:${process.env.PATH}` }
    }).trim();
    return JSON.parse(output) as T;
  } catch {
    return null;
  }
}

export function queryPlans(projectId?: string) {
  const where = projectId ? `WHERE project_id = '${projectId}'` : '';
  return sqliteQuery(`SELECT * FROM plans ${where} ORDER BY id DESC`);
}

export function queryPlan(planId: number) {
  return planDbCmd(`json ${planId}`);
}

export function queryKanban() {
  return planDbCmd('kanban-json') ?? [];
}

export function queryMetrics() {
  const plans = sqliteQuery<{ count: number }>('SELECT COUNT(*) as count FROM plans');
  const active = sqliteQuery<{ count: number }>("SELECT COUNT(*) as count FROM plans WHERE status = 'doing'");
  const tasks = sqliteQuery<{ count: number }>('SELECT COUNT(*) as count FROM tasks');
  const done = sqliteQuery<{ count: number }>("SELECT COUNT(*) as count FROM tasks WHERE status = 'done'");

  const totalPlans = plans[0]?.count ?? 0;
  const activePlans = active[0]?.count ?? 0;
  const totalTasks = tasks[0]?.count ?? 0;
  const doneTasks = done[0]?.count ?? 0;

  return {
    totalPlans,
    activePlans,
    totalTasks,
    doneTasks,
    completionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
  };
}
