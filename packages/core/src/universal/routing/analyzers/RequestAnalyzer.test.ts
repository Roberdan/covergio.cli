/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RequestAnalyzer } from './RequestAnalyzer.js';
import { OrchestrationRequest } from '../../interfaces/IOrchestrator.js';

describe('RequestAnalyzer', () => {
  let analyzer: RequestAnalyzer;
  let baseRequest: OrchestrationRequest;

  beforeEach(() => {
    analyzer = new RequestAnalyzer();
    baseRequest = {
      id: 'test-request',
      userInput: '',
      sessionContext: {
        sessionId: 'test-session',
        workspaceRoot: '/test',
        timestamp: new Date(),
        metadata: {},
      },
      timestamp: new Date(),
    };
  });

  describe('complexity analysis', () => {
    it('should classify simple requests correctly', async () => {
      const simpleRequests = [
        'Hi',
        'What is this?',
        'Help',
        'Can you?',
      ];

      for (const input of simpleRequests) {
        const request = { ...baseRequest, userInput: input };
        const analysis = await analyzer.analyze(request);
        expect(analysis.complexity).toBe('simple');
      }
    });

    it('should classify medium complexity requests correctly', async () => {
      const mediumRequests = [
        'Create a new function',
        'Analyze this code',
        'Generate documentation',
        'Review my implementation',
        'Test the application',
      ];

      for (const input of mediumRequests) {
        const request = { ...baseRequest, userInput: input };
        const analysis = await analyzer.analyze(request);
        expect(analysis.complexity).toBe('medium');
      }
    });

    it('should classify complex requests correctly', async () => {
      const complexRequests = [
        'Design a complete architecture for microservices',
        'Refactor and optimize the entire codebase',
        'Orchestrate multiple services and coordinate deployment',
        'Build multiple components and integrate them with various APIs and different databases',
      ];

      for (const input of complexRequests) {
        const request = { ...baseRequest, userInput: input };
        const analysis = await analyzer.analyze(request);
        expect(analysis.complexity).toBe('complex');
      }
    });
  });

  describe('domain identification', () => {
    it('should identify code-generation domain', async () => {
      const codeRequests = [
        'Write a TypeScript function',
        'Create a React component',
        'Generate an API endpoint',
        'Build a Python script',
      ];

      for (const input of codeRequests) {
        const request = { ...baseRequest, userInput: input };
        const analysis = await analyzer.analyze(request);
        expect(analysis.domains).toContain('code-generation');
      }
    });

    it('should identify documentation domain', async () => {
      const docRequests = [
        'Write documentation for this API',
        'Create a README file',
        'Generate a user guide',
        'Update the docs',
      ];

      for (const input of docRequests) {
        const request = { ...baseRequest, userInput: input };
        const analysis = await analyzer.analyze(request);
        expect(analysis.domains).toContain('documentation');
      }
    });

    it('should identify testing domain', async () => {
      const testRequests = [
        'Write unit tests',
        'Create integration tests',
        'Add Jest specs',
        'Test with Vitest',
      ];

      for (const input of testRequests) {
        const request = { ...baseRequest, userInput: input };
        const analysis = await analyzer.analyze(request);
        expect(analysis.domains).toContain('testing');
      }
    });

    it('should identify multiple domains', async () => {
      const multiDomainRequest = { 
        ...baseRequest, 
        userInput: 'Create a TypeScript function and write unit tests for it' 
      };
      
      const analysis = await analyzer.analyze(multiDomainRequest);
      expect(analysis.domains).toContain('code-generation');
      expect(analysis.domains).toContain('testing');
    });

    it('should default to general domain when no specific match', async () => {
      const generalRequest = { ...baseRequest, userInput: 'Something unrelated to anything specific' };
      const analysis = await analyzer.analyze(generalRequest);
      expect(analysis.domains).toContain('general');
    });
  });

  describe('capability determination', () => {
    it('should map domains to appropriate capabilities', async () => {
      const codeRequest = { ...baseRequest, userInput: 'Write a function' };
      const analysis = await analyzer.analyze(codeRequest);
      
      expect(analysis.requiredCapabilities).toContain('text-generation');
      expect(analysis.requiredCapabilities).toContain('code-assistance');
    });

    it('should provide default capabilities for general requests', async () => {
      const generalRequest = { ...baseRequest, userInput: 'Something unrelated to anything specific' };
      const analysis = await analyzer.analyze(generalRequest);
      
      expect(analysis.requiredCapabilities).toContain('text-generation');
      expect(analysis.requiredCapabilities).toContain('general-assistance');
    });
  });

  describe('intent extraction', () => {
    it('should extract action-based intents', async () => {
      const actionRequests = [
        { input: 'create a new file', expectedAction: 'create' },
        { input: 'analyze the performance', expectedAction: 'analyze' },
        { input: 'refactor this code', expectedAction: 'refactor' },
        { input: 'test the application', expectedAction: 'test' },
      ];

      for (const { input, expectedAction } of actionRequests) {
        const request = { ...baseRequest, userInput: input };
        const analysis = await analyzer.analyze(request);
        expect(analysis.intent.toLowerCase()).toContain(expectedAction);
      }
    });

    it('should handle requests without clear action verbs', async () => {
      const vagueRequest = { ...baseRequest, userInput: 'something about files' };
      const analysis = await analyzer.analyze(vagueRequest);
      
      expect(analysis.intent).toBeTruthy();
      expect(analysis.intent.length).toBeGreaterThan(0);
    });
  });

  describe('priority determination', () => {
    it('should respect explicit request priority', async () => {
      const highPriorityRequest = { 
        ...baseRequest, 
        userInput: 'Create a function',
        priority: 'high' as const
      };
      
      const analysis = await analyzer.analyze(highPriorityRequest);
      expect(analysis.priority).toBe('high');
    });

    it('should detect urgent keywords', async () => {
      const urgentRequests = [
        'Fix this ASAP',
        'Urgent: deploy immediately',
        'Critical error now',
        'Emergency patch needed',
      ];

      for (const input of urgentRequests) {
        const request = { ...baseRequest, userInput: input };
        const analysis = await analyzer.analyze(request);
        expect(['high', 'critical']).toContain(analysis.priority);
      }
    });

    it('should detect low priority keywords', async () => {
      const lowPriorityRequests = [
        'Update this later',
        'Eventually we should fix',
        'When you can, please update',
        'No rush on this task',
      ];

      for (const input of lowPriorityRequests) {
        const request = { ...baseRequest, userInput: input };
        const analysis = await analyzer.analyze(request);
        expect(analysis.priority).toBe('low');
      }
    });

    it('should map complexity to priority appropriately', async () => {
      const complexRequest = { ...baseRequest, userInput: 'Design and architect a complete system' };
      const analysis = await analyzer.analyze(complexRequest);
      expect(analysis.priority).toBe('high');
    });
  });

  describe('duration estimation', () => {
    it('should estimate longer duration for complex tasks', async () => {
      const simpleRequest = { ...baseRequest, userInput: 'Hello' };
      const complexRequest = { ...baseRequest, userInput: 'Design and implement a complete microservices architecture' };
      
      const simpleAnalysis = await analyzer.analyze(simpleRequest);
      const complexAnalysis = await analyzer.analyze(complexRequest);
      
      expect(complexAnalysis.estimatedDuration).toBeGreaterThan(simpleAnalysis.estimatedDuration);
    });

    it('should factor in multiple domains', async () => {
      const singleDomainRequest = { ...baseRequest, userInput: 'Write a function' };
      const multiDomainRequest = { ...baseRequest, userInput: 'Write a function, test it, and document it' };
      
      const singleAnalysis = await analyzer.analyze(singleDomainRequest);
      const multiAnalysis = await analyzer.analyze(multiDomainRequest);
      
      expect(multiAnalysis.estimatedDuration).toBeGreaterThan(singleAnalysis.estimatedDuration);
    });
  });

  describe('input validation', () => {
    it('should handle empty or invalid input', async () => {
      const invalidRequests = [
        '',
        '   ',
        null as unknown as string,
        undefined as unknown as string,
      ];

      for (const input of invalidRequests) {
        const request = { ...baseRequest, userInput: input };
        const canHandle = await analyzer.canHandle(request);
        expect(canHandle).toBe(false);
      }
    });

    it('should detect spam or inappropriate content', async () => {
      const spamRequests = [
        'aaaaaaaaaaaaaaaaaaa', // Repeated characters
        '!@#$%^&*()', // Too many special characters
        'spam spam spam',
      ];

      for (const input of spamRequests) {
        const request = { ...baseRequest, userInput: input };
        const canHandle = await analyzer.canHandle(request);
        expect(canHandle).toBe(false);
      }
    });

    it('should accept valid requests', async () => {
      const validRequests = [
        'Hello, can you help me?',
        'Create a new function',
        'What is the weather like?',
      ];

      for (const input of validRequests) {
        const request = { ...baseRequest, userInput: input };
        const canHandle = await analyzer.canHandle(request);
        expect(canHandle).toBe(true);
      }
    });
  });

  describe('metadata generation', () => {
    it('should generate comprehensive metadata', async () => {
      const request = { 
        ...baseRequest, 
        userInput: 'Can you help me create a new function?' 
      };
      
      const analysis = await analyzer.analyze(request);
      
      expect(analysis.metadata.originalInput).toBe(request.userInput);
      expect(analysis.metadata.normalizedInput).toBeTruthy();
      expect(analysis.metadata.wordCount).toBeGreaterThan(0);
      expect(analysis.metadata.hasQuestions).toBe(true);
      expect(analysis.metadata.hasCommands).toBe(true);
      expect(analysis.metadata.timestamp).toBeTruthy();
    });

    it('should correctly identify questions', async () => {
      const questionRequest = { ...baseRequest, userInput: 'What is this?' };
      const statementRequest = { ...baseRequest, userInput: 'Create a function' };
      
      const questionAnalysis = await analyzer.analyze(questionRequest);
      const statementAnalysis = await analyzer.analyze(statementRequest);
      
      expect(questionAnalysis.metadata.hasQuestions).toBe(true);
      expect(statementAnalysis.metadata.hasQuestions).toBe(false);
    });

    it('should correctly identify commands', async () => {
      const commandRequest = { ...baseRequest, userInput: 'Please create a function' };
      const directRequest = { ...baseRequest, userInput: 'New function needed' };
      
      const commandAnalysis = await analyzer.analyze(commandRequest);
      const directAnalysis = await analyzer.analyze(directRequest);
      
      expect(commandAnalysis.metadata.hasCommands).toBe(true);
      expect(directAnalysis.metadata.hasCommands).toBe(false);
    });
  });

  describe('input normalization', () => {
    it('should normalize special characters and whitespace', async () => {
      const messyRequest = { 
        ...baseRequest, 
        userInput: '  Create   a    function!!!   @#$%   ' 
      };
      
      const analysis = await analyzer.analyze(messyRequest);
      expect(analysis.metadata.normalizedInput).toBe('create a function');
    });

    it('should preserve question marks', async () => {
      const questionRequest = { ...baseRequest, userInput: 'What is this???' };
      const analysis = await analyzer.analyze(questionRequest);
      
      expect(analysis.metadata.normalizedInput).toContain('?');
    });
  });
});