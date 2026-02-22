import type { PageServerLoad } from './$types';
import { queryPlan } from '$server/db';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
  const plan = queryPlan(Number(params.id));
  if (!plan) throw error(404, 'Plan not found');
  return { plan };
};
