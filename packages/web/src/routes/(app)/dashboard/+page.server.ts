import type { PageServerLoad } from './$types';
import { queryPlans, queryMetrics } from '$server/db';

export const load: PageServerLoad = async () => {
  try {
    const plans = queryPlans();
    const metrics = queryMetrics();
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
      },
    };
  }
};
