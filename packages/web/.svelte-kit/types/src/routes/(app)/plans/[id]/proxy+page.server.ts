// @ts-nocheck
import type { PageServerLoad } from './$types';
import { queryPlan } from '$server/db';
import { error } from '@sveltejs/kit';

export const load = async ({ params }: Parameters<PageServerLoad>[0]) => {
  const plan = queryPlan(Number(params.id));
  if (!plan) throw error(404, 'Plan not found');
  return { plan };
};
