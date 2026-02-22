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
  return type === 'copilot' ? fileName.endsWith('.agent.md') : fileName.endsWith('.md');
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
  return basename(filePath).replace(/\.agent\.md$/, '').replace(/\.md$/, '');
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
  const agents = [...claudeAgents, ...copilotAgents].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
  return json(agents);
};
