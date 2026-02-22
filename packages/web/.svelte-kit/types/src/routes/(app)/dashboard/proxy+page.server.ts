// @ts-nocheck
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { PageServerLoad } from './$types';
import { queryPlans, queryMetrics } from '$server/db';

const statsPath = join(process.env.HOME || '~', '.claude', 'stats-cache.json');

function readTokenData() {
  if (!existsSync(statsPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(statsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export const load = async () => {
  try {
    const plans = queryPlans();
    const metrics = {
      ...queryMetrics(),
      tokenData: readTokenData()
    };
    return { plans, metrics };
  } catch {
    return {
      plans: [],
      metrics: {
        totalPlans: 0,
        activePlans: 0,
        totalTasks: 0,
        doneTasks: 0,
        completionRate: 0,
        tokenData: null
      }
    };
  }
};
;null as any as PageServerLoad;