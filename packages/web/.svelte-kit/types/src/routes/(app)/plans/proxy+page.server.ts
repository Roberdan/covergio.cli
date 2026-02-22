// @ts-nocheck
import type { PageServerLoad } from './$types';
import { queryKanban, queryPlans } from '$server/db';

export const load = async () => {
  try {
    const plans = queryPlans();
    return {
      plans,
      kanban: queryKanban(),
      planCount: plans.length
    };
  } catch {
    return { plans: [], kanban: [], planCount: 0 };
  }
};
;null as any as PageServerLoad;