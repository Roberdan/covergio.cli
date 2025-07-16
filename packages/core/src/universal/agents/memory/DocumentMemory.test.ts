/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentMemory, DocumentMemoryItem, DocumentStructure } from './DocumentMemory.js';
import { DocumentProcessor } from './DocumentProcessor.js';

describe('DocumentMemory', () => {
  let documentMemory: DocumentMemory;

  beforeEach(() => {
    documentMemory = new DocumentMemory();
  });

  describe('Basic Storage Operations', () => {
    it('should store and retrieve documents', async () => {
      const testContent = '# Test Document\n\nThis is a test document.';
      const documentId = await documentMemory.store({
        content: testContent,
        timestamp: new Date(),
        metadata: { type: 'test' }
      });

      expect(documentId).toBeDefined();
      expect(documentId).toMatch(/^doc-\d+$/);

      const retrieved = await documentMemory.getById(documentId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.content).toBe(testContent);
      expect(retrieved?.documentType).toBe('markdown');
    });

    it('should store documents with specific type and structure', async () => {
      const testContent = '# Test Document\n\nThis is a test.';
      const structure: DocumentStructure = {
        type: 'document',
        title: 'Test Document',
        sections: [
          {
            id: 'section-1',
            type: 'heading',
            level: 1,
            title: 'Test Document',
            content: '# Test Document'
          }
        ]
      };

      const documentId = await documentMemory.storeDocument(
        testContent,
        'markdown',
        structure,
        { author: 'test-user' }
      );

      const retrieved = await documentMemory.getById(documentId);
      expect(retrieved?.documentType).toBe('markdown');
      expect(retrieved?.documentStructure?.title).toBe('Test Document');
      expect(retrieved?.metadata?.author).toBe('test-user');
    });

    it('should update documents', async () => {
      const documentId = await documentMemory.store({
        content: 'Original content',
        timestamp: new Date()
      });

      await documentMemory.update(documentId, {
        content: 'Updated content',
        metadata: { updated: true }
      });

      const retrieved = await documentMemory.getById(documentId);
      expect(retrieved?.content).toBe('Updated content');
      expect(retrieved?.metadata?.updated).toBe(true);
    });

    it('should delete documents', async () => {
      const documentId = await documentMemory.store({
        content: 'Test content',
        timestamp: new Date()
      });

      await documentMemory.delete(documentId);

      const retrieved = await documentMemory.getById(documentId);
      expect(retrieved).toBeUndefined();
    });

    it('should clear all documents', async () => {
      await documentMemory.store({
        content: 'Test 1',
        timestamp: new Date()
      });
      await documentMemory.store({
        content: 'Test 2',
        timestamp: new Date()
      });

      expect(documentMemory.getSize()).toBe(2);

      await documentMemory.clear();
      expect(documentMemory.getSize()).toBe(0);
    });
  });

  describe('Document Type Detection', () => {
    it('should detect markdown documents', async () => {
      const markdownContent = '# Title\n\nThis is **bold** text.';
      const documentId = await documentMemory.store({
        content: markdownContent,
        timestamp: new Date()
      });

      const retrieved = await documentMemory.getById(documentId);
      expect(retrieved?.documentType).toBe('markdown');
    });

    it('should detect HTML documents', async () => {
      const htmlContent = '<html><body><h1>Title</h1><p>Content</p></body></html>';
      const documentId = await documentMemory.store({
        content: htmlContent,
        timestamp: new Date()
      });

      const retrieved = await documentMemory.getById(documentId);
      expect(retrieved?.documentType).toBe('html');
    });

    it('should default to text for unknown types', async () => {
      const textContent = 'This is plain text content.';
      const documentId = await documentMemory.store({
        content: textContent,
        timestamp: new Date()
      });

      const retrieved = await documentMemory.getById(documentId);
      expect(retrieved?.documentType).toBe('text');
    });
  });

  describe('Retrieval Operations', () => {
    beforeEach(async () => {
      // Set up test documents
      await documentMemory.storeDocument(
        '# First Document\n\nThis is about cats.',
        'markdown',
        undefined,
        { topic: 'animals' }
      );

      await documentMemory.storeDocument(
        '# Second Document\n\nThis is about dogs.',
        'markdown',
        undefined,
        { topic: 'animals' }
      );

      await documentMemory.storeDocument(
        '<html><body><h1>HTML Document</h1></body></html>',
        'html',
        undefined,
        { topic: 'web' }
      );
    });

    it('should retrieve documents by type', async () => {
      const markdownDocs = await documentMemory.retrieveByType('markdown');
      expect(markdownDocs).toHaveLength(2);
      expect(markdownDocs.every(doc => doc.documentType === 'markdown')).toBe(true);

      const htmlDocs = await documentMemory.retrieveByType('html');
      expect(htmlDocs).toHaveLength(1);
      expect(htmlDocs[0].documentType).toBe('html');
    });

    it('should search documents by content', async () => {
      const results = await documentMemory.searchContent('cats');
      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('cats');

      const animalResults = await documentMemory.searchContent('about');
      expect(animalResults).toHaveLength(2);
    });

    it('should search documents by type and content', async () => {
      const results = await documentMemory.searchContent('about', 'markdown');
      expect(results).toHaveLength(2);
      expect(results.every(doc => doc.documentType === 'markdown')).toBe(true);

      const htmlResults = await documentMemory.searchContent('HTML', 'html');
      expect(htmlResults).toHaveLength(1);
      expect(htmlResults[0].documentType).toBe('html');
    });

    it('should respect limit parameter', async () => {
      const results = await documentMemory.retrieveByType('markdown', 1);
      expect(results).toHaveLength(1);
    });

    it('should return results sorted by timestamp (newest first)', async () => {
      const results = await documentMemory.retrieveByType('markdown');
      expect(results).toHaveLength(2);
      
      // Results should be sorted by timestamp, newest first
      expect(results[0].timestamp.getTime()).toBeGreaterThanOrEqual(
        results[1].timestamp.getTime()
      );
    });
  });

  describe('Structure-based Retrieval', () => {
    beforeEach(async () => {
      const structure1: DocumentStructure = {
        type: 'document',
        title: 'Technical Guide',
        sections: [],
        wordCount: 500,
        language: 'en'
      };

      const structure2: DocumentStructure = {
        type: 'document',
        title: 'User Manual',
        sections: [],
        wordCount: 300,
        language: 'en'
      };

      await documentMemory.storeDocument(
        'Content 1',
        'markdown',
        structure1,
        { category: 'technical' }
      );

      await documentMemory.storeDocument(
        'Content 2',
        'markdown',
        structure2,
        { category: 'documentation' }
      );
    });

    it('should retrieve documents by structure query', async () => {
      const results = await documentMemory.retrieveByStructure({
        title: 'Technical Guide'
      });
      expect(results).toHaveLength(1);
      expect(results[0].documentStructure?.title).toBe('Technical Guide');
    });

    it('should retrieve documents by language', async () => {
      const results = await documentMemory.retrieveByStructure({
        language: 'en'
      });
      expect(results).toHaveLength(2);
    });

    it('should retrieve documents by word count', async () => {
      const results = await documentMemory.retrieveByStructure({
        wordCount: 500
      });
      expect(results).toHaveLength(1);
      expect(results[0].documentStructure?.wordCount).toBe(500);
    });
  });

  describe('Statistics and Analytics', () => {
    beforeEach(async () => {
      await documentMemory.storeDocument('Doc 1', 'markdown');
      await documentMemory.storeDocument('Doc 2', 'markdown');
      await documentMemory.storeDocument('Doc 3', 'html');
      await documentMemory.storeDocument('Longer document content', 'text');
    });

    it('should provide document statistics', async () => {
      const stats = await documentMemory.getStats();
      
      expect(stats.total).toBe(4);
      expect(stats.byType.markdown).toBe(2);
      expect(stats.byType.html).toBe(1);
      expect(stats.byType.text).toBe(1);
      expect(stats.averageSize).toBeGreaterThan(0);
      expect(stats.oldestDocument).toBeInstanceOf(Date);
      expect(stats.newestDocument).toBeInstanceOf(Date);
    });

    it('should handle empty statistics', async () => {
      const emptyMemory = new DocumentMemory();
      const stats = await emptyMemory.getStats();
      
      expect(stats.total).toBe(0);
      expect(stats.byType).toEqual({});
      expect(stats.averageSize).toBe(0);
      expect(stats.oldestDocument).toBeNull();
      expect(stats.newestDocument).toBeNull();
    });
  });

  describe('Memory Management', () => {
    it('should get all document IDs', async () => {
      const id1 = await documentMemory.store({
        content: 'Doc 1',
        timestamp: new Date()
      });
      const id2 = await documentMemory.store({
        content: 'Doc 2',
        timestamp: new Date()
      });

      const ids = await documentMemory.getIds();
      expect(ids).toHaveLength(2);
      expect(ids).toContain(id1);
      expect(ids).toContain(id2);
    });

    it('should track document count', () => {
      expect(documentMemory.getSize()).toBe(0);
    });

    it('should update document structure', async () => {
      const documentId = await documentMemory.store({
        content: 'Original',
        timestamp: new Date()
      });

      const newStructure: DocumentStructure = {
        type: 'document',
        title: 'Updated Title',
        sections: []
      };

      await documentMemory.updateStructure(documentId, newStructure);

      const retrieved = await documentMemory.getById(documentId);
      expect(retrieved?.documentStructure?.title).toBe('Updated Title');
    });
  });

  describe('Query Matching', () => {
    beforeEach(async () => {
      await documentMemory.storeDocument(
        'This document contains important information about testing.',
        'markdown',
        {
          type: 'document',
          title: 'Testing Guide',
          sections: [],
          language: 'en'
        },
        { 
          author: 'John Doe',
          keywords: ['testing', 'documentation', 'guide']
        }
      );
    });

    it('should match content queries', async () => {
      const results = await documentMemory.retrieve('testing');
      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('testing');
    });

    it('should match metadata queries', async () => {
      const results = await documentMemory.retrieve('John Doe');
      expect(results).toHaveLength(1);
      expect(results[0].metadata?.author).toBe('John Doe');
    });

    it('should match structure queries', async () => {
      const results = await documentMemory.retrieve('Testing Guide');
      expect(results).toHaveLength(1);
      expect(results[0].documentStructure?.title).toBe('Testing Guide');
    });

    it('should be case insensitive', async () => {
      const results = await documentMemory.retrieve('TESTING');
      expect(results).toHaveLength(1);
    });
  });
});

describe('DocumentProcessor', () => {
  let processor: DocumentProcessor;

  beforeEach(() => {
    processor = new DocumentProcessor();
  });

  describe('Markdown Processing', () => {
    it('should process markdown document and extract structure', async () => {
      const markdown = `# Main Title

This is a paragraph.

## Subsection

- List item 1
- List item 2

\`\`\`javascript
console.log('Hello');
\`\`\`

![Image](image.jpg)

[Link](https://example.com)

| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
`;

      const result = await processor.processMarkdownDocument(markdown, 'test.md');

      expect(result.documentType).toBe('markdown');
      expect(result.documentStructure?.title).toBe('Main Title');
      expect(result.documentStructure?.sections.length).toBeGreaterThan(7); // Sections include all elements
      expect(result.parseResult?.headings?.length).toBeGreaterThanOrEqual(2);
      expect(result.parseResult?.links?.length).toBeGreaterThanOrEqual(1);
      expect(result.parseResult?.images?.length).toBeGreaterThanOrEqual(1);
      expect(result.parseResult?.tables?.length).toBeGreaterThanOrEqual(1);
      expect(result.parseResult?.codeBlocks?.length).toBeGreaterThanOrEqual(1);
      expect(result.parseResult?.listItems?.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle empty markdown', async () => {
      const result = await processor.processMarkdownDocument('', 'empty.md');
      
      expect(result.documentType).toBe('markdown');
      expect(result.documentStructure?.sections).toHaveLength(0);
      expect(result.parseResult?.headings).toHaveLength(0);
    });

    it('should extract file information', async () => {
      const result = await processor.processMarkdownDocument('# Test', 'test.md');
      
      expect(result.fileInfo?.filename).toBe('test.md');
      expect(result.fileInfo?.size).toBe(6);
      expect(result.fileInfo?.encoding).toBe('utf-8');
      expect(result.fileInfo?.lastModified).toBeInstanceOf(Date);
    });

    it('should calculate metadata', async () => {
      const markdown = 'This is a test document with multiple words.';
      const result = await processor.processMarkdownDocument(markdown);
      
      expect(result.metadata?.wordCount).toBe(8);
      expect(result.metadata?.readingTime).toBe(1); // Assuming 200 words per minute
    });
  });

  describe('Front Matter Processing', () => {
    it('should extract YAML front matter', async () => {
      const markdown = `---
title: Test Document
author: John Doe
tags: test, documentation
---

# Content

This is the main content.`;

      const result = await processor.processMarkdownDocument(markdown);
      
      expect(result.documentStructure?.metadata?.title).toBe('Test Document');
      expect(result.documentStructure?.metadata?.author).toBe('John Doe');
      expect(result.documentStructure?.metadata?.tags).toEqual(['test', 'documentation']);
    });

    it('should handle documents without front matter', async () => {
      const markdown = '# Simple Document\n\nNo front matter here.';
      const result = await processor.processMarkdownDocument(markdown);
      
      expect(result.documentStructure?.metadata?.frontMatter).toBeUndefined();
    });
  });

  describe('Element Extraction', () => {
    it('should extract headings with levels', async () => {
      const markdown = `# Level 1
## Level 2  
### Level 3
#### Level 4`;

      const result = await processor.processMarkdownDocument(markdown);
      const headings = result.parseResult?.headings || [];
      
      expect(headings).toHaveLength(4);
      expect(headings[0].level).toBe(1);
      expect(headings[0].text).toBe('Level 1');
      expect(headings[1].level).toBe(2);
      expect(headings[3].level).toBe(4);
    });

    it('should generate anchors for headings', async () => {
      const markdown = '# My Test Heading!';
      const result = await processor.processMarkdownDocument(markdown);
      const heading = result.parseResult?.headings?.[0];
      
      expect(heading?.anchor).toBe('my-test-heading');
    });

    it('should extract different link types', async () => {
      const markdown = `[Internal](./file.md)
[External](https://example.com)
[Anchor](#section)`;

      const result = await processor.processMarkdownDocument(markdown);
      const links = result.parseResult?.links || [];
      
      expect(links).toHaveLength(3);
      expect(links[0].type).toBe('internal');
      expect(links[1].type).toBe('external');
      expect(links[2].type).toBe('anchor');
    });

    it('should extract list items with types and levels', async () => {
      const markdown = `- Unordered item
  - Nested item
1. Ordered item
2. Another ordered item
- [ ] Unchecked task
- [x] Checked task`;

      const result = await processor.processMarkdownDocument(markdown);
      const listItems = result.parseResult?.listItems || [];
      
      expect(listItems).toHaveLength(6);
      expect(listItems[0].type).toBe('unordered');
      expect(listItems[1].level).toBe(1);
      expect(listItems[2].type).toBe('ordered');
      expect(listItems[4].checked).toBe(false);
      expect(listItems[5].checked).toBe(true);
    });
  });
});