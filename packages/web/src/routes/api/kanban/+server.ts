import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { queryKanban } from '$server/db';

export const GET: RequestHandler = async () => {
  return json(queryKanban());
};
