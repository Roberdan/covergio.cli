export interface Plan {
  id: number;
  project_id: string;
  name: string;
  status: 'todo' | 'doing' | 'done' | 'archived';
  tasks_done: number;
  tasks_total: number;
  description: string;
  human_summary: string;
  execution_host: string;
  worktree_path: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  waves?: Wave[];
}

export interface Wave {
  id: number;
  plan_id: number;
  wave_id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'done' | 'blocked';
  tasks_done: number;
  tasks_total: number;
  estimated_hours: number;
  position: number;
  tasks?: Task[];
}

export interface Task {
  id: number;
  wave_id_fk: number;
  task_id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'done' | 'blocked' | 'skipped';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  type: string;
  model: string;
  effort_level: 1 | 2 | 3;
  tokens: number;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  name: string;
  description: string;
  model: string;
  category: string;
  type: 'claude' | 'copilot';
}

export interface GitStatus {
  branch: string;
  sha: string;
  clean: boolean;
  ahead: number;
  behind: number;
  staged: number;
  unstaged: number;
  untracked: number;
  conflicts: number;
  stashes: number;
  commits: string[];
}

export interface TestResult {
  framework: string;
  status: 'pass' | 'fail';
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: string;
  failures: Array<{ test: string; file: string; msg: string }>;
}

export interface Metrics {
  totalPlans: number;
  activePlans: number;
  totalTasks: number;
  doneTasks: number;
  completionRate: number;
  tokenData: TokenData | null;
}

export interface TokenData {
  version: number;
  lastComputedDate: string;
  dailyActivity: DailyActivity[];
}

export interface DailyActivity {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
}

export type Theme = 'light' | 'dark' | 'system';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  timestamp: Date;
}
