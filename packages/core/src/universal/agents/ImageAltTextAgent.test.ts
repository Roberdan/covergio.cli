/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ImageAltTextAgent, ImageAltTextConfig } from './ImageAltTextAgent.js';
import { AgentConfig } from './types.js';
import { SimpleAgentMemory } from './BaseAgent.js';

describe('ImageAltTextAgent', () => {
  let agent: ImageAltTextAgent;
  let config: AgentConfig;
  let imageAltTextConfig: Partial<ImageAltTextConfig>;

  beforeEach(() => {
    config = {
      id: 'test-image-alt-text-agent',
      domain: 'document-processing',
      role: 'image-accessibility-specialist',
      memory: new SimpleAgentMemory()
    };

    imageAltTextConfig = {
      defaultLanguage: 'en',
      detailLevel: 'detailed',
      maxDescriptionLength: 150,
      includeImageContext: true
    };

    agent = new ImageAltTextAgent(config, imageAltTextConfig);
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(agent.id).toBe('test-image-alt-text-agent');
      expect(agent.state).toBe('initializing');
    });

    it('should have correct capabilities', () => {
      const capabilities = agent.getCapabilities();
      expect(capabilities).toHaveLength(5);
      expect(capabilities.map(c => c.id)).toContain('image-analysis');
      expect(capabilities.map(c => c.id)).toContain('alt-text-generation');
      expect(capabilities.map(c => c.id)).toContain('accessibility-enhancement');
    });

    it('should have correct tools', () => {
      const tools = agent.getTools();
      expect(tools).toHaveLength(7);
      expect(tools.map(t => t.id)).toContain('analyzeImages');
      expect(tools.map(t => t.id)).toContain('generateAltText');
      expect(tools.map(t => t.id)).toContain('processMarkdown');
    });
  });

  describe('Image Analysis', () => {
    it('should extract images from markdown', async () => {
      await agent.initialize();
      
      const markdownContent = `
# Test Document

Here's an image: ![Old alt text](https://example.com/image.jpg)

And another: ![](https://example.com/image2.png)
      `.trim();

      const request = {
        input: `analyze images: ${markdownContent}`,
        context: {
          sessionId: 'test-session',
          executionId: 'test-execution',
          timestamp: new Date(),
          environment: {}
        }
      };

      const response = await agent.execute(request);
      expect(response.type).toBe('json');
      
      const result = JSON.parse(response.content);
      expect(result.analysis.totalImages).toBe(2);
      expect(result.analysis.imagesNeedingAltText).toBe(1); // One has empty alt text
    });

    it('should identify images needing alt-text', async () => {
      await agent.initialize();
      
      const markdownContent = `
![Good description](image1.jpg)
![](image2.jpg)
![placeholder](image3.jpg)
![image](image4.jpg)
      `.trim();

      const request = {
        input: `analyze images: ${markdownContent}`,
        context: {
          sessionId: 'test-session',
          executionId: 'test-execution',
          timestamp: new Date(),
          environment: {}
        }
      };

      const response = await agent.execute(request);
      const result = JSON.parse(response.content);
      
      // Should identify 3 images needing alt-text (empty, "placeholder", "image")
      expect(result.analysis.imagesNeedingAltText).toBe(3);
    });
  });

  describe('Alt-Text Generation', () => {
    it('should generate fallback alt-text for images', async () => {
      await agent.initialize();
      
      const request = {
        input: 'generate alt-text for: https://example.com/sunset-mountains.jpg',
        context: {
          sessionId: 'test-session',
          executionId: 'test-execution',
          timestamp: new Date(),
          environment: {}
        }
      };

      const response = await agent.execute(request);
      expect(response.type).toBe('text');
      expect(response.content).toContain('sunset');
      expect(response.content).toContain('mountains');
      expect(response.content.length).toBeGreaterThan(10);
    });

    it('should process markdown and add alt-text', async () => {
      await agent.initialize();
      
      const markdownContent = `
# Test Document

![](https://example.com/chart-data.png)
Some text about data visualization.
      `.trim();

      const request = {
        input: `process markdown: ${markdownContent}`,
        context: {
          sessionId: 'test-session',
          executionId: 'test-execution',
          timestamp: new Date(),
          environment: {}
        }
      };

      const response = await agent.execute(request);
      expect(response.type).toBe('markdown');
      expect(response.content).toContain('chart');
      expect(response.content).toContain('data');
      expect(response.content).not.toContain('![](');
    });
  });

  describe('Validation', () => {
    it('should validate image alt-text quality', async () => {
      await agent.initialize();
      
      const markdownContent = `
![Good descriptive alt text for accessibility](image1.jpg)
![](image2.jpg)
![image](image3.jpg)
![This is a very long alt text that exceeds the maximum character limit for description and should be flagged as too long](image4.jpg)
      `.trim();

      const request = {
        input: `validate images: ${markdownContent}`,
        context: {
          sessionId: 'test-session',
          executionId: 'test-execution',
          timestamp: new Date(),
          environment: {}
        }
      };

      const response = await agent.execute(request);
      const result = JSON.parse(response.content);
      
      expect(result.summary.totalImages).toBe(4);
      expect(result.summary.totalIssues).toBeGreaterThan(0);
      expect(result.validationResults).toHaveLength(4);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty content gracefully', async () => {
      await agent.initialize();
      
      const request = {
        input: 'analyze images: ',
        context: {
          sessionId: 'test-session',
          executionId: 'test-execution',
          timestamp: new Date(),
          environment: {}
        }
      };

      const response = await agent.execute(request);
      expect(response.type).toBe('error');
      expect(response.error?.code).toBe('EMPTY_CONTENT');
    });

    it('should provide help when requested', async () => {
      await agent.initialize();
      
      const request = {
        input: 'help',
        context: {
          sessionId: 'test-session',
          executionId: 'test-execution',
          timestamp: new Date(),
          environment: {}
        }
      };

      const response = await agent.execute(request);
      expect(response.type).toBe('markdown');
      expect(response.content).toContain('ImageAltText Agent Help');
      expect(response.content).toContain('Available Commands');
    });
  });

  describe('Configuration', () => {
    it('should respect custom configuration settings', () => {
      const customConfig: Partial<ImageAltTextConfig> = {
        detailLevel: 'basic',
        maxDescriptionLength: 100,
        defaultLanguage: 'es'
      };

      const customAgent = new ImageAltTextAgent(config, customConfig);
      
      // Configuration is internal, but we can test through behavior
      expect(customAgent).toBeInstanceOf(ImageAltTextAgent);
    });
  });
});