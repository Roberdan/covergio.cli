import type { LayoutServerLoad } from './$types';
import { queryPlans } from '$server/db';

export const load: LayoutServerLoad = async () => {
  try {
    return { planCount: queryPlans().length };
  } catch {
    return { planCount: 0 };
  }
};
