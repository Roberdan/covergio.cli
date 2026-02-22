import type { PageServerLoad } from './$types';
import { queryPlans } from '$server/db';

export const load: PageServerLoad = async () => {
  try {
    return { plans: queryPlans() };
  } catch {
    return { plans: [] };
  }
};
