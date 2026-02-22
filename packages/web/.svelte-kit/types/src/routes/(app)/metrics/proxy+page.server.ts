// @ts-nocheck
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { PageServerLoad } from './$types';
import { queryMetrics } from '$server/db';

const fallbackMetrics = {
  totalPlans: 0,
  activePlans: 0,
  totalTasks: 0,
  doneTasks: 0,
  completionRate: 0
};

function readStatsCache() {
  const statsPath = join(process.env.HOME || '', '.claude', 'stats-cache.json');

  if (!existsSync(statsPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(statsPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const load = async () => {
  let metrics = fallbackMetrics;

  try {
    metrics = queryMetrics();
  } catch {
    metrics = fallbackMetrics;
  }

  return {
    metrics,
    statsCache: readStatsCache()
  };
};
;null as any as PageServerLoad;