import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { queryPlans } from '$server/db';

export const GET: RequestHandler = async ({ url }) => {
  const projectId = url.searchParams.get('project') || undefined;
  const plans = queryPlans(projectId);
  return json(plans);
};
