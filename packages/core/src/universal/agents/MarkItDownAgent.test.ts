/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MarkItDownAgent } from './MarkItDownAgent.js';
import { AgentConfig, AgentContext } from './types.js';

describe('MarkItDownAgent', () => {
  let agent: MarkItDownAgent;
  let mockContext: AgentContext;

  beforeEach(async () => {
    const config: AgentConfig = {
      domain: 'document-processing',
      role: 'markdown-specialist'
    };

    agent = new MarkItDownAgent(config);
    await agent.initialize();

    mockContext = {
      sessionId: 'test-session',
      executionId: 'test-execution',
      timestamp: new Date(),
      environment: {}
    };
  });

  describe('initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(agent.id).toBeDefined();
      expect(agent.definition.domain).toBe('document-processing');
      expect(agent.definition.role).toBe('markdown-specialist');
      expect(agent.state).toBe('ready');
    });

    it('should have correct capabilities', () => {
      const capabilities = agent.getCapabilities();
      expect(capabilities).toHaveLength(5);
      expect(capabilities.map(c => c.id)).toContain('markdown-parsing');
      expect(capabilities.map(c => c.id)).toContain('document-analysis');
      expect(capabilities.map(c => c.id)).toContain('content-extraction');
      expect(capabilities.map(c => c.id)).toContain('structure-manipulation');
      expect(capabilities.map(c => c.id)).toContain('format-conversion');
    });

    it('should have correct tools', () => {
      const tools = agent.getTools();
      expect(tools).toHaveLength(7);
      expect(tools.map(t => t.id)).toContain('parseMarkdown');
      expect(tools.map(t => t.id)).toContain('extractHeadings');
      expect(tools.map(t => t.id)).toContain('generateTableOfContents');
      expect(tools.map(t => t.id)).toContain('convertToHTML');
      expect(tools.map(t => t.id)).toContain('analyzeStructure');
      expect(tools.map(t => t.id)).toContain('extractLinks');
      expect(tools.map(t => t.id)).toContain('convertDocument');
    });
  });

  describe('parseMarkdown', () => {
    it('should parse basic markdown content', async () => {
      const input = 'Parse this markdown: # Hello World\n\nThis is a test paragraph.';
      const result = await agent.execute({ input, context: mockContext });
      
      console.log('Result type:', result.type);
      console.log('Result content:', result.content);
      if (result.error) {
        console.log('Error:', result.error);
      }
      
      expect(result.type).toBe('markdown');
      expect(result.content).toContain('textContent');
      expect(result.content).toContain('structure');
      expect(result.metadata?.operation).toBe('parseMarkdown');
    });

    it('should handle empty content', async () => {
      const input = 'Parse this markdown: ';
      const result = await agent.execute({ input, context: mockContext });
      
      expect(result.type).toBe('error');
      expect(result.error?.code).toBe('EMPTY_CONTENT');
    });
  });

  describe('extractHeadings', () => {
    it('should extract headings from markdown', async () => {
      const input = 'Extract headings from: # Main Title\n## Section 1\n### Subsection\n## Section 2';
      const result = await agent.execute({ input, context: mockContext });
      
      expect(result.type).toBe('json');
      
      const parsed = JSON.parse(result.content);
      expect(parsed.headings).toBeDefined();
      expect(parsed.headings).toHaveLength(4);
      expect(parsed.summary.total).toBe(4);
      expect(parsed.summary.byLevel[1]).toBe(1);
      expect(parsed.summary.byLevel[2]).toBe(2);
      expect(parsed.summary.byLevel[3]).toBe(1);
    });

    it('should handle content with no headings', async () => {
      const input = 'Extract headings from: This is just a paragraph with no headings.';
      const result = await agent.execute({ input, context: mockContext });
      
      expect(result.type).toBe('json');
      const parsed = JSON.parse(result.content);
      expect(parsed.headings).toHaveLength(0);
      expect(parsed.summary.total).toBe(0);
    });
  });

  describe('generateTableOfContents', () => {
    it('should generate table of contents', async () => {
      const input = 'Generate table of contents from: # Main\n## Section 1\n### Sub 1\n## Section 2';
      const result = await agent.execute({ input, context: mockContext });
      
      expect(result.type).toBe('markdown');
      expect(result.content).toContain('# Table of Contents');
      expect(result.content).toContain('- [Main](#main)');
      expect(result.content).toContain('  - [Section 1](#section-1)');
      expect(result.content).toContain('    - [Sub 1](#sub-1)');
      expect(result.content).toContain('  - [Section 2](#section-2)');
    });

    it('should respect max depth', async () => {
      const input = 'Generate table of contents with depth 2 from: # Main\n## Section 1\n### Sub 1\n#### Deep';
      const result = await agent.execute({ input, context: mockContext });
      
      expect(result.type).toBe('markdown');
      expect(result.content).toContain('- [Main](#main)');
      expect(result.content).toContain('  - [Section 1](#section-1)');
      expect(result.content).not.toContain('Sub 1');
      expect(result.content).not.toContain('Deep');
    });
  });

  describe('analyzeStructure', () => {
    it('should analyze markdown structure', async () => {
      const input = 'Analyze structure of: # Title\n\nParagraph 1\n\n- List item 1\n- List item 2\n\n[Link](http://example.com)';
      const result = await agent.execute({ input, context: mockContext });
      
      expect(result.type).toBe('json');
      const structure = JSON.parse(result.content);
      
      expect(structure.headings).toHaveLength(1);
      expect(structure.paragraphs).toBeGreaterThan(0);
      expect(structure.lists).toBeGreaterThan(0);
      expect(structure.links).toBeGreaterThan(0);
      expect(structure.wordCount).toBeGreaterThan(0);
      expect(structure.characterCount).toBeGreaterThan(0);
    });
  });

  describe('extractLinks', () => {
    it('should extract links from markdown', async () => {
      const input = 'Extract links from: [External](https://example.com) [Internal](./page.md) [Email](mailto:test@example.com)';
      const result = await agent.execute({ input, context: mockContext });
      
      expect(result.type).toBe('json');
      const parsed = JSON.parse(result.content);
      
      expect(parsed.links).toHaveLength(3);
      expect(parsed.summary.external).toBe(1);
      expect(parsed.summary.internal).toBe(1);
      expect(parsed.summary.email).toBe(1);
      expect(parsed.summary.total).toBe(3);
    });
  });

  describe('convertToHTML', () => {
    it('should convert markdown to HTML', async () => {
      const input = 'Convert to HTML: # Title\n\n**Bold** text with *italic*';
      const result = await agent.execute({ input, context: mockContext });
      
      expect(result.type).toBe('text');
      expect(result.content).toContain('<h1>Title</h1>');
      expect(result.content).toContain('<strong>Bold</strong>');
      expect(result.content).toContain('<em>italic</em>');
      expect(result.metadata?.contentType).toBe('text/html');
    });
  });

  describe('help', () => {
    it('should provide help information', async () => {
      const input = 'help';
      const result = await agent.execute({ input, context: mockContext });
      
      expect(result.type).toBe('markdown');
      expect(result.content).toContain('# MarkItDown Agent Help');
      expect(result.content).toContain('Available Commands');
      expect(result.content).toContain('Usage Examples');
      expect(result.content).toContain('Supported Formats');
    });
  });

  describe('error handling', () => {
    it('should handle invalid requests gracefully', async () => {
      const input = ''; // Empty input
      const result = await agent.execute({ input, context: mockContext });
      
      expect(result.type).toBe('markdown'); // Should show help
      expect(result.content).toContain('MarkItDown Agent Help');
    });
  });
});