/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TaskMasterClient } from './TaskMasterClient.js';
import { TaskMasterRequest, TaskMasterResponse } from './types.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('TaskMasterClient', () => {
  let client: TaskMasterClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.mocked(fetch);
    mockFetch.mockReset();
    
    client = new TaskMasterClient({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.test.com',
      timeout: 5000,
      retryAttempts: 2,
      retryDelay: 100,
      enableCaching: true,
      cacheTimeoutMs: 1000,
      rateLimitPerSecond: 100,
      enableMetrics: true
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const defaultClient = new TaskMasterClient({ apiKey: 'test-key' });
      expect(defaultClient.getMetrics().totalRequests).toBe(0);
    });

    it('should throw error for missing API key', () => {
      expect(() => new TaskMasterClient({ apiKey: '' })).toThrow('TaskMaster API key is required');
    });

    it('should throw error for invalid timeout', () => {
      expect(() => new TaskMasterClient({ 
        apiKey: 'test', 
        timeout: 500 
      })).toThrow('Timeout must be at least 1000ms');
    });

    it('should throw error for negative retry attempts', () => {
      expect(() => new TaskMasterClient({ 
        apiKey: 'test', 
        retryAttempts: -1 
      })).toThrow('Retry attempts must be non-negative');
    });

    it('should throw error for invalid rate limit', () => {
      expect(() => new TaskMasterClient({ 
        apiKey: 'test', 
        rateLimitPerSecond: 0 
      })).toThrow('Rate limit must be at least 1 request per second');
    });
  });

  describe('analyzeRequest', () => {
    const mockRequest: TaskMasterRequest = {
      text: 'Test request',
      analysisType: 'domain-detection',
      options: { decompose: false }
    };

    const mockResponse: TaskMasterResponse = {
      requestId: 'test-request-id',
      timestamp: new Date(),
      status: 'success',
      confidence: 0.9,
      analysis: {
        intent: 'test intent',
        domains: ['testing'],
        complexity: 'simple',
        estimatedDuration: 1000,
        priority: 'medium',
        requiredCapabilities: ['testing'],
        riskFactors: [],
        confidence: 0.9,
        reasoning: 'Test reasoning',
        tags: ['test'],
        category: 'test'
      },
      metadata: {
        processingTime: 100,
        modelVersion: 'test-v1',
        tokensUsed: 50,
        cached: false
      }
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      } as Response);
    });

    it('should make successful API request', async () => {
      const result = await client.analyzeRequest(mockRequest);
      
      expect(result.request).toEqual(mockRequest);
      expect(result.response.status).toBe('success');
      expect(result.cached).toBe(false);
      expect(result.metrics.responseTime).toBeGreaterThan(0);
    });

    it('should validate request text', async () => {
      const invalidRequest = { ...mockRequest, text: '' };
      
      const result = await client.analyzeRequest(invalidRequest);
      expect(result.error).toBeDefined();
      expect(result.error!.message).toBe('Request text is required');
    });

    it('should sanitize malicious input', async () => {
      const maliciousRequest = { 
        ...mockRequest, 
        text: 'Test <script>alert("xss")</script> request' 
      };
      
      await client.analyzeRequest(maliciousRequest);
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('Test  request')
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      } as Response);
      
      const result = await client.analyzeRequest(mockRequest);
      
      expect(result.response.status).toBe('error');
      expect(result.error).toBeDefined();
    });

    it('should implement retry logic', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Server Error'
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        } as Response);
      
      const result = await client.analyzeRequest(mockRequest);
      
      expect(result.response.status).toBe('success');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should cache successful responses', async () => {
      // First request
      const result1 = await client.analyzeRequest(mockRequest);
      expect(result1.cached).toBe(false);
      
      // Second identical request should be cached
      const result2 = await client.analyzeRequest(mockRequest);
      expect(result2.cached).toBe(true);
      
      // Should only call fetch once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockRejectedValue(new Error('Request timeout'));
      
      const result = await client.analyzeRequest(mockRequest);
      expect(result.error).toBeDefined();
      expect(result.error!.message).toBe('Request timeout');
    });

    it('should update metrics correctly', async () => {
      await client.analyzeRequest(mockRequest);
      
      const metrics = client.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
    });
  });

  describe('domain detection', () => {
    it('should detect domains correctly', async () => {
      const mockResponse: TaskMasterResponse = {
        requestId: 'test-id',
        timestamp: new Date(),
        status: 'success',
        confidence: 0.8,
        analysis: {
          intent: 'domain analysis',
          domains: ['web-development', 'frontend'],
          complexity: 'medium',
          estimatedDuration: 3600,
          priority: 'high',
          requiredCapabilities: ['react', 'typescript'],
          riskFactors: ['time-pressure'],
          confidence: 0.8,
          reasoning: 'Frontend development task',
          tags: ['react', 'web'],
          category: 'feature'
        },
        metadata: {
          processingTime: 150,
          modelVersion: 'v1.0',
          tokensUsed: 75,
          cached: false
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await client.detectDomains('Create a React component');
      
      expect(result.response.analysis.domains).toContain('web-development');
      expect(result.response.analysis.domains).toContain('frontend');
    });
  });

  describe('task decomposition', () => {
    it('should decompose complex tasks', async () => {
      const mockResponse: TaskMasterResponse = {
        requestId: 'test-id',
        timestamp: new Date(),
        status: 'success',
        confidence: 0.9,
        analysis: {
          intent: 'task decomposition',
          domains: ['web-development'],
          complexity: 'complex',
          estimatedDuration: 7200,
          priority: 'high',
          requiredCapabilities: ['react', 'testing', 'api'],
          riskFactors: ['complexity', 'integration'],
          confidence: 0.9,
          reasoning: 'Complex full-stack task',
          tags: ['fullstack', 'complex'],
          category: 'feature'
        },
        decomposition: {
          subtasks: [
            {
              id: 'sub-1',
              title: 'Create API endpoints',
              description: 'Build REST API',
              complexity: 'medium',
              estimatedDuration: 2400,
              requiredCapabilities: ['api', 'nodejs'],
              dependencies: [],
              priority: 'high',
              acceptanceCriteria: ['API responds correctly'],
              riskLevel: 'low',
              tags: ['api'],
              canRunInParallel: false
            }
          ],
          dependencies: [],
          criticalPath: ['sub-1'],
          estimatedTotalDuration: 7200,
          parallelizationOpportunities: [],
          riskAssessment: {
            overallRisk: 'medium',
            riskFactors: [],
            mitigationStrategies: [],
            contingencyPlans: []
          },
          milestones: []
        },
        metadata: {
          processingTime: 200,
          modelVersion: 'v1.0',
          tokensUsed: 100,
          cached: false
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await client.decomposeTask('Build a full-stack application');
      
      expect(result.response.decomposition).toBeDefined();
      expect(result.response.decomposition!.subtasks).toHaveLength(1);
      expect(result.response.decomposition!.subtasks[0].title).toBe('Create API endpoints');
    });
  });

  describe('expertise identification', () => {
    it('should identify required expertise', async () => {
      const mockResponse: TaskMasterResponse = {
        requestId: 'test-id',
        timestamp: new Date(),
        status: 'success',
        confidence: 0.85,
        analysis: {
          intent: 'expertise identification',
          domains: ['devops', 'cloud'],
          complexity: 'complex',
          estimatedDuration: 5400,
          priority: 'high',
          requiredCapabilities: ['aws', 'kubernetes', 'docker'],
          riskFactors: ['security', 'scalability'],
          confidence: 0.85,
          reasoning: 'Cloud infrastructure task',
          tags: ['devops', 'cloud'],
          category: 'infrastructure'
        },
        recommendations: {
          expertiseNeeded: [
            {
              domain: 'devops',
              level: 'expert',
              importance: 'critical',
              alternatives: ['cloud-architect'],
              timeAllocation: 80
            }
          ],
          toolsRecommended: ['kubectl', 'terraform'],
          bestPractices: ['infrastructure-as-code'],
          commonPitfalls: ['security-misconfig'],
          resourceAllocation: {
            developers: 0,
            testers: 0,
            designers: 0,
            devops: 1,
            projectManagers: 0,
            totalEffort: 5400,
            peakConcurrency: 1,
            timeline: []
          },
          testingStrategy: {
            approach: 'integration',
            coverage: 90,
            automationLevel: 'high',
            tools: ['pytest'],
            phases: [],
            riskAreas: ['security']
          },
          qualityGates: []
        },
        metadata: {
          processingTime: 180,
          modelVersion: 'v1.0',
          tokensUsed: 90,
          cached: false
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await client.identifyExpertise('Deploy application to Kubernetes');
      
      expect(result.response.recommendations).toBeDefined();
      expect(result.response.recommendations!.expertiseNeeded).toHaveLength(1);
      expect(result.response.recommendations!.expertiseNeeded[0].domain).toBe('devops');
    });
  });

  describe('complexity analysis', () => {
    it('should analyze task complexity', async () => {
      const mockResponse: TaskMasterResponse = {
        requestId: 'test-id',
        timestamp: new Date(),
        status: 'success',
        confidence: 0.9,
        analysis: {
          intent: 'complexity analysis',
          domains: ['machine-learning'],
          complexity: 'expert',
          estimatedDuration: 14400,
          priority: 'high',
          requiredCapabilities: ['pytorch', 'python', 'statistics'],
          riskFactors: ['model-accuracy', 'data-quality'],
          confidence: 0.9,
          reasoning: 'Advanced ML task requiring expertise',
          tags: ['ml', 'ai'],
          category: 'research'
        },
        metadata: {
          processingTime: 220,
          modelVersion: 'v1.0',
          tokensUsed: 110,
          cached: false
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await client.analyzeComplexity('Build neural network for image recognition');
      
      expect(result.response.analysis.complexity).toBe('expert');
      expect(result.response.analysis.requiredCapabilities).toContain('pytorch');
    });
  });

  describe('health check', () => {
    it('should return healthy status for successful check', async () => {
      const mockResponse: TaskMasterResponse = {
        requestId: 'health-check',
        timestamp: new Date(),
        status: 'success',
        confidence: 1.0,
        analysis: {
          intent: 'health check',
          domains: [],
          complexity: 'simple',
          estimatedDuration: 0,
          priority: 'low',
          requiredCapabilities: [],
          riskFactors: [],
          confidence: 1.0,
          reasoning: 'Health check',
          tags: [],
          category: 'infrastructure'
        },
        metadata: {
          processingTime: 10,
          modelVersion: 'v1.0',
          tokensUsed: 5,
          cached: false
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const health = await client.getHealthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.services.api).toBe('up');
      expect(health.responseTime).toBeGreaterThan(0);
    });

    it('should return down status for failed check', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      const health = await client.getHealthCheck();
      
      expect(health.status).toBe('down');
      expect(health.services.api).toBe('down');
    });
  });

  describe('cache management', () => {
    it('should clear cache successfully', async () => {
      const mockResponse: TaskMasterResponse = {
        requestId: 'test-id',
        timestamp: new Date(),
        status: 'success',
        confidence: 0.9,
        analysis: {
          intent: 'test',
          domains: ['testing'],
          complexity: 'simple',
          estimatedDuration: 1000,
          priority: 'low',
          requiredCapabilities: [],
          riskFactors: [],
          confidence: 0.9,
          reasoning: 'Test',
          tags: [],
          category: 'test'
        },
        metadata: {
          processingTime: 100,
          modelVersion: 'v1.0',
          tokensUsed: 50,
          cached: false
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const request: TaskMasterRequest = {
        text: 'Test request',
        analysisType: 'domain-detection'
      };

      // Make request to populate cache
      await client.analyzeRequest(request);
      
      // Make same request again (should be cached)
      const result1 = await client.analyzeRequest(request);
      expect(result1.cached).toBe(true);
      
      // Clear cache
      client.clearCache();
      
      // Make request again (should not be cached)
      const result2 = await client.analyzeRequest(request);
      expect(result2.cached).toBe(false);
    });
  });

  describe('metrics management', () => {
    it('should track metrics correctly', async () => {
      const mockResponse: TaskMasterResponse = {
        requestId: 'test-id',
        timestamp: new Date(),
        status: 'success',
        confidence: 0.9,
        analysis: {
          intent: 'test',
          domains: ['testing'],
          complexity: 'simple',
          estimatedDuration: 1000,
          priority: 'low',
          requiredCapabilities: [],
          riskFactors: [],
          confidence: 0.9,
          reasoning: 'Test',
          tags: [],
          category: 'test'
        },
        metadata: {
          processingTime: 100,
          modelVersion: 'v1.0',
          tokensUsed: 50,
          cached: false
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const request: TaskMasterRequest = {
        text: 'Test request',
        analysisType: 'domain-detection'
      };

      await client.analyzeRequest(request);
      
      const metrics = client.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.apiHealth).toBe('healthy');
    });

    it('should reset metrics correctly', async () => {
      const mockResponse: TaskMasterResponse = {
        requestId: 'test-id',
        timestamp: new Date(),
        status: 'success',
        confidence: 0.9,
        analysis: {
          intent: 'test',
          domains: ['testing'],
          complexity: 'simple',
          estimatedDuration: 1000,
          priority: 'low',
          requiredCapabilities: [],
          riskFactors: [],
          confidence: 0.9,
          reasoning: 'Test',
          tags: [],
          category: 'test'
        },
        metadata: {
          processingTime: 100,
          modelVersion: 'v1.0',
          tokensUsed: 50,
          cached: false
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const request: TaskMasterRequest = {
        text: 'Test request',
        analysisType: 'domain-detection'
      };

      await client.analyzeRequest(request);
      
      let metrics = client.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      
      client.resetMetrics();
      
      metrics = client.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
    });
  });

  describe('rate limiting', () => {
    it('should respect rate limits', async () => {
      const rateLimitedClient = new TaskMasterClient({
        apiKey: 'test-key',
        rateLimitPerSecond: 1
      });

      const mockResponse: TaskMasterResponse = {
        requestId: 'test-id',
        timestamp: new Date(),
        status: 'success',
        confidence: 0.9,
        analysis: {
          intent: 'test',
          domains: ['testing'],
          complexity: 'simple',
          estimatedDuration: 1000,
          priority: 'low',
          requiredCapabilities: [],
          riskFactors: [],
          confidence: 0.9,
          reasoning: 'Test',
          tags: [],
          category: 'test'
        },
        metadata: {
          processingTime: 100,
          modelVersion: 'v1.0',
          tokensUsed: 50,
          cached: false
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const request: TaskMasterRequest = {
        text: 'Test request',
        analysisType: 'domain-detection'
      };

      vi.useFakeTimers();
      
      const startTime = Date.now();
      
      // Make two requests quickly
      const promise1 = rateLimitedClient.analyzeRequest(request);
      const promise2 = rateLimitedClient.analyzeRequest(request);
      
      // First request should complete quickly
      vi.advanceTimersByTime(100);
      await promise1;
      
      // Second request should be delayed by rate limiting
      vi.advanceTimersByTime(900);
      await promise2;
      
      vi.useRealTimers();
      
      // Both requests should eventually complete
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});