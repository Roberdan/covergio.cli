/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readdirSync, readFileSync } from 'fs';
import { basename, dirname, join, relative, sep } from 'path';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface AgentInfo {
  name: string;
  description: string;
  model: string;
  category: string;
  type: 'claude' | 'copilot';
}

interface AgentFrontmatter {
  name?: string;
  description?: string;
  model?: string;
  category?: string;
}

function parseAgentFrontmatter(content: string): AgentFrontmatter {
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!match) {
    return {};
  }

  const frontmatter: AgentFrontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');

    switch (key) {
      case 'name':
        frontmatter.name = value;
        break;
      case 'description':
        frontmatter.description = value;
        break;
      case 'model':
        frontmatter.model = value;
        break;
      case 'category':
        frontmatter.category = value;
        break;
      default:
        break;
    }
  }

  return frontmatter;
}

function isAgentFile(fileName: string, type: 'claude' | 'copilot'): boolean {
  return type === 'copilot'
    ? fileName.endsWith('.agent.md')
    : fileName.endsWith('.md');
}

function collectAgentFiles(dir: string, type: 'claude' | 'copilot'): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectAgentFiles(fullPath, type));
      continue;
    }
    if (entry.isFile() && isAgentFile(entry.name, type)) {
      files.push(fullPath);
    }
  }
  return files;
}

function getCategoryFallback(baseDir: string, filePath: string): string {
  const relativeDir = dirname(relative(baseDir, filePath));
  if (relativeDir === '.') {
    return 'general';
  }
  return relativeDir.split(sep)[0] || 'general';
}

function getNameFallback(filePath: string): string {
  return basename(filePath)
    .replace(/\.agent\.md$/, '')
    .replace(/\.md$/, '');
}

function loadAgents(dir: string, type: 'claude' | 'copilot'): AgentInfo[] {
  try {
    const files = collectAgentFiles(dir, type);
    return files.map((filePath) => {
      const content = readFileSync(filePath, 'utf-8');
      const fm = parseAgentFrontmatter(content);
      return {
        name: fm.name || getNameFallback(filePath),
        description: fm.description || '',
        model: fm.model || 'unknown',
        category: fm.category || getCategoryFallback(dir, filePath),
        type,
      };
    });
  } catch {
    return [];
  }
}

export const GET: RequestHandler = async () => {
  const claudeAgents = loadAgents(
    join(process.env.HOME || '~', '.claude', 'agents'),
    'claude',
  );
  const copilotAgents = loadAgents(
    join(process.env.HOME || '~', '.claude', 'copilot-agents'),
    'copilot',
  );

  // Core engine agents (from packages/core/src/universal/agents/)
  const coreAgents: AgentInfo[] = [
    {
      name: 'UniversalOrchestrator',
      description:
        'Central orchestration engine — routes requests to agent pools with caching, circuit breakers, and priority queues',
      model: 'gemini',
      category: 'orchestration',
      type: 'claude',
    },
    {
      name: 'TaskMaster',
      description:
        'Intelligent task decomposition — breaks complex requests into waves of parallel tasks with dependency tracking',
      model: 'gemini',
      category: 'orchestration',
      type: 'claude',
    },
    {
      name: 'AgentFactory',
      description:
        'Dynamic agent creation — spawns domain-specific agents on demand with personality traits and capabilities',
      model: 'gemini',
      category: 'orchestration',
      type: 'claude',
    },
    {
      name: 'MarkItDownAgent',
      description:
        'Document processor — converts PDF, Word, PowerPoint, HTML to Markdown for agent consumption',
      model: 'gemini',
      category: 'document_processing',
      type: 'claude',
    },
    {
      name: 'ImageAltTextAgent',
      description:
        'Accessibility agent — generates descriptive alt-text for images using LLM vision',
      model: 'gemini',
      category: 'document_processing',
      type: 'claude',
    },
    {
      name: 'CustomerServiceAgent',
      description:
        'Domain agent — customer support with issue triage, sentiment analysis, escalation protocols',
      model: 'gemini',
      category: 'domain_agent',
      type: 'claude',
    },
    {
      name: 'TechnicalSupportAgent',
      description:
        'Domain agent — troubleshooting, error diagnosis, system analysis, guided resolution',
      model: 'gemini',
      category: 'domain_agent',
      type: 'claude',
    },
    {
      name: 'CreativeAssistantAgent',
      description:
        'Domain agent — content creation, brainstorming, writing, design briefs',
      model: 'gemini',
      category: 'domain_agent',
      type: 'claude',
    },
    {
      name: 'DataAnalysisAgent',
      description:
        'Domain agent — descriptive/predictive analytics, data visualization, pattern recognition',
      model: 'gemini',
      category: 'domain_agent',
      type: 'claude',
    },
  ];

  // Tools available to all agents
  const toolAgents: AgentInfo[] = [
    {
      name: 'shell',
      description: 'Execute shell commands with timeout and output capture',
      model: 'tool',
      category: 'tools',
      type: 'claude',
    },
    {
      name: 'read-file',
      description: 'Read individual file contents',
      model: 'tool',
      category: 'tools',
      type: 'claude',
    },
    {
      name: 'write-file',
      description: 'Create or overwrite files',
      model: 'tool',
      category: 'tools',
      type: 'claude',
    },
    {
      name: 'edit',
      description: 'In-place file edits with diff confirmation',
      model: 'tool',
      category: 'tools',
      type: 'claude',
    },
    {
      name: 'grep',
      description: 'Fast ripgrep-based code pattern search',
      model: 'tool',
      category: 'tools',
      type: 'claude',
    },
    {
      name: 'glob',
      description: 'File discovery by name patterns',
      model: 'tool',
      category: 'tools',
      type: 'claude',
    },
    {
      name: 'web-search',
      description: 'Search the web for information',
      model: 'tool',
      category: 'tools',
      type: 'claude',
    },
    {
      name: 'web-fetch',
      description: 'Fetch web pages and APIs',
      model: 'tool',
      category: 'tools',
      type: 'claude',
    },
    {
      name: 'memory',
      description: 'Persistent memory storage across agent sessions',
      model: 'tool',
      category: 'tools',
      type: 'claude',
    },
    {
      name: 'mcp-client',
      description: 'Model Context Protocol — connect to external tool servers',
      model: 'tool',
      category: 'tools',
      type: 'claude',
    },
  ];

  const agents = [
    ...coreAgents,
    ...claudeAgents,
    ...copilotAgents,
    ...toolAgents,
  ].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
  return json(agents);
};
