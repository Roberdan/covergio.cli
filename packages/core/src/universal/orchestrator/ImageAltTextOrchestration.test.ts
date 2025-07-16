/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UniversalOrchestrator } from './UniversalOrchestrator.js';
import { AgentFactory } from '../agents/AgentFactory.js';
import { ImageAltTextAgent } from '../agents/ImageAltTextAgent.js';

// Mock the required dependencies
vi.mock('../agents/ImageAltTextAgent.js');
vi.mock('../agents/MarkItDownAgent.js');

describe('ImageAltTextOrchestration', () => {
  let orchestrator: UniversalOrchestrator;
  let mockEventSystem: any;
  let mockRequestAnalyzer: any;
  let mockRequestRouter: any;
  let mockWorkflowManager: any;

  beforeEach(() => {
    // Mock dependencies
    mockEventSystem = {
      initialize: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      terminate: vi.fn().mockResolvedValue(undefined)
    };

    mockRequestAnalyzer = {
      analyze: vi.fn().mockResolvedValue({
        intent: 'image-processing',
        complexity: 'medium',
        priority: 'medium',
        requiredCapabilities: ['image-analysis', 'alt-text-generation']
      })
    };

    mockRequestRouter = {
      route: vi.fn()
    };

    mockWorkflowManager = {
      createWorkflow: vi.fn(),
      executeWorkflow: vi.fn()
    };

    const config = {
      orchestrator: {
        id: 'test-orchestrator',
        maxAgents: 10,
        timeout: 30000
      }
    };

    orchestrator = new UniversalOrchestrator(
      config,
      mockRequestAnalyzer,
      mockRequestRouter,
      mockWorkflowManager,
      mockEventSystem
    );
  });

  describe('Agent Registration', () => {
    it('should register ImageAltText agent during initialization', async () => {
      await orchestrator.initialize();
      
      const imageAgent = orchestrator.getAgent('image-alt-text-specialist');
      expect(imageAgent).toBeDefined();
      expect(imageAgent?.type).toBe('image-alt-text-specialist');
      expect(imageAgent?.status).toBe('idle');
    });

    it('should have correct image processing capabilities', async () => {
      await orchestrator.initialize();
      
      const imageAgent = orchestrator.getAgent('image-alt-text-specialist');
      expect(imageAgent?.capabilities).toHaveLength(3);
      
      const capabilityNames = imageAgent?.capabilities.map(cap => cap.name);
      expect(capabilityNames).toContain('image-analysis');
      expect(capabilityNames).toContain('alt-text-generation');
      expect(capabilityNames).toContain('accessibility-enhancement');
    });
  });

  describe('Request Detection', () => {
    it('should detect image-related keywords', async () => {
      await orchestrator.initialize();
      
      const imageRequests = [
        { userInput: 'Generate alt text for this image' },
        { userInput: 'Analyze image accessibility' },
        { userInput: 'Describe this image for screen readers' },
        { userInput: 'Process markdown with ![image](url.jpg)' },
        { userInput: 'Fix alt-text in this document' }
      ];

      for (const request of imageRequests) {
        // Access the private method via reflection for testing
        const isImageRequest = (orchestrator as any).isImageProcessingRequest(request);
        expect(isImageRequest).toBe(true);
      }
    });

    it('should detect markdown image syntax', async () => {
      await orchestrator.initialize();
      
      const syntaxRequests = [
        { userInput: 'Process this markdown: ![alt text](image.png)' },
        { userInput: 'Handle <img src="image.jpg" alt="">' },
        { userInput: 'Fix ![](broken-image.gif)' }
      ];

      for (const request of syntaxRequests) {
        const isImageRequest = (orchestrator as any).isImageProcessingRequest(request);
        expect(isImageRequest).toBe(true);
      }
    });

    it('should detect image file extensions', async () => {
      await orchestrator.initialize();
      
      const fileRequests = [
        { userInput: 'Process photo.jpg for accessibility' },
        { userInput: 'Handle diagram.png alt text' },
        { userInput: 'Fix screenshot.gif descriptions' },
        { userInput: 'Analyze chart.svg for screen readers' }
      ];

      for (const request of fileRequests) {
        const isImageRequest = (orchestrator as any).isImageProcessingRequest(request);
        expect(isImageRequest).toBe(true);
      }
    });

    it('should not detect non-image requests', async () => {
      await orchestrator.initialize();
      
      const nonImageRequests = [
        { userInput: 'Create a new project' },
        { userInput: 'Analyze data trends' },
        { userInput: 'Write documentation' },
        { userInput: 'Parse JSON data' }
      ];

      for (const request of nonImageRequests) {
        const isImageRequest = (orchestrator as any).isImageProcessingRequest(request);
        expect(isImageRequest).toBe(false);
      }
    });
  });

  describe('Agent Routing', () => {
    it('should route image requests to ImageAltText agent', async () => {
      // Mock the ImageAltTextAgent constructor
      const mockAgent = {
        execute: vi.fn().mockResolvedValue({
          type: 'json',
          content: JSON.stringify({
            analysis: {
              totalImages: 2,
              imagesNeedingAltText: 1
            }
          })
        })
      };

      vi.mocked(ImageAltTextAgent).mockImplementation(() => mockAgent as any);

      await orchestrator.initialize();
      
      const request = {
        id: 'test-request-1',
        userInput: 'Generate alt text for images in this markdown',
        sessionId: 'test-session'
      };

      const result = await orchestrator.orchestrate(request);
      
      expect(result.workflow.name).toBe('Image Alt-Text Processing Workflow');
      expect(result.agents[0].type).toBe('image-alt-text-specialist');
      expect(result.status).toBe('completed');
    });

    it('should update agent status during processing', async () => {
      const mockAgent = {
        execute: vi.fn().mockResolvedValue({
          type: 'text',
          content: 'Alt text generated successfully'
        })
      };

      vi.mocked(ImageAltTextAgent).mockImplementation(() => mockAgent as any);

      await orchestrator.initialize();
      
      const imageAgent = orchestrator.getAgent('image-alt-text-specialist');
      expect(imageAgent?.status).toBe('idle');

      const request = {
        id: 'test-request-2',
        userInput: 'Analyze image accessibility',
        sessionId: 'test-session'
      };

      await orchestrator.orchestrate(request);
      
      // Agent should be back to idle after processing
      expect(imageAgent?.status).toBe('idle');
      expect(imageAgent?.performance.tasksCompleted).toBe(1);
    });

    it('should handle agent processing errors gracefully', async () => {
      const mockAgent = {
        execute: vi.fn().mockRejectedValue(new Error('Processing failed'))
      };

      vi.mocked(ImageAltTextAgent).mockImplementation(() => mockAgent as any);

      await orchestrator.initialize();
      
      const request = {
        id: 'test-request-3',
        userInput: 'Process image for alt text',
        sessionId: 'test-session'
      };

      // Should fall back to default orchestration without throwing
      const result = await orchestrator.orchestrate(request);
      
      // Agent should be reset to idle even after error
      const imageAgent = orchestrator.getAgent('image-alt-text-specialist');
      expect(imageAgent?.status).toBe('idle');
    });
  });

  describe('Agent Discovery', () => {
    it('should find agents by image processing capabilities', async () => {
      await orchestrator.initialize();
      
      const imageAnalysisAgents = orchestrator.getAgentsByCapability('image-analysis');
      expect(imageAnalysisAgents).toHaveLength(1);
      expect(imageAnalysisAgents[0].id).toBe('image-alt-text-specialist');

      const altTextAgents = orchestrator.getAgentsByCapability('alt-text-generation');
      expect(altTextAgents).toHaveLength(1);
      expect(altTextAgents[0].id).toBe('image-alt-text-specialist');

      const accessibilityAgents = orchestrator.getAgentsByCapability('accessibility-enhancement');
      expect(accessibilityAgents).toHaveLength(1);
      expect(accessibilityAgents[0].id).toBe('image-alt-text-specialist');
    });

    it('should include image agent in idle agents list', async () => {
      await orchestrator.initialize();
      
      const idleAgents = orchestrator.getIdleAgents();
      const imageAgent = idleAgents.find(agent => agent.type === 'image-alt-text-specialist');
      
      expect(imageAgent).toBeDefined();
      expect(imageAgent?.status).toBe('idle');
    });
  });

  describe('Performance Tracking', () => {
    it('should track agent performance metrics', async () => {
      const mockAgent = {
        execute: vi.fn().mockResolvedValue({
          type: 'markdown',
          content: '![Generated alt text](image.jpg)'
        })
      };

      vi.mocked(ImageAltTextAgent).mockImplementation(() => mockAgent as any);

      await orchestrator.initialize();
      
      const imageAgent = orchestrator.getAgent('image-alt-text-specialist');
      const initialTasksCompleted = imageAgent?.performance.tasksCompleted || 0;

      const request = {
        id: 'test-request-4',
        userInput: 'Enhance image accessibility',
        sessionId: 'test-session'
      };

      await orchestrator.orchestrate(request);
      
      expect(imageAgent?.performance.tasksCompleted).toBe(initialTasksCompleted + 1);
      expect(imageAgent?.performance.successRate).toBe(0.90);
    });
  });

  describe('Integration with Other Agents', () => {
    it('should not interfere with markdown agent routing', async () => {
      await orchestrator.initialize();
      
      const markdownRequest = {
        id: 'test-request-5',
        userInput: 'Parse markdown headings',
        sessionId: 'test-session'
      };

      const isImageRequest = (orchestrator as any).isImageProcessingRequest(markdownRequest);
      const isMarkdownRequest = (orchestrator as any).isMarkdownRequest(markdownRequest);
      
      expect(isImageRequest).toBe(false);
      expect(isMarkdownRequest).toBe(true);
    });

    it('should handle requests with both image and markdown content', async () => {
      await orchestrator.initialize();
      
      const combinedRequest = {
        id: 'test-request-6',
        userInput: 'Process markdown document with ![image](chart.png) and generate alt text',
        sessionId: 'test-session'
      };

      const isImageRequest = (orchestrator as any).isImageProcessingRequest(combinedRequest);
      const isMarkdownRequest = (orchestrator as any).isMarkdownRequest(combinedRequest);
      
      // Should be detected as image request (takes priority in current implementation)
      expect(isImageRequest).toBe(true);
      expect(isMarkdownRequest).toBe(true);
    });
  });
});