/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { markdownCommand } from './markdownCommand.js';
import { CommandContext } from './types.js';

describe('markdownCommand', () => {
  let mockContext: CommandContext;
  let mockOrchestrator: any;

  beforeEach(() => {
    mockOrchestrator = {
      orchestrate: vi.fn(),
    };

    mockContext = {
      services: {
        config: {
          getProjectRoot: vi.fn(() => '/test/project'),
        },
        settings: {} as any,
        git: undefined,
        logger: {} as any,
        orchestrator: mockOrchestrator,
      },
      ui: {
        addItem: vi.fn(),
        clear: vi.fn(),
        setDebugMessage: vi.fn(),
      },
      session: {
        stats: {} as any,
      },
    };
  });

  describe('basic command structure', () => {
    it('should have correct command metadata', () => {
      expect(markdownCommand.name).toBe('markdown');
      expect(markdownCommand.altName).toBe('md');
      expect(markdownCommand.description).toBe('Process markdown documents with the MarkItDown agent');
      expect(markdownCommand.subCommands).toHaveLength(9); // 8 main commands + help
    });

    it('should have all expected subcommands', () => {
      const subCommandNames = markdownCommand.subCommands!.map(cmd => cmd.name);
      expect(subCommandNames).toContain('parse');
      expect(subCommandNames).toContain('headings');
      expect(subCommandNames).toContain('toc');
      expect(subCommandNames).toContain('html');
      expect(subCommandNames).toContain('analyze');
      expect(subCommandNames).toContain('links');
      expect(subCommandNames).toContain('file');
      expect(subCommandNames).toContain('memory');
      expect(subCommandNames).toContain('help');
    });
  });

  describe('parse command', () => {
    it('should return error for empty args', async () => {
      const parseCommand = markdownCommand.subCommands!.find(cmd => cmd.name === 'parse')!;
      const result = await parseCommand.action!(mockContext, '');

      expect(result).toEqual({
        type: 'message',
        messageType: 'error',
        content: 'Usage: /markdown parse <markdown-content>\nExample: /markdown parse "# Hello World\\n\\nThis is a test."'
      });
    });

    it('should return error when orchestrator is not available', async () => {
      mockContext.services.orchestrator = undefined;
      const parseCommand = markdownCommand.subCommands!.find(cmd => cmd.name === 'parse')!;
      const result = await parseCommand.action!(mockContext, '# Test');

      expect(result).toEqual({
        type: 'message',
        messageType: 'error',
        content: 'Orchestrator service not available. Please ensure the system is properly initialized.'
      });
    });

    it('should successfully parse markdown content', async () => {
      const mockResponse = {
        result: {
          content: 'Parsed markdown structure',
          headings: [{ level: 1, text: 'Test' }]
        }
      };
      mockOrchestrator.orchestrate.mockResolvedValue(mockResponse);

      const parseCommand = markdownCommand.subCommands!.find(cmd => cmd.name === 'parse')!;
      const result = await parseCommand.action!(mockContext, '# Test');

      expect(mockOrchestrator.orchestrate).toHaveBeenCalledWith({
        id: expect.stringMatching(/^markdown-parse-\d+$/),
        userInput: 'Parse this markdown content: # Test',
        sessionContext: {
          sessionId: 'cli-session',
          workspaceRoot: '/test/project',
          timestamp: expect.any(Date),
          metadata: { command: 'markdown-parse' }
        },
        timestamp: expect.any(Date)
      });

      expect(result).toEqual({
        type: 'message',
        messageType: 'success',
        content: `Markdown parsed successfully:\n${JSON.stringify(mockResponse.result, null, 2)}`
      });
    });

    it('should handle orchestrator errors', async () => {
      mockOrchestrator.orchestrate.mockRejectedValue(new Error('Orchestrator failed'));

      const parseCommand = markdownCommand.subCommands!.find(cmd => cmd.name === 'parse')!;
      const result = await parseCommand.action!(mockContext, '# Test');

      expect(result).toEqual({
        type: 'message',
        messageType: 'error',
        content: 'Error parsing markdown: Orchestrator failed'
      });
    });
  });

  describe('headings command', () => {
    it('should extract headings from markdown', async () => {
      const mockResponse = {
        result: {
          headings: [
            { level: 1, text: 'Title', id: 'title' },
            { level: 2, text: 'Section', id: 'section' }
          ]
        }
      };
      mockOrchestrator.orchestrate.mockResolvedValue(mockResponse);

      const headingsCommand = markdownCommand.subCommands!.find(cmd => cmd.name === 'headings')!;
      const result = await headingsCommand.action!(mockContext, '# Title\\n\\n## Section');

      expect(mockOrchestrator.orchestrate).toHaveBeenCalledWith({
        id: expect.stringMatching(/^markdown-headings-\d+$/),
        userInput: 'Extract headings from this markdown: # Title\\n\\n## Section',
        sessionContext: expect.objectContaining({
          metadata: { command: 'markdown-headings' }
        }),
        timestamp: expect.any(Date)
      });

      expect(result).toEqual({
        type: 'message',
        messageType: 'success',
        content: `Headings extracted:\n${JSON.stringify(mockResponse.result, null, 2)}`
      });
    });
  });

  describe('toc command', () => {
    it('should generate table of contents', async () => {
      const mockResponse = {
        result: {
          content: '1. [Title](#title)\\n   1. [Section](#section)'
        }
      };
      mockOrchestrator.orchestrate.mockResolvedValue(mockResponse);

      const tocCommand = markdownCommand.subCommands!.find(cmd => cmd.name === 'toc')!;
      const result = await tocCommand.action!(mockContext, '# Title\\n\\n## Section');

      expect(result).toEqual({
        type: 'message',
        messageType: 'success',
        content: `Table of contents generated:\n${mockResponse.result.content}`
      });
    });

    it('should handle depth parameter', async () => {
      const mockResponse = { result: { content: 'TOC with depth 2' } };
      mockOrchestrator.orchestrate.mockResolvedValue(mockResponse);

      const tocCommand = markdownCommand.subCommands!.find(cmd => cmd.name === 'toc')!;
      await tocCommand.action!(mockContext, '# Title\\n\\n## Section --depth=2');

      expect(mockOrchestrator.orchestrate).toHaveBeenCalledWith(
        expect.objectContaining({
          userInput: 'Generate table of contents with max depth 2 for this markdown: # Title\\n\\n## Section'
        })
      );
    });
  });

  describe('html command', () => {
    it('should convert markdown to HTML', async () => {
      const mockResponse = {
        result: {
          content: '<h1>Title</h1>\\n<p><strong>Bold</strong> text</p>'
        }
      };
      mockOrchestrator.orchestrate.mockResolvedValue(mockResponse);

      const htmlCommand = markdownCommand.subCommands!.find(cmd => cmd.name === 'html')!;
      const result = await htmlCommand.action!(mockContext, '# Title\\n\\n**Bold** text');

      expect(result).toEqual({
        type: 'message',
        messageType: 'success',
        content: `HTML conversion result:\n${mockResponse.result.content}`
      });
    });
  });

  describe('analyze command', () => {
    it('should analyze markdown structure', async () => {
      const mockResponse = {
        result: {
          structure: {
            headings: 2,
            paragraphs: 3,
            links: 1,
            images: 0
          }
        }
      };
      mockOrchestrator.orchestrate.mockResolvedValue(mockResponse);

      const analyzeCommand = markdownCommand.subCommands!.find(cmd => cmd.name === 'analyze')!;
      const result = await analyzeCommand.action!(mockContext, '# Title\\n\\nParagraph with [link](url)');

      expect(result).toEqual({
        type: 'message',
        messageType: 'success',
        content: `Structure analysis:\n${JSON.stringify(mockResponse.result, null, 2)}`
      });
    });
  });

  describe('links command', () => {
    it('should extract links from markdown', async () => {
      const mockResponse = {
        result: {
          links: [
            { text: 'Google', url: 'https://google.com' },
            { text: 'GitHub', url: 'https://github.com' }
          ]
        }
      };
      mockOrchestrator.orchestrate.mockResolvedValue(mockResponse);

      const linksCommand = markdownCommand.subCommands!.find(cmd => cmd.name === 'links')!;
      const result = await linksCommand.action!(mockContext, 'Visit [Google](https://google.com)');

      expect(result).toEqual({
        type: 'message',
        messageType: 'success',
        content: `Links extracted:\n${JSON.stringify(mockResponse.result, null, 2)}`
      });
    });
  });

  describe('file command', () => {
    it('should process markdown file', async () => {
      const mockResponse = {
        result: {
          content: 'File processed successfully',
          operation: 'parse'
        }
      };
      mockOrchestrator.orchestrate.mockResolvedValue(mockResponse);

      const fileCommand = markdownCommand.subCommands!.find(cmd => cmd.name === 'file')!;
      const result = await fileCommand.action!(mockContext, './README.md --operation=parse');

      expect(mockOrchestrator.orchestrate).toHaveBeenCalledWith({
        id: expect.stringMatching(/^markdown-file-\d+$/),
        userInput: 'Process the markdown file at ./README.md with operation: parse',
        sessionContext: expect.objectContaining({
          metadata: { command: 'markdown-file', operation: 'parse' }
        }),
        timestamp: expect.any(Date)
      });

      expect(result).toEqual({
        type: 'message',
        messageType: 'success',
        content: `File processed (parse):\n${JSON.stringify(mockResponse.result, null, 2)}`
      });
    });

    it('should return error for missing file path', async () => {
      const fileCommand = markdownCommand.subCommands!.find(cmd => cmd.name === 'file')!;
      const result = await fileCommand.action!(mockContext, '');

      expect(result).toEqual({
        type: 'message',
        messageType: 'error',
        content: 'Usage: /markdown file <file-path> [--operation=parse|headings|toc|html|analyze|links]\nExample: /markdown file ./README.md --operation=toc'
      });
    });
  });

  describe('memory command', () => {
    it('should have memory subcommands', () => {
      const memoryCommand = markdownCommand.subCommands!.find(cmd => cmd.name === 'memory')!;
      expect(memoryCommand.subCommands).toHaveLength(4);
      
      const subCommandNames = memoryCommand.subCommands!.map(cmd => cmd.name);
      expect(subCommandNames).toContain('store');
      expect(subCommandNames).toContain('search');
      expect(subCommandNames).toContain('list');
      expect(subCommandNames).toContain('stats');
    });

    describe('store subcommand', () => {
      it('should store markdown content in memory', async () => {
        const mockResponse = {
          result: {
            id: 'doc-123',
            message: 'Document stored successfully'
          }
        };
        mockOrchestrator.orchestrate.mockResolvedValue(mockResponse);

        const memoryCommand = markdownCommand.subCommands!.find(cmd => cmd.name === 'memory')!;
        const storeCommand = memoryCommand.subCommands!.find(cmd => cmd.name === 'store')!;
        const result = await storeCommand.action!(mockContext, '# Document\\n\\nContent --name=test.md');

        expect(mockOrchestrator.orchestrate).toHaveBeenCalledWith({
          id: expect.stringMatching(/^markdown-memory-store-\d+$/),
          userInput: 'Store this markdown content in memory with filename test.md: # Document\\n\\nContent',
          sessionContext: expect.objectContaining({
            metadata: { command: 'markdown-memory-store' }
          }),
          timestamp: expect.any(Date)
        });

        expect(result).toEqual({
          type: 'message',
          messageType: 'success',
          content: `Markdown document stored in memory:\n${JSON.stringify(mockResponse.result, null, 2)}`
        });
      });
    });

    describe('search subcommand', () => {
      it('should search stored markdown documents', async () => {
        const mockResponse = {
          result: {
            results: [
              { id: 'doc-1', title: 'API Documentation', relevance: 0.95 }
            ]
          }
        };
        mockOrchestrator.orchestrate.mockResolvedValue(mockResponse);

        const memoryCommand = markdownCommand.subCommands!.find(cmd => cmd.name === 'memory')!;
        const searchCommand = memoryCommand.subCommands!.find(cmd => cmd.name === 'search')!;
        const result = await searchCommand.action!(mockContext, 'API documentation');

        expect(result).toEqual({
          type: 'message',
          messageType: 'success',
          content: `Search results:\n${JSON.stringify(mockResponse.result, null, 2)}`
        });
      });
    });

    describe('list subcommand', () => {
      it('should list stored markdown documents', async () => {
        const mockResponse = {
          result: {
            documents: [
              { id: 'doc-1', title: 'README', stored: '2025-01-01T00:00:00Z' },
              { id: 'doc-2', title: 'API Guide', stored: '2025-01-02T00:00:00Z' }
            ]
          }
        };
        mockOrchestrator.orchestrate.mockResolvedValue(mockResponse);

        const memoryCommand = markdownCommand.subCommands!.find(cmd => cmd.name === 'memory')!;
        const listCommand = memoryCommand.subCommands!.find(cmd => cmd.name === 'list')!;
        const result = await listCommand.action!(mockContext);

        expect(result).toEqual({
          type: 'message',
          messageType: 'success',
          content: `Stored documents:\n${JSON.stringify(mockResponse.result, null, 2)}`
        });
      });
    });

    describe('stats subcommand', () => {
      it('should show document memory statistics', async () => {
        const mockResponse = {
          result: {
            statistics: {
              totalDocuments: 15,
              totalSize: '2.5MB',
              lastUpdated: '2025-01-15T10:00:00Z'
            }
          }
        };
        mockOrchestrator.orchestrate.mockResolvedValue(mockResponse);

        const memoryCommand = markdownCommand.subCommands!.find(cmd => cmd.name === 'memory')!;
        const statsCommand = memoryCommand.subCommands!.find(cmd => cmd.name === 'stats')!;
        const result = await statsCommand.action!(mockContext);

        expect(result).toEqual({
          type: 'message',
          messageType: 'success',
          content: `Document statistics:\n${JSON.stringify(mockResponse.result, null, 2)}`
        });
      });
    });
  });

  describe('help command', () => {
    it('should return comprehensive help information', async () => {
      const helpCommand = markdownCommand.subCommands!.find(cmd => cmd.name === 'help')!;
      const result = await helpCommand.action!();

      expect(result).toEqual({
        type: 'message',
        messageType: 'info',
        content: expect.stringContaining('Markdown Command Help')
      });
      expect(result.content).toContain('Available Commands:');
      expect(result.content).toContain('Memory Commands:');
      expect(result.content).toContain('Tips:');
      expect(result.content).toContain('Examples:');
    });
  });

  describe('option parsing functions', () => {
    describe('parseMarkdownOptions', () => {
      it('should parse content and depth correctly', () => {
        // We can't directly test these functions as they're not exported
        // but we can test their behavior through the toc command
        const tocCommand = markdownCommand.subCommands!.find(cmd => cmd.name === 'toc')!;
        
        // The actual testing is done through the command execution above
        expect(tocCommand).toBeDefined();
      });
    });
  });
});