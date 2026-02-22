// @ts-nocheck
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type { PageServerLoad } from './$types';

type AgentType = 'claude' | 'copilot';

interface AgentCatalogItem {
  name: string;
  description: string;
  model: string;
  category: string;
  type: AgentType;
  sourceFile: string;
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return {};
  }

  return match[1].split('\n').reduce<Record<string, string>>((result, line) => {
    const [key, ...rest] = line.split(':');
    if (key && rest.length > 0) {
      result[key.trim()] = rest.join(':').trim().replace(/^['\"]|['\"]$/g, '');
    }
    return result;
  }, {});
}

function readAgentDirectory(directory: string, type: AgentType): AgentCatalogItem[] {
  try {
    return readdirSync(directory)
      .filter((file) => file.endsWith('.md'))
      .map((file) => {
        const content = readFileSync(join(directory, file), 'utf-8');
        const frontmatter = parseFrontmatter(content);
        const fallbackName = file.replace('.md', '').replace('.agent', '').replace(/[-_]/g, ' ');

        return {
          name: frontmatter.name || fallbackName,
          description: frontmatter.description || 'No description available.',
          model: frontmatter.model || 'unknown',
          category: frontmatter.category || (type === 'copilot' ? 'Copilot' : 'Core Utility'),
          type,
          sourceFile: file
        };
      });
  } catch {
    return [];
  }
}

export const load = async () => {
  const home = process.env.HOME || '';
  const claudeAgents = readAgentDirectory(join(home, '.claude', 'agents'), 'claude');
  const copilotAgents = readAgentDirectory(join(home, '.claude', 'copilot-agents'), 'copilot');
  const agents = [...claudeAgents, ...copilotAgents].sort((left, right) =>
    left.name.localeCompare(right.name)
  );

  return {
    agents,
    counts: {
      claude: claudeAgents.length,
      copilot: copilotAgents.length,
      total: agents.length
    }
  };
};
;null as any as PageServerLoad;