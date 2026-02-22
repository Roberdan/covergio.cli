/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
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
  if (!match) return {};
  return match[1].split('\n').reduce<Record<string, string>>((result, line) => {
    const [key, ...rest] = line.split(':');
    if (key && rest.length > 0) {
      result[key.trim()] = rest
        .join(':')
        .trim()
        .replace(/^['"]|['"]$/g, '');
    }
    return result;
  }, {});
}

function readAgentDirectoryRecursive(
  directory: string,
  type: AgentType,
  root?: string,
): AgentCatalogItem[] {
  const base = root ?? directory;
  try {
    const entries = readdirSync(directory);
    const results: AgentCatalogItem[] = [];
    for (const entry of entries) {
      const fullPath = join(directory, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          results.push(...readAgentDirectoryRecursive(fullPath, type, base));
        } else if (entry.endsWith('.md')) {
          const content = readFileSync(fullPath, 'utf-8');
          const fm = parseFrontmatter(content);
          const fallbackName = entry
            .replace('.md', '')
            .replace('.agent', '')
            .replace(/[-_]/g, ' ');
          results.push({
            name: fm.name || fallbackName,
            description: fm.description || 'No description available.',
            model: fm.model || 'unknown',
            category:
              fm.category || (type === 'copilot' ? 'Copilot' : 'Core Utility'),
            type,
            sourceFile: relative(base, fullPath),
          });
        }
      } catch {
        /* skip unreadable */
      }
    }
    return results;
  } catch {
    return [];
  }
}

const CORE_AGENTS: AgentCatalogItem[] = [
  {
    name: 'UniversalOrchestrator',
    description:
      'Central orchestration engine — routes requests to agent pools, caching, circuit breakers, priority queues',
    model: 'gemini',
    category: 'orchestration',
    type: 'claude',
    sourceFile: 'core/orchestrator/',
  },
  {
    name: 'TaskMaster',
    description:
      'Task decomposition — breaks complex requests into waves of parallel tasks with dependency tracking',
    model: 'gemini',
    category: 'orchestration',
    type: 'claude',
    sourceFile: 'core/agents/',
  },
  {
    name: 'AgentFactory',
    description:
      'Dynamic agent creation — spawns domain-specific agents on demand with personality and capabilities',
    model: 'gemini',
    category: 'orchestration',
    type: 'claude',
    sourceFile: 'core/agents/',
  },
  {
    name: 'MarkItDownAgent',
    description:
      'Document processor — converts PDF, Word, PowerPoint, HTML to Markdown for agent consumption',
    model: 'gemini',
    category: 'document_processing',
    type: 'claude',
    sourceFile: 'core/agents/',
  },
  {
    name: 'ImageAltTextAgent',
    description:
      'Accessibility agent — generates descriptive alt-text for images using LLM vision',
    model: 'gemini',
    category: 'document_processing',
    type: 'claude',
    sourceFile: 'core/agents/',
  },
  {
    name: 'CustomerServiceAgent',
    description:
      'Domain template — customer support with issue triage, sentiment analysis, escalation',
    model: 'gemini',
    category: 'domain_agent',
    type: 'claude',
    sourceFile: 'core/templates/',
  },
  {
    name: 'TechnicalSupportAgent',
    description:
      'Domain template — troubleshooting, error diagnosis, system analysis, guided resolution',
    model: 'gemini',
    category: 'domain_agent',
    type: 'claude',
    sourceFile: 'core/templates/',
  },
  {
    name: 'CreativeAssistantAgent',
    description:
      'Domain template — content creation, brainstorming, writing, design briefs',
    model: 'gemini',
    category: 'domain_agent',
    type: 'claude',
    sourceFile: 'core/templates/',
  },
  {
    name: 'DataAnalysisAgent',
    description:
      'Domain template — descriptive/predictive analytics, data visualization, pattern recognition',
    model: 'gemini',
    category: 'domain_agent',
    type: 'claude',
    sourceFile: 'core/templates/',
  },
];

const TOOL_AGENTS: AgentCatalogItem[] = [
  {
    name: 'shell',
    description: 'Execute shell commands with timeout and output capture',
    model: 'tool',
    category: 'tools',
    type: 'claude',
    sourceFile: 'built-in',
  },
  {
    name: 'read-file',
    description: 'Read individual file contents',
    model: 'tool',
    category: 'tools',
    type: 'claude',
    sourceFile: 'built-in',
  },
  {
    name: 'write-file',
    description: 'Create or overwrite files',
    model: 'tool',
    category: 'tools',
    type: 'claude',
    sourceFile: 'built-in',
  },
  {
    name: 'edit',
    description: 'In-place file edits with diff confirmation',
    model: 'tool',
    category: 'tools',
    type: 'claude',
    sourceFile: 'built-in',
  },
  {
    name: 'grep',
    description: 'Fast ripgrep-based code pattern search',
    model: 'tool',
    category: 'tools',
    type: 'claude',
    sourceFile: 'built-in',
  },
  {
    name: 'glob',
    description: 'File discovery by name patterns',
    model: 'tool',
    category: 'tools',
    type: 'claude',
    sourceFile: 'built-in',
  },
  {
    name: 'web-search',
    description: 'Search the web for current information',
    model: 'tool',
    category: 'tools',
    type: 'claude',
    sourceFile: 'built-in',
  },
  {
    name: 'web-fetch',
    description: 'Fetch web pages and APIs',
    model: 'tool',
    category: 'tools',
    type: 'claude',
    sourceFile: 'built-in',
  },
  {
    name: 'memory',
    description: 'Persistent memory storage across agent sessions',
    model: 'tool',
    category: 'tools',
    type: 'claude',
    sourceFile: 'built-in',
  },
  {
    name: 'mcp-client',
    description: 'Model Context Protocol — connect to external tool servers',
    model: 'tool',
    category: 'tools',
    type: 'claude',
    sourceFile: 'built-in',
  },
];

export const load: PageServerLoad = async () => {
  const home = process.env.HOME || '';
  const claudeAgents = readAgentDirectoryRecursive(
    join(home, '.claude', 'agents'),
    'claude',
  );
  const copilotAgents = readAgentDirectoryRecursive(
    join(home, '.claude', 'copilot-agents'),
    'copilot',
  );
  const agents = [
    ...CORE_AGENTS,
    ...claudeAgents,
    ...copilotAgents,
    ...TOOL_AGENTS,
  ].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }),
  );

  return {
    agents,
    counts: {
      claude: claudeAgents.length + CORE_AGENTS.length,
      copilot: copilotAgents.length,
      tools: TOOL_AGENTS.length,
      total: agents.length,
    },
  };
};
