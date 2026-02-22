import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { queryMetrics } from '$server/db';

export const GET: RequestHandler = async () => {
  const dbMetrics = queryMetrics();

  const statsPath = join(process.env.HOME || '~', '.claude', 'stats-cache.json');
  let tokenData: unknown = null;
  if (existsSync(statsPath)) {
    try {
      tokenData = JSON.parse(readFileSync(statsPath, 'utf-8'));
    } catch {
      // ignore
    }
  }

  return json({ ...dbMetrics, tokenData });
};
