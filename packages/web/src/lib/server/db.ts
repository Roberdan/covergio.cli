import Database from 'better-sqlite3';
import { join } from 'path';

const DB_PATH = join(process.env.HOME || '~', '.claude', 'data', 'dashboard.db');

type WaveWithTasks = {
  id: number;
  tasks?: unknown[];
} & Record<string, unknown>;

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH, { readonly: true });
    db.pragma('journal_mode = WAL');
  }
  return db;
}

export function queryPlans(projectId?: string) {
  const database = getDb();
  if (projectId) {
    return database.prepare('SELECT * FROM plans WHERE project_id = ? ORDER BY id DESC').all(projectId);
  }
  return database.prepare('SELECT * FROM plans ORDER BY id DESC').all();
}

export function queryPlan(planId: number) {
  const database = getDb();
  const plan = database.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
  if (!plan) return null;

  const waves = database.prepare('SELECT * FROM waves WHERE plan_id = ? ORDER BY position').all(planId) as WaveWithTasks[];
  for (const wave of waves) {
    wave.tasks = database.prepare('SELECT * FROM tasks WHERE wave_id_fk = ? ORDER BY id').all(wave.id);
  }

  return { ...(plan as Record<string, unknown>), waves };
}

export function queryKanban() {
  const database = getDb();
  return database
    .prepare(`
      SELECT p.*, p.project_id as project_name,
            (SELECT COUNT(*) FROM tasks t JOIN waves w ON t.wave_id_fk = w.id WHERE w.plan_id = p.id AND t.status = 'in_progress') as active_tasks
      FROM plans p
      ORDER BY
        CASE p.status WHEN 'doing' THEN 0 WHEN 'todo' THEN 1 WHEN 'done' THEN 2 ELSE 3 END,
        p.id DESC
    `)
    .all();
}

export function queryMetrics() {
  const database = getDb();
  const totalPlans = database.prepare('SELECT COUNT(*) as count FROM plans').get() as { count: number };
  const activePlans = database
    .prepare("SELECT COUNT(*) as count FROM plans WHERE status = 'doing'")
    .get() as { count: number };
  const totalTasks = database.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
  const doneTasks = database
    .prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'done'")
    .get() as { count: number };

  return {
    totalPlans: totalPlans.count,
    activePlans: activePlans.count,
    totalTasks: totalTasks.count,
    doneTasks: doneTasks.count,
    completionRate:
      totalTasks.count > 0 ? Math.round((doneTasks.count / totalTasks.count) * 100) : 0
  };
}
