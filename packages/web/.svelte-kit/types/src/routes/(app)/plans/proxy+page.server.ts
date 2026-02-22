// @ts-nocheck
import type { PageServerLoad } from './$types';
import { queryPlans } from '$server/db';

export const load = async () => {
  try {
    return { plans: queryPlans() };
  } catch {
    return { plans: [] };
  }
};
;null as any as PageServerLoad;