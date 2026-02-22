import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { queryPlan } from '$server/db';

export const GET: RequestHandler = async ({ params }) => {
  const plan = queryPlan(Number(params.id));
  if (!plan) throw error(404, 'Plan not found');
  return json(plan);
};
