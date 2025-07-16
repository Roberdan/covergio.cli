/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseAgent } from './BaseAgent.js';
import { AgentConfig, AgentRequest, AgentResponse, Capability, PersonalityTrait, ToolDefinition } from './types.js';
import { DocumentMemory, DocumentMemoryItem, createDocumentMemory } from './memory/DocumentMemory.js';
import { DocumentProcessor, createDocumentProcessor } from './memory/DocumentProcessor.js';
// Use dynamic import to avoid compilation issues
let MarkItDown: any;

/**
 * MarkItDown agent for advanced Markdown document analysis and manipulation
 */
export class MarkItDownAgent extends BaseAgent {
  private markItDown: any;
  private documentMemory: DocumentMemory;
  private documentProcessor: DocumentProcessor;

  constructor(config: AgentConfig) {
    // Set up the agent configuration with MarkItDown-specific details
    const markItDownConfig: AgentConfig = {
      ...config,
      domain: 'document-processing',
      role: 'markdown-specialist',
      capabilities: [
        'markdown-parsing',
        'document-analysis',
        'content-extraction',
        'structure-manipulation',
        'format-conversion'
      ],
      personalityTraits: [
        {
          name: 'analytical',
          value: 0.9,
          description: 'Methodical and systematic approach to document analysis',
          category: 'analytical'
        },
        {
          name: 'precise',
          value: 0.95,
          description: 'High attention to detail and accuracy',
          category: 'analytical'
        },
        {
          name: 'helpful',
          value: 0.8,
          description: 'Focused on providing useful and actionable results',
          category: 'social'
        },
        {
          name: 'technical',
          value: 0.85,
          description: 'Strong technical knowledge of document formats',
          category: 'analytical'
        }
      ],
      tools: [
        'parseMarkdown',
        'extractHeadings',
        'generateTableOfContents',
        'convertToHTML',
        'analyzeStructure',
        'extractLinks',
        'convertDocument'
      ]
    };

    super(markItDownConfig);
    // Initialize markItDown in the initialize method
    this.markItDown = null;
    
    // Initialize document memory and processor
    this.documentMemory = createDocumentMemory();
    this.documentProcessor = createDocumentProcessor();
  }

  /**
   * Initialize the MarkItDown agent
   */
  protected async onInitialize(): Promise<void> {
    try {
      // Dynamically import MarkItDown to avoid compilation issues
      const { MarkItDown } = await import('markitdown-ts');
      this.markItDown = new MarkItDown();
    } catch (error) {
      console.warn('MarkItDown library not available, using fallback implementation');
      this.markItDown = null;
    }

    // Store agent capabilities in memory
    await this.memory.store({
      content: 'MarkItDown agent initialized with capabilities: markdown-parsing, document-analysis, content-extraction, structure-manipulation, format-conversion',
      timestamp: new Date(),
      metadata: {
        type: 'initialization',
        capabilities: this.getCapabilities().map(c => c.id)
      }
    });
  }

  /**
   * Execute a markdown processing task
   */
  protected async executeTask(request: AgentRequest): Promise<AgentResponse> {
    const command = this.parseCommand(request.input);
    
    try {
      switch (command.action) {
        case 'parseMarkdown':
          return await this.parseMarkdown(command.content);
          
        case 'extractHeadings':
          return await this.extractHeadings(command.content);
          
        case 'generateTableOfContents':
          return await this.generateTableOfContents(command.content, command.maxDepth);
          
        case 'convertToHTML':
          return await this.convertToHTML(command.content);
          
        case 'analyzeStructure':
          return await this.analyzeStructure(command.content);
          
        case 'extractLinks':
          return await this.extractLinks(command.content);
          
        case 'convertDocument':
          return await this.convertDocument(command.filePath || command.content);
          
        default:
          return this.getHelpResponse();
      }
    } catch (error) {
      return {
        type: 'error',
        content: `Error processing markdown: ${error instanceof Error ? error.message : String(error)}`,
        context: request.context,
        error: {
          code: 'MARKDOWN_PROCESSING_ERROR',
          message: error instanceof Error ? error.message : String(error),
          details: error
        }
      };
    }
  }

  /**
   * Parse markdown content into structured format
   */
  private async parseMarkdown(content: string): Promise<AgentResponse> {
    if (!content || content.trim() === '') {
      return {
        type: 'error',
        content: 'No markdown content provided to parse',
        error: {
          code: 'EMPTY_CONTENT',
          message: 'Content cannot be empty'
        }
      };
    }

    try {
      let result: any;
      
      if (this.markItDown) {
        // MarkItDown expects file paths, not content directly
        // Create a temporary file if needed or use fallback
        result = {
          text_content: content,
          title: this.extractTitleFromMarkdown(content)
        };
      } else {
        // Fallback implementation
        result = {
          text_content: content,
          title: this.extractTitleFromMarkdown(content)
        };
      }
      
      // Store in document memory
      await this.storeMarkdownDocument(content, undefined, {
        type: 'markdown-parsing',
        originalLength: content.length,
        processedLength: result.text_content?.length || 0
      });
      
      // Store the parsing result in memory
      await this.memory.store({
        content: `Parsed markdown document with ${result.text_content?.length || 0} characters`,
        timestamp: new Date(),
        metadata: {
          type: 'markdown-parsing',
          originalLength: content.length,
          processedLength: result.text_content?.length || 0
        }
      });

      return {
        type: 'markdown',
        content: JSON.stringify({
          textContent: result.text_content,
          metadata: (result as any).metadata || {},
          structure: this.analyzeMarkdownStructure(content)
        }, null, 2),
        metadata: {
          agentId: this.id,
          timestamp: new Date().toISOString(),
          operation: 'parseMarkdown',
          originalLength: content.length
        }
      };
    } catch (error) {
      throw new Error(`Failed to parse markdown: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract all headings from markdown document
   */
  private async extractHeadings(content: string): Promise<AgentResponse> {
    if (!content || content.trim() === '') {
      return {
        type: 'error',
        content: 'No content provided to extract headings from',
        error: {
          code: 'EMPTY_CONTENT',
          message: 'Content cannot be empty'
        }
      };
    }

    try {
      const headings = this.extractHeadingsFromMarkdown(content);
      
      await this.memory.store({
        content: `Extracted ${headings.length} headings from markdown document`,
        timestamp: new Date(),
        metadata: {
          type: 'heading-extraction',
          headingCount: headings.length,
          levels: Array.from(new Set(headings.map(h => h.level)))
        }
      });

      return {
        type: 'json',
        content: JSON.stringify({
          headings,
          summary: {
            total: headings.length,
            byLevel: headings.reduce((acc, h) => {
              acc[h.level] = (acc[h.level] || 0) + 1;
              return acc;
            }, {} as Record<number, number>)
          }
        }, null, 2),
        metadata: {
          agentId: this.id,
          timestamp: new Date().toISOString(),
          operation: 'extractHeadings',
          headingCount: headings.length
        }
      };
    } catch (error) {
      throw new Error(`Failed to extract headings: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate a table of contents from markdown document
   */
  private async generateTableOfContents(content: string, maxDepth: number = 3): Promise<AgentResponse> {
    if (!content || content.trim() === '') {
      return {
        type: 'error',
        content: 'No content provided to generate table of contents from',
        error: {
          code: 'EMPTY_CONTENT',
          message: 'Content cannot be empty'
        }
      };
    }

    try {
      const headings = this.extractHeadingsFromMarkdown(content);
      const filteredHeadings = headings.filter(h => h.level <= maxDepth);
      
      const toc = this.generateTOCMarkdown(filteredHeadings);
      
      await this.memory.store({
        content: `Generated table of contents with ${filteredHeadings.length} entries (max depth: ${maxDepth})`,
        timestamp: new Date(),
        metadata: {
          type: 'toc-generation',
          entryCount: filteredHeadings.length,
          maxDepth,
          totalHeadings: headings.length
        }
      });

      return {
        type: 'markdown',
        content: toc,
        metadata: {
          agentId: this.id,
          timestamp: new Date().toISOString(),
          operation: 'generateTableOfContents',
          entryCount: filteredHeadings.length,
          maxDepth
        }
      };
    } catch (error) {
      throw new Error(`Failed to generate table of contents: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Convert markdown to HTML
   */
  private async convertToHTML(content: string): Promise<AgentResponse> {
    if (!content || content.trim() === '') {
      return {
        type: 'error',
        content: 'No content provided to convert to HTML',
        error: {
          code: 'EMPTY_CONTENT',
          message: 'Content cannot be empty'
        }
      };
    }

    try {
      let result: any;
      
      if (this.markItDown) {
        // Use MarkItDown to convert the content
        result = await this.markItDown.convert(content);
      } else {
        // Fallback implementation - use content directly
        result = {
          text_content: content
        };
      }
      
      // Generate HTML from the processed content
      const html = this.convertTextToHTML(result.text_content || content);
      
      await this.memory.store({
        content: `Converted markdown to HTML (${html.length} characters)`,
        timestamp: new Date(),
        metadata: {
          type: 'html-conversion',
          originalLength: content.length,
          htmlLength: html.length
        }
      });

      return {
        type: 'text',
        content: html,
        metadata: {
          agentId: this.id,
          timestamp: new Date().toISOString(),
          operation: 'convertToHTML',
          originalLength: content.length,
          htmlLength: html.length,
          contentType: 'text/html'
        }
      };
    } catch (error) {
      throw new Error(`Failed to convert to HTML: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Analyze the structure of a markdown document
   */
  private async analyzeStructure(content: string): Promise<AgentResponse> {
    if (!content || content.trim() === '') {
      return {
        type: 'error',
        content: 'No content provided to analyze structure',
        error: {
          code: 'EMPTY_CONTENT',
          message: 'Content cannot be empty'
        }
      };
    }

    try {
      const structure = this.analyzeMarkdownStructure(content);
      
      await this.memory.store({
        content: `Analyzed document structure: ${structure.headings.length} headings, ${structure.paragraphs} paragraphs, ${structure.lists} lists, ${structure.links} links`,
        timestamp: new Date(),
        metadata: {
          type: 'structure-analysis',
          ...structure
        }
      });

      return {
        type: 'json',
        content: JSON.stringify(structure, null, 2),
        metadata: {
          agentId: this.id,
          timestamp: new Date().toISOString(),
          operation: 'analyzeStructure'
        }
      };
    } catch (error) {
      throw new Error(`Failed to analyze structure: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract links from markdown content
   */
  private async extractLinks(content: string): Promise<AgentResponse> {
    if (!content || content.trim() === '') {
      return {
        type: 'error',
        content: 'No content provided to extract links from',
        error: {
          code: 'EMPTY_CONTENT',
          message: 'Content cannot be empty'
        }
      };
    }

    try {
      const links = this.extractLinksFromMarkdown(content);
      
      await this.memory.store({
        content: `Extracted ${links.length} links from markdown document`,
        timestamp: new Date(),
        metadata: {
          type: 'link-extraction',
          linkCount: links.length,
          domains: Array.from(new Set(links.map(l => l.domain).filter(Boolean)))
        }
      });

      return {
        type: 'json',
        content: JSON.stringify({
          links,
          summary: {
            total: links.length,
            external: links.filter(l => l.type === 'external').length,
            internal: links.filter(l => l.type === 'internal').length,
            email: links.filter(l => l.type === 'email').length
          }
        }, null, 2),
        metadata: {
          agentId: this.id,
          timestamp: new Date().toISOString(),
          operation: 'extractLinks',
          linkCount: links.length
        }
      };
    } catch (error) {
      throw new Error(`Failed to extract links: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Convert a document file using MarkItDown
   */
  private async convertDocument(filePath: string): Promise<AgentResponse> {
    if (!filePath || filePath.trim() === '') {
      return {
        type: 'error',
        content: 'No file path provided for document conversion',
        error: {
          code: 'EMPTY_FILE_PATH',
          message: 'File path cannot be empty'
        }
      };
    }

    try {
      let result: any;
      
      if (this.markItDown) {
        result = await this.markItDown.convert(filePath);
      } else {
        // Fallback for file conversion - read the file if it exists
        const fs = await import('fs');
        const path = await import('path');
        
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          result = {
            text_content: content,
            title: path.basename(filePath)
          };
        } else {
          throw new Error(`File not found: ${filePath}`);
        }
      }
      
      await this.memory.store({
        content: `Converted document: ${filePath} (${result.text_content?.length || 0} characters)`,
        timestamp: new Date(),
        metadata: {
          type: 'document-conversion',
          filePath,
          contentLength: result.text_content?.length || 0,
          metadata: (result as any).metadata || {}
        }
      });

      return {
        type: 'text',
        content: result.text_content || '',
        metadata: {
          agentId: this.id,
          timestamp: new Date().toISOString(),
          operation: 'convertDocument',
          filePath,
          contentLength: result.text_content?.length || 0,
          originalMetadata: (result as any).metadata || {}
        }
      };
    } catch (error) {
      throw new Error(`Failed to convert document: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse user command input
   */
  private parseCommand(input: string): {
    action: string;
    content?: string;
    filePath?: string;
    maxDepth?: number;
  } {
    const lowerInput = input.toLowerCase().trim();
    
    // Check for specific commands
    if (lowerInput.includes('parse') || lowerInput.includes('parsing')) {
      return {
        action: 'parseMarkdown',
        content: this.extractContentFromInput(input)
      };
    }
    
    if (lowerInput.includes('heading') || lowerInput.includes('headers')) {
      return {
        action: 'extractHeadings',
        content: this.extractContentFromInput(input)
      };
    }
    
    if (lowerInput.includes('table of contents') || lowerInput.includes('toc')) {
      return {
        action: 'generateTableOfContents',
        content: this.extractContentFromInput(input),
        maxDepth: this.extractMaxDepth(input)
      };
    }
    
    if (lowerInput.includes('html') || lowerInput.includes('convert to html')) {
      return {
        action: 'convertToHTML',
        content: this.extractContentFromInput(input)
      };
    }
    
    if (lowerInput.includes('structure') || lowerInput.includes('analyze')) {
      return {
        action: 'analyzeStructure',
        content: this.extractContentFromInput(input)
      };
    }
    
    if (lowerInput.includes('links') || lowerInput.includes('extract links')) {
      return {
        action: 'extractLinks',
        content: this.extractContentFromInput(input)
      };
    }
    
    if (lowerInput.includes('convert document') || lowerInput.includes('file')) {
      return {
        action: 'convertDocument',
        filePath: this.extractFilePathFromInput(input)
      };
    }
    
    // Default to parsing if markdown content is provided
    if (input.includes('#') || input.includes('```') || input.includes('*')) {
      return {
        action: 'parseMarkdown',
        content: input
      };
    }
    
    return {
      action: 'help',
      content: input
    };
  }

  /**
   * Extract content from user input
   */
  private extractContentFromInput(input: string): string {
    // Look for content after common command patterns
    const patterns = [
      /(?:parse|analyze|convert|extract from|process)\s+(?:this|the following)?\s*:?\s*(.+)/i,
      /```(?:markdown|md)?\s*([\s\S]*?)\s*```/i,
      /(?:markdown|content):\s*(.+)/i,
      /(?:parse|analyze|convert|extract from|process)\s+(?:this|the following)?\s+(.+)/i
    ];
    
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // If no pattern matches, return the input as is
    return input;
  }

  /**
   * Extract file path from user input
   */
  private extractFilePathFromInput(input: string): string {
    const patterns = [
      /(?:file|path|document):\s*([^\s]+)/i,
      /convert\s+(?:document|file)\s+([^\s]+)/i,
      /([^\s]+\.(?:md|txt|html|pdf|docx|doc))/i
    ];
    
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return input;
  }

  /**
   * Store a markdown document in specialized memory
   */
  async storeMarkdownDocument(
    content: string,
    filename?: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    try {
      // Process the document to extract structure
      const processedDoc = await this.documentProcessor.processMarkdownDocument(content, filename);
      
      // Store in document memory
      const documentId = await this.documentMemory.storeDocument(
        content,
        'markdown',
        processedDoc.documentStructure,
        {
          ...processedDoc.metadata,
          ...metadata,
          agentId: this.id,
          processedAt: new Date().toISOString()
        }
      );
      
      // Also store in regular agent memory for general queries
      await this.memory.store({
        content: `Stored markdown document: ${filename || 'untitled'} (${content.length} characters)`,
        timestamp: new Date(),
        metadata: {
          type: 'document-storage',
          documentId,
          filename,
          contentLength: content.length,
          documentType: 'markdown'
        }
      });
      
      return documentId;
    } catch (error) {
      throw new Error(`Failed to store markdown document: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Retrieve markdown documents from memory
   */
  async retrieveMarkdownDocuments(
    query: string,
    limit = 10
  ): Promise<DocumentMemoryItem[]> {
    try {
      return await this.documentMemory.retrieveByType('markdown', limit);
    } catch (error) {
      throw new Error(`Failed to retrieve markdown documents: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Search markdown documents by content
   */
  async searchMarkdownDocuments(
    searchTerm: string,
    limit = 10
  ): Promise<DocumentMemoryItem[]> {
    try {
      return await this.documentMemory.searchContent(searchTerm, 'markdown', limit);
    } catch (error) {
      throw new Error(`Failed to search markdown documents: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get document by ID
   */
  async getDocumentById(documentId: string): Promise<DocumentMemoryItem | undefined> {
    try {
      return await this.documentMemory.getById(documentId);
    } catch (error) {
      throw new Error(`Failed to get document by ID: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get document statistics
   */
  async getDocumentStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    averageSize: number;
    oldestDocument: Date | null;
    newestDocument: Date | null;
  }> {
    try {
      return await this.documentMemory.getStats();
    } catch (error) {
      throw new Error(`Failed to get document statistics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update document structure
   */
  async updateDocumentStructure(
    documentId: string,
    newContent: string,
    filename?: string
  ): Promise<void> {
    try {
      // Re-process the document to get updated structure
      const processedDoc = await this.documentProcessor.processMarkdownDocument(newContent, filename);
      
      // Update the document memory
      await this.documentMemory.update(documentId, {
        content: newContent,
        documentStructure: processedDoc.documentStructure,
        parseResult: processedDoc.parseResult,
        metadata: {
          ...processedDoc.metadata,
          updatedAt: new Date().toISOString(),
          agentId: this.id
        }
      });
      
      // Log the update in regular memory
      await this.memory.store({
        content: `Updated document structure for document ID: ${documentId}`,
        timestamp: new Date(),
        metadata: {
          type: 'document-update',
          documentId,
          contentLength: newContent.length,
          operation: 'structure-update'
        }
      });
    } catch (error) {
      throw new Error(`Failed to update document structure: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete document from memory
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      await this.documentMemory.delete(documentId);
      
      // Log the deletion in regular memory
      await this.memory.store({
        content: `Deleted document ID: ${documentId}`,
        timestamp: new Date(),
        metadata: {
          type: 'document-deletion',
          documentId,
          operation: 'delete'
        }
      });
    } catch (error) {
      throw new Error(`Failed to delete document: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract max depth from user input
   */
  private extractMaxDepth(input: string): number {
    const match = input.match(/(?:depth|level)\s*(\d+)/i);
    if (match && match[1]) {
      const depth = parseInt(match[1], 10);
      return depth > 0 && depth <= 6 ? depth : 3;
    }
    return 3;
  }

  /**
   * Extract headings from markdown content
   */
  private extractHeadingsFromMarkdown(content: string): Array<{
    level: number;
    text: string;
    anchor: string;
  }> {
    const headings: Array<{ level: number; text: string; anchor: string }> = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        const anchor = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
        
        headings.push({ level, text, anchor });
      }
    }
    
    return headings;
  }

  /**
   * Generate table of contents markdown
   */
  private generateTOCMarkdown(headings: Array<{ level: number; text: string; anchor: string }>): string {
    const toc = ['# Table of Contents\n'];
    
    for (const heading of headings) {
      const indent = '  '.repeat(heading.level - 1);
      toc.push(`${indent}- [${heading.text}](#${heading.anchor})`);
    }
    
    return toc.join('\n');
  }

  /**
   * Analyze markdown structure
   */
  private analyzeMarkdownStructure(content: string): any {
    const lines = content.split('\n');
    const structure = {
      headings: this.extractHeadingsFromMarkdown(content),
      paragraphs: 0,
      lists: 0,
      codeBlocks: 0,
      links: 0,
      images: 0,
      tables: 0,
      lineCount: lines.length,
      wordCount: content.split(/\s+/).filter(word => word.length > 0).length,
      characterCount: content.length
    };
    
    let inCodeBlock = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        if (!inCodeBlock) structure.codeBlocks++;
        continue;
      }
      
      if (inCodeBlock) continue;
      
      if (trimmed.length > 0 && !trimmed.startsWith('#') && !trimmed.startsWith('- ') && !trimmed.startsWith('* ') && !trimmed.startsWith('|')) {
        structure.paragraphs++;
      }
      
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\.\s/.test(trimmed)) {
        structure.lists++;
      }
      
      if (trimmed.includes('|') && trimmed.indexOf('|') !== trimmed.lastIndexOf('|')) {
        structure.tables++;
      }
      
      // Count links and images
      const linkMatches = trimmed.match(/\[([^\]]+)\]\(([^)]+)\)/g);
      if (linkMatches) {
        structure.links += linkMatches.length;
      }
      
      const imageMatches = trimmed.match(/!\[([^\]]*)\]\(([^)]+)\)/g);
      if (imageMatches) {
        structure.images += imageMatches.length;
      }
    }
    
    return structure;
  }

  /**
   * Extract links from markdown content
   */
  private extractLinksFromMarkdown(content: string): Array<{
    text: string;
    url: string;
    type: 'external' | 'internal' | 'email';
    domain?: string;
  }> {
    const links: Array<{ text: string; url: string; type: 'external' | 'internal' | 'email'; domain?: string }> = [];
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      const text = match[1];
      const url = match[2];
      
      let type: 'external' | 'internal' | 'email' = 'internal';
      let domain: string | undefined;
      
      if (url.startsWith('mailto:')) {
        type = 'email';
      } else if (url.startsWith('http://') || url.startsWith('https://')) {
        type = 'external';
        try {
          domain = new URL(url).hostname;
        } catch (e) {
          // Invalid URL, treat as internal
          type = 'internal';
        }
      }
      
      links.push({ text, url, type, domain });
    }
    
    return links;
  }

  /**
   * Convert text to basic HTML
   */
  private convertTextToHTML(text: string): string {
    // Basic markdown to HTML conversion
    return text
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^##### (.+)$/gm, '<h5>$1</h5>')
      .replace(/^###### (.+)$/gm, '<h6>$1</h6>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^([^<])/gm, '<p>$1')
      .replace(/([^>])$/gm, '$1</p>');
  }

  /**
   * Extract title from markdown content
   */
  private extractTitleFromMarkdown(content: string): string {
    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^#\s+(.+)$/);
      if (match) {
        return match[1].trim();
      }
    }
    return 'Untitled';
  }

  /**
   * Get help response
   */
  private getHelpResponse(): AgentResponse {
    const helpText = `
# MarkItDown Agent Help

I can help you with various Markdown processing tasks:

## Available Commands:
- **Parse Markdown**: Parse and analyze markdown content
- **Extract Headings**: Extract all headings from a document
- **Generate Table of Contents**: Create a TOC with configurable depth
- **Convert to HTML**: Convert markdown to HTML format
- **Analyze Structure**: Analyze document structure and statistics
- **Extract Links**: Extract all links from the document
- **Convert Document**: Convert various document formats using MarkItDown

## Usage Examples:
- "Parse this markdown: # Hello World"
- "Extract headings from: [content]"
- "Generate table of contents with depth 2"
- "Convert to HTML: **bold text**"
- "Analyze structure of this document"
- "Extract links from markdown content"
- "Convert document: /path/to/file.pdf"

## Supported Formats:
- Markdown (.md, .markdown)
- Plain text (.txt)
- HTML files
- PDF documents
- Word documents (.docx)
- Images (with OCR)
- And more...

Simply provide your markdown content or specify the operation you'd like to perform!
    `.trim();

    return {
      type: 'markdown',
      content: helpText,
      metadata: {
        agentId: this.id,
        timestamp: new Date().toISOString(),
        operation: 'help'
      }
    };
  }

  /**
   * Get agent capabilities
   */
  getCapabilities(): Capability[] {
    return [
      {
        id: 'markdown-parsing',
        name: 'Markdown Parsing',
        description: 'Parse and analyze markdown content structure',
        category: 'technical',
        level: 'expert',
        keywords: ['markdown', 'parsing', 'analysis']
      },
      {
        id: 'document-analysis',
        name: 'Document Analysis',
        description: 'Analyze document structure and extract metadata',
        category: 'analytical',
        level: 'expert',
        keywords: ['document', 'analysis', 'structure']
      },
      {
        id: 'content-extraction',
        name: 'Content Extraction',
        description: 'Extract specific content elements from documents',
        category: 'technical',
        level: 'expert',
        keywords: ['extraction', 'content', 'elements']
      },
      {
        id: 'structure-manipulation',
        name: 'Structure Manipulation',
        description: 'Manipulate and transform document structure',
        category: 'technical',
        level: 'advanced',
        keywords: ['structure', 'manipulation', 'transform']
      },
      {
        id: 'format-conversion',
        name: 'Format Conversion',
        description: 'Convert between different document formats',
        category: 'technical',
        level: 'expert',
        keywords: ['conversion', 'format', 'transform']
      }
    ];
  }

  /**
   * Get agent tools
   */
  getTools(): ToolDefinition[] {
    return [
      {
        id: 'parseMarkdown',
        name: 'Parse Markdown',
        description: 'Parse markdown content into structured format',
        parameters: [
          {
            name: 'content',
            type: 'string',
            description: 'The markdown content to parse',
            required: true
          }
        ],
        category: 'document-processing',
        accessLevel: 'public'
      },
      {
        id: 'extractHeadings',
        name: 'Extract Headings',
        description: 'Extract all headings from markdown document',
        parameters: [
          {
            name: 'content',
            type: 'string',
            description: 'The markdown content to extract headings from',
            required: true
          }
        ],
        category: 'document-processing',
        accessLevel: 'public'
      },
      {
        id: 'generateTableOfContents',
        name: 'Generate Table of Contents',
        description: 'Create a table of contents from markdown document',
        parameters: [
          {
            name: 'content',
            type: 'string',
            description: 'The markdown content to generate TOC from',
            required: true
          },
          {
            name: 'maxDepth',
            type: 'number',
            description: 'Maximum heading depth to include',
            required: false,
            default: 3,
            validation: { min: 1, max: 6 }
          }
        ],
        category: 'document-processing',
        accessLevel: 'public'
      },
      {
        id: 'convertToHTML',
        name: 'Convert to HTML',
        description: 'Convert markdown to HTML format',
        parameters: [
          {
            name: 'content',
            type: 'string',
            description: 'The markdown content to convert',
            required: true
          }
        ],
        category: 'document-processing',
        accessLevel: 'public'
      },
      {
        id: 'analyzeStructure',
        name: 'Analyze Structure',
        description: 'Analyze document structure and provide statistics',
        parameters: [
          {
            name: 'content',
            type: 'string',
            description: 'The markdown content to analyze',
            required: true
          }
        ],
        category: 'document-processing',
        accessLevel: 'public'
      },
      {
        id: 'extractLinks',
        name: 'Extract Links',
        description: 'Extract all links from markdown content',
        parameters: [
          {
            name: 'content',
            type: 'string',
            description: 'The markdown content to extract links from',
            required: true
          }
        ],
        category: 'document-processing',
        accessLevel: 'public'
      },
      {
        id: 'convertDocument',
        name: 'Convert Document',
        description: 'Convert various document formats to markdown',
        parameters: [
          {
            name: 'filePath',
            type: 'string',
            description: 'Path to the document file to convert',
            required: true
          }
        ],
        category: 'document-processing',
        accessLevel: 'public'
      }
    ];
  }
}