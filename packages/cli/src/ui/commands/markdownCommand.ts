/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SlashCommand } from './types.js';

/**
 * Markdown processing commands using the MarkItDown agent
 */
export const markdownCommand: SlashCommand = {
  name: 'markdown',
  altName: 'md',
  description: 'Process markdown documents with the MarkItDown agent',
  subCommands: [
    {
      name: 'parse',
      description: 'Parse markdown content into structured format',
      action: async (context, args) => {
        if (!args.trim()) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /markdown parse <markdown-content>\nExample: /markdown parse "# Hello World\\n\\nThis is a test."'
          };
        }

        const orchestrator = context.services.orchestrator;
        if (!orchestrator) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Orchestrator service not available. Please ensure the system is properly initialized.'
          };
        }

        try {
          const response = await orchestrator.orchestrate({
            id: `markdown-parse-${Date.now()}`,
            userInput: `Parse this markdown content: ${args}`,
            sessionContext: {
              sessionId: 'cli-session',
              workspaceRoot: context.services.config?.getProjectRoot() || process.cwd(),
              timestamp: new Date(),
              metadata: { command: 'markdown-parse' }
            },
            timestamp: new Date()
          });

          return {
            type: 'message',
            messageType: 'success',
            content: `Markdown parsed successfully:\n${JSON.stringify(response.result, null, 2)}`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Error parsing markdown: ${error instanceof Error ? error.message : String(error)}`
          };
        }
      }
    },
    {
      name: 'headings',
      description: 'Extract all headings from markdown content',
      action: async (context, args) => {
        if (!args.trim()) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /markdown headings <markdown-content>\nExample: /markdown headings "# Title\\n\\n## Subtitle"'
          };
        }

        const orchestrator = context.services.orchestrator;
        if (!orchestrator) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Orchestrator service not available.'
          };
        }

        try {
          const response = await orchestrator.orchestrate({
            id: `markdown-headings-${Date.now()}`,
            userInput: `Extract headings from this markdown: ${args}`,
            sessionContext: {
              sessionId: 'cli-session',
              workspaceRoot: context.services.config?.getProjectRoot() || process.cwd(),
              timestamp: new Date(),
              metadata: { command: 'markdown-headings' }
            },
            timestamp: new Date()
          });

          return {
            type: 'message',
            messageType: 'success',
            content: `Headings extracted:\n${JSON.stringify(response.result, null, 2)}`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Error extracting headings: ${error instanceof Error ? error.message : String(error)}`
          };
        }
      }
    },
    {
      name: 'toc',
      description: 'Generate table of contents from markdown content',
      action: async (context, args) => {
        const options = parseMarkdownOptions(args);
        
        if (!options.content) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /markdown toc <markdown-content> [--depth=N]\nExample: /markdown toc "# Title\\n\\n## Section 1\\n\\n### Subsection" --depth=2'
          };
        }

        const orchestrator = context.services.orchestrator;
        if (!orchestrator) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Orchestrator service not available.'
          };
        }

        try {
          const depthParam = options.depth ? ` with max depth ${options.depth}` : '';
          const response = await orchestrator.orchestrate({
            id: `markdown-toc-${Date.now()}`,
            userInput: `Generate table of contents${depthParam} for this markdown: ${options.content}`,
            sessionContext: {
              sessionId: 'cli-session',
              workspaceRoot: context.services.config?.getProjectRoot() || process.cwd(),
              timestamp: new Date(),
              metadata: { command: 'markdown-toc' }
            },
            timestamp: new Date()
          });

          return {
            type: 'message',
            messageType: 'success',
            content: `Table of contents generated:\n${response.result?.content || JSON.stringify(response.result, null, 2)}`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Error generating table of contents: ${error instanceof Error ? error.message : String(error)}`
          };
        }
      }
    },
    {
      name: 'html',
      description: 'Convert markdown to HTML',
      action: async (context, args) => {
        if (!args.trim()) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /markdown html <markdown-content>\nExample: /markdown html "# Title\\n\\n**Bold text**"'
          };
        }

        const orchestrator = context.services.orchestrator;
        if (!orchestrator) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Orchestrator service not available.'
          };
        }

        try {
          const response = await orchestrator.orchestrate({
            id: `markdown-html-${Date.now()}`,
            userInput: `Convert this markdown to HTML: ${args}`,
            sessionContext: {
              sessionId: 'cli-session',
              workspaceRoot: context.services.config?.getProjectRoot() || process.cwd(),
              timestamp: new Date(),
              metadata: { command: 'markdown-html' }
            },
            timestamp: new Date()
          });

          return {
            type: 'message',
            messageType: 'success',
            content: `HTML conversion result:\n${response.result?.content || JSON.stringify(response.result, null, 2)}`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Error converting to HTML: ${error instanceof Error ? error.message : String(error)}`
          };
        }
      }
    },
    {
      name: 'analyze',
      description: 'Analyze markdown document structure',
      action: async (context, args) => {
        if (!args.trim()) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /markdown analyze <markdown-content>\nExample: /markdown analyze "# Title\\n\\nParagraph with *emphasis*"'
          };
        }

        const orchestrator = context.services.orchestrator;
        if (!orchestrator) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Orchestrator service not available.'
          };
        }

        try {
          const response = await orchestrator.orchestrate({
            id: `markdown-analyze-${Date.now()}`,
            userInput: `Analyze the structure of this markdown: ${args}`,
            sessionContext: {
              sessionId: 'cli-session',
              workspaceRoot: context.services.config?.getProjectRoot() || process.cwd(),
              timestamp: new Date(),
              metadata: { command: 'markdown-analyze' }
            },
            timestamp: new Date()
          });

          return {
            type: 'message',
            messageType: 'success',
            content: `Structure analysis:\n${JSON.stringify(response.result, null, 2)}`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Error analyzing structure: ${error instanceof Error ? error.message : String(error)}`
          };
        }
      }
    },
    {
      name: 'links',
      description: 'Extract all links from markdown content',
      action: async (context, args) => {
        if (!args.trim()) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /markdown links <markdown-content>\nExample: /markdown links "Visit [Google](https://google.com) or [GitHub](https://github.com)"'
          };
        }

        const orchestrator = context.services.orchestrator;
        if (!orchestrator) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Orchestrator service not available.'
          };
        }

        try {
          const response = await orchestrator.orchestrate({
            id: `markdown-links-${Date.now()}`,
            userInput: `Extract all links from this markdown: ${args}`,
            sessionContext: {
              sessionId: 'cli-session',
              workspaceRoot: context.services.config?.getProjectRoot() || process.cwd(),
              timestamp: new Date(),
              metadata: { command: 'markdown-links' }
            },
            timestamp: new Date()
          });

          return {
            type: 'message',
            messageType: 'success',
            content: `Links extracted:\n${JSON.stringify(response.result, null, 2)}`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Error extracting links: ${error instanceof Error ? error.message : String(error)}`
          };
        }
      }
    },
    {
      name: 'file',
      description: 'Process a markdown file',
      action: async (context, args) => {
        const options = parseFileOptions(args);
        
        if (!options.filePath) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /markdown file <file-path> [--operation=parse|headings|toc|html|analyze|links]\nExample: /markdown file ./README.md --operation=toc'
          };
        }

        const orchestrator = context.services.orchestrator;
        if (!orchestrator) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Orchestrator service not available.'
          };
        }

        try {
          const operation = options.operation || 'parse';
          const response = await orchestrator.orchestrate({
            id: `markdown-file-${Date.now()}`,
            userInput: `Process the markdown file at ${options.filePath} with operation: ${operation}`,
            sessionContext: {
              sessionId: 'cli-session',
              workspaceRoot: context.services.config?.getProjectRoot() || process.cwd(),
              timestamp: new Date(),
              metadata: { command: 'markdown-file', operation }
            },
            timestamp: new Date()
          });

          return {
            type: 'message',
            messageType: 'success',
            content: `File processed (${operation}):\n${JSON.stringify(response.result, null, 2)}`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Error processing file: ${error instanceof Error ? error.message : String(error)}`
          };
        }
      }
    },
    {
      name: 'memory',
      description: 'Manage markdown document memory',
      subCommands: [
        {
          name: 'store',
          description: 'Store markdown content in memory',
          action: async (context, args) => {
            const options = parseMemoryOptions(args);
            
            if (!options.content) {
              return {
                type: 'message',
                messageType: 'error',
                content: 'Usage: /markdown memory store <markdown-content> [--name=filename]\nExample: /markdown memory store "# Document\\n\\nContent" --name=test.md'
              };
            }

            const orchestrator = context.services.orchestrator;
            if (!orchestrator) {
              return {
                type: 'message',
                messageType: 'error',
                content: 'Orchestrator service not available.'
              };
            }

            try {
              const response = await orchestrator.orchestrate({
                id: `markdown-memory-store-${Date.now()}`,
                userInput: `Store this markdown content in memory${options.name ? ` with filename ${options.name}` : ''}: ${options.content}`,
                sessionContext: {
                  sessionId: 'cli-session',
                  workspaceRoot: context.services.config?.getProjectRoot() || process.cwd(),
                  timestamp: new Date(),
                  metadata: { command: 'markdown-memory-store' }
                },
                timestamp: new Date()
              });

              return {
                type: 'message',
                messageType: 'success',
                content: `Markdown document stored in memory:\n${JSON.stringify(response.result, null, 2)}`
              };
            } catch (error) {
              return {
                type: 'message',
                messageType: 'error',
                content: `Error storing document: ${error instanceof Error ? error.message : String(error)}`
              };
            }
          }
        },
        {
          name: 'search',
          description: 'Search stored markdown documents',
          action: async (context, args) => {
            if (!args.trim()) {
              return {
                type: 'message',
                messageType: 'error',
                content: 'Usage: /markdown memory search <search-term>\nExample: /markdown memory search "API documentation"'
              };
            }

            const orchestrator = context.services.orchestrator;
            if (!orchestrator) {
              return {
                type: 'message',
                messageType: 'error',
                content: 'Orchestrator service not available.'
              };
            }

            try {
              const response = await orchestrator.orchestrate({
                id: `markdown-memory-search-${Date.now()}`,
                userInput: `Search stored markdown documents for: ${args}`,
                sessionContext: {
                  sessionId: 'cli-session',
                  workspaceRoot: context.services.config?.getProjectRoot() || process.cwd(),
                  timestamp: new Date(),
                  metadata: { command: 'markdown-memory-search' }
                },
                timestamp: new Date()
              });

              return {
                type: 'message',
                messageType: 'success',
                content: `Search results:\n${JSON.stringify(response.result, null, 2)}`
              };
            } catch (error) {
              return {
                type: 'message',
                messageType: 'error',
                content: `Error searching documents: ${error instanceof Error ? error.message : String(error)}`
              };
            }
          }
        },
        {
          name: 'list',
          description: 'List stored markdown documents',
          action: async (context) => {
            const orchestrator = context.services.orchestrator;
            if (!orchestrator) {
              return {
                type: 'message',
                messageType: 'error',
                content: 'Orchestrator service not available.'
              };
            }

            try {
              const response = await orchestrator.orchestrate({
                id: `markdown-memory-list-${Date.now()}`,
                userInput: 'List all stored markdown documents',
                sessionContext: {
                  sessionId: 'cli-session',
                  workspaceRoot: context.services.config?.getProjectRoot() || process.cwd(),
                  timestamp: new Date(),
                  metadata: { command: 'markdown-memory-list' }
                },
                timestamp: new Date()
              });

              return {
                type: 'message',
                messageType: 'success',
                content: `Stored documents:\n${JSON.stringify(response.result, null, 2)}`
              };
            } catch (error) {
              return {
                type: 'message',
                messageType: 'error',
                content: `Error listing documents: ${error instanceof Error ? error.message : String(error)}`
              };
            }
          }
        },
        {
          name: 'stats',
          description: 'Show document memory statistics',
          action: async (context) => {
            const orchestrator = context.services.orchestrator;
            if (!orchestrator) {
              return {
                type: 'message',
                messageType: 'error',
                content: 'Orchestrator service not available.'
              };
            }

            try {
              const response = await orchestrator.orchestrate({
                id: `markdown-memory-stats-${Date.now()}`,
                userInput: 'Show statistics for stored markdown documents',
                sessionContext: {
                  sessionId: 'cli-session',
                  workspaceRoot: context.services.config?.getProjectRoot() || process.cwd(),
                  timestamp: new Date(),
                  metadata: { command: 'markdown-memory-stats' }
                },
                timestamp: new Date()
              });

              return {
                type: 'message',
                messageType: 'success',
                content: `Document statistics:\n${JSON.stringify(response.result, null, 2)}`
              };
            } catch (error) {
              return {
                type: 'message',
                messageType: 'error',
                content: `Error getting statistics: ${error instanceof Error ? error.message : String(error)}`
              };
            }
          }
        }
      ]
    },
    {
      name: 'help',
      description: 'Show detailed help for markdown commands',
      action: async () => {
        const helpText = `
Markdown Command Help
=====================

The /markdown command provides comprehensive markdown processing capabilities using the MarkItDown agent.

Available Commands:
------------------

• /markdown parse <content>
  Parse markdown content into structured format
  Example: /markdown parse "# Hello\\n\\nWorld"

• /markdown headings <content>
  Extract all headings from markdown content
  Example: /markdown headings "# Title\\n\\n## Section"

• /markdown toc <content> [--depth=N]
  Generate table of contents from markdown content
  Example: /markdown toc "# Title\\n\\n## Section 1\\n\\n### Sub 1" --depth=2

• /markdown html <content>
  Convert markdown to HTML
  Example: /markdown html "**Bold** and *italic*"

• /markdown analyze <content>
  Analyze markdown document structure
  Example: /markdown analyze "# Title\\n\\nParagraph with [link](url)"

• /markdown links <content>
  Extract all links from markdown content
  Example: /markdown links "Visit [Google](https://google.com)"

• /markdown file <path> [--operation=parse|headings|toc|html|analyze|links]
  Process a markdown file
  Example: /markdown file ./README.md --operation=toc

Memory Commands:
---------------

• /markdown memory store <content> [--name=filename]
  Store markdown content in memory for later retrieval
  Example: /markdown memory store "# Doc\\n\\nContent" --name=test.md

• /markdown memory search <term>
  Search stored markdown documents
  Example: /markdown memory search "API documentation"

• /markdown memory list
  List all stored markdown documents

• /markdown memory stats
  Show document memory statistics

Tips:
-----
• Use quotes around markdown content that contains special characters
• The --depth parameter in toc command limits heading levels (default: 3)
• File operations work with relative and absolute paths
• Memory operations persist documents across CLI sessions
• All commands support complex markdown with headings, links, images, tables, and code blocks

Examples:
---------
/markdown parse "# API Guide\\n\\n## Authentication\\n\\nUse Bearer tokens."
/markdown toc "# Main\\n\\n## Section 1\\n\\n### Sub 1\\n\\n## Section 2" --depth=2
/markdown file ./docs/README.md --operation=analyze
/markdown memory store "# Project Notes\\n\\nRemember to update docs." --name=notes.md
`;

        return {
          type: 'message',
          messageType: 'info',
          content: helpText
        };
      }
    }
  ]
};

/**
 * Parse markdown command options
 */
function parseMarkdownOptions(args: string): {
  content?: string;
  depth?: number;
} {
  const options: any = {};
  const parts = args.split(' ');
  const contentParts: string[] = [];

  for (const part of parts) {
    if (part.startsWith('--depth=')) {
      options.depth = parseInt(part.substring(8));
    } else if (!part.startsWith('--')) {
      contentParts.push(part);
    }
  }

  if (contentParts.length > 0) {
    options.content = contentParts.join(' ');
  }

  return options;
}

/**
 * Parse file command options
 */
function parseFileOptions(args: string): {
  filePath?: string;
  operation?: string;
} {
  const options: any = {};
  const parts = args.split(' ');

  for (const part of parts) {
    if (part.startsWith('--operation=')) {
      options.operation = part.substring(12);
    } else if (!part.startsWith('--')) {
      // First non-option argument is the file path
      if (!options.filePath) {
        options.filePath = part;
      }
    }
  }

  return options;
}

/**
 * Parse memory command options
 */
function parseMemoryOptions(args: string): {
  content?: string;
  name?: string;
} {
  const options: any = {};
  const parts = args.split(' ');
  const contentParts: string[] = [];

  for (const part of parts) {
    if (part.startsWith('--name=')) {
      options.name = part.substring(7);
    } else if (!part.startsWith('--')) {
      contentParts.push(part);
    }
  }

  if (contentParts.length > 0) {
    options.content = contentParts.join(' ');
  }

  return options;
}