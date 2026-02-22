// @ts-nocheck
import type { LayoutServerLoad } from './$types';
import { queryPlans } from '$server/db';

export const load = async () => {
  try {
    return { planCount: queryPlans().length };
  } catch {
    return { planCount: 0 };
  }
};
;null as any as LayoutServerLoad;