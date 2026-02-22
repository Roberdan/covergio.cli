import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { execScript } from '$server/exec';

export const GET: RequestHandler = async () => {
  const result = execScript('git-digest.sh');
  if (!result.success) return json({ error: result.error }, { status: 500 });
  return json(result.data);
};
