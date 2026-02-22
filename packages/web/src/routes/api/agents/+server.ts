import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface AgentInfo {
  name: string;
  description: string;
  model: string;
  category: string;
  type: 'claude' | 'copilot';
}

function parseAgentFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':');
    if (key && rest.length > 0) {
      frontmatter[key.trim()] = rest.join(':').trim().replace(/^["']|["']$/g, '');
    }
  }

  return frontmatter;
}

function loadAgents(dir: string, type: 'claude' | 'copilot'): AgentInfo[] {
  try {
    const files = readdirSync(dir).filter((file) => file.endsWith('.md'));
    return files.map((file) => {
      const content = readFileSync(join(dir, file), 'utf-8');
      const fm = parseAgentFrontmatter(content);
      return {
        name: fm.name || file.replace('.md', '').replace('.agent', ''),
        description: fm.description || '',
        model: fm.model || 'unknown',
        category: fm.category || 'general',
        type
      };
    });
  } catch {
    return [];
  }
}

export const GET: RequestHandler = async () => {
  const claudeAgents = loadAgents(join(process.env.HOME || '~', '.claude', 'agents'), 'claude');
  const copilotAgents = loadAgents(join(process.env.HOME || '~', '.claude', 'copilot-agents'), 'copilot');
  return json([...claudeAgents, ...copilotAgents]);
};
