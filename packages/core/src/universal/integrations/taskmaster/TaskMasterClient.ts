/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  TaskMasterConfig, 
  TaskMasterRequest, 
  TaskMasterResponse, 
  TaskMasterError,
  TaskMasterMetrics,
  TaskMasterHealthCheck,
  TaskMasterAnalysisResult,
  RequestContext,
  ApiRateLimit,
  CacheEntry
} from './types.js';

/**
 * Rate limiter for API requests
 */
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refillTokens();
    
    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) * (1000 / this.refillRate);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.refillTokens();
    }
    
    this.tokens -= 1;
  }

  private refillTokens(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = (timePassed / 1000) * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

/**
 * Simple in-memory cache for API responses
 */
class ResponseCache {
  private cache = new Map<string, CacheEntry>();
  private readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    this.timeoutMs = timeoutMs;
  }

  get(key: string): TaskMasterResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt.getTime()) {
      this.cache.delete(key);
      return null;
    }
    
    entry.hits++;
    entry.lastAccessed = new Date();
    return entry.value;
  }

  set(key: string, value: TaskMasterResponse): void {
    const entry: CacheEntry = {
      key,
      value,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + this.timeoutMs),
      hits: 0,
      lastAccessed: new Date()
    };
    
    this.cache.set(key, entry);
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; hitRate: number } {
    const entries = Array.from(this.cache.values());
    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0);
    const hitRate = entries.length > 0 ? totalHits / entries.length : 0;
    
    return {
      size: this.cache.size,
      hitRate
    };
  }
}

/**
 * Task Master AI API Client
 * Provides robust integration with Task-Master-AI service for request analysis,
 * task decomposition, and expertise identification
 */
export class TaskMasterClient {
  private config: TaskMasterConfig;
  private rateLimiter: RateLimiter;
  private cache: ResponseCache;
  private metrics: TaskMasterMetrics;

  constructor(config: Partial<TaskMasterConfig> = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.TASK_MASTER_API_KEY || '',
      baseUrl: config.baseUrl || process.env.TASK_MASTER_BASE_URL || 'https://api.taskmaster.ai',
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      enableCaching: config.enableCaching ?? true,
      cacheTimeoutMs: config.cacheTimeoutMs || 300000, // 5 minutes
      rateLimitPerSecond: config.rateLimitPerSecond || 10,
      enableMetrics: config.enableMetrics ?? true
    };

    this.rateLimiter = new RateLimiter(this.config.rateLimitPerSecond, this.config.rateLimitPerSecond);
    this.cache = new ResponseCache(this.config.cacheTimeoutMs);
    this.metrics = this.initializeMetrics();

    this.validateConfig();
  }

  /**
   * Analyze a request using Task-Master-AI
   */
  async analyzeRequest(request: TaskMasterRequest): Promise<TaskMasterAnalysisResult> {
    const startTime = Date.now();
    const context = this.createRequestContext(request);
    
    try {
      // Validate request
      this.validateRequest(request);
      
      // Check cache first
      const cacheKey = this.generateCacheKey(request);
      let response: TaskMasterResponse | null = null;
      let cached = false;

      if (this.config.enableCaching) {
        response = this.cache.get(cacheKey);
        cached = response !== null;
      }

      if (!response) {
        // Make API request with retry logic
        response = await this.makeRequestWithRetry(request, context);
        
        // Cache successful response
        if (this.config.enableCaching && response.status === 'success') {
          this.cache.set(cacheKey, response);
        }
      }

      // Update metrics
      this.updateMetrics(true, cached, Date.now() - startTime);

      return {
        request,
        response,
        context,
        cached,
        metrics: {
          responseTime: Date.now() - startTime,
          retryCount: context.retryCount,
          cacheHit: cached,
          rateLimited: false
        }
      };
    } catch (error) {
      this.updateMetrics(false, false, Date.now() - startTime);
      
      return {
        request,
        response: this.createErrorResponse(error, context),
        context,
        cached: false,
        error: error as TaskMasterError,
        metrics: {
          responseTime: Date.now() - startTime,
          retryCount: context.retryCount,
          cacheHit: false,
          rateLimited: false
        }
      };
    }
  }

  /**
   * Perform domain detection analysis
   */
  async detectDomains(text: string, context?: Record<string, unknown>): Promise<TaskMasterAnalysisResult> {
    const request: TaskMasterRequest = {
      text,
      analysisType: 'domain-detection',
      context,
      options: {
        decompose: false,
        identifyExperts: false,
        estimateComplexity: true
      }
    };

    return this.analyzeRequest(request);
  }

  /**
   * Perform task decomposition analysis
   */
  async decomposeTask(text: string, context?: Record<string, unknown>): Promise<TaskMasterAnalysisResult> {
    const request: TaskMasterRequest = {
      text,
      analysisType: 'task-decomposition',
      context,
      options: {
        decompose: true,
        identifyExperts: true,
        estimateComplexity: true,
        suggestDependencies: true,
        includeRisks: true
      }
    };

    return this.analyzeRequest(request);
  }

  /**
   * Perform expertise identification analysis
   */
  async identifyExpertise(text: string, context?: Record<string, unknown>): Promise<TaskMasterAnalysisResult> {
    const request: TaskMasterRequest = {
      text,
      analysisType: 'expertise-identification',
      context,
      options: {
        decompose: false,
        identifyExperts: true,
        estimateComplexity: true
      }
    };

    return this.analyzeRequest(request);
  }

  /**
   * Perform complexity analysis
   */
  async analyzeComplexity(text: string, context?: Record<string, unknown>): Promise<TaskMasterAnalysisResult> {
    const request: TaskMasterRequest = {
      text,
      analysisType: 'complexity-analysis',
      context,
      options: {
        decompose: false,
        identifyExperts: false,
        estimateComplexity: true,
        includeRisks: true
      }
    };

    return this.analyzeRequest(request);
  }

  /**
   * Get current metrics
   */
  getMetrics(): TaskMasterMetrics {
    const cacheStats = this.cache.getStats();
    return {
      ...this.metrics,
      cacheHitRate: cacheStats.hitRate
    };
  }

  /**
   * Get health check status
   */
  async getHealthCheck(): Promise<TaskMasterHealthCheck> {
    const startTime = Date.now();
    
    try {
      // Simple health check request
      const healthRequest: TaskMasterRequest = {
        text: 'health check',
        analysisType: 'domain-detection',
        options: { decompose: false }
      };

      const response = await this.makeRequest(healthRequest, this.createRequestContext(healthRequest));
      const responseTime = Date.now() - startTime;

      return {
        status: response.status === 'success' ? 'healthy' : 'degraded',
        timestamp: new Date(),
        responseTime,
        services: {
          api: response.status === 'success' ? 'up' : 'down',
          cache: 'up',
          database: 'up'
        },
        metrics: this.getMetrics()
      };
    } catch (error) {
      return {
        status: 'down',
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        services: {
          api: 'down',
          cache: 'up',
          database: 'unknown'
        },
        metrics: this.getMetrics()
      };
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
  }

  private validateConfig(): void {
    if (!this.config.apiKey) {
      throw new Error('TaskMaster API key is required');
    }
    
    if (!this.config.baseUrl) {
      throw new Error('TaskMaster base URL is required');
    }
    
    if (this.config.timeout < 1000) {
      throw new Error('Timeout must be at least 1000ms');
    }
    
    if (this.config.retryAttempts < 0) {
      throw new Error('Retry attempts must be non-negative');
    }
    
    if (this.config.rateLimitPerSecond <= 0) {
      throw new Error('Rate limit must be at least 1 request per second');
    }
  }

  private validateRequest(request: TaskMasterRequest): void {
    if (!request.text || request.text.trim().length === 0) {
      throw new Error('Request text is required');
    }
    
    if (request.text.length > 10000) {
      throw new Error('Request text exceeds maximum length of 10000 characters');
    }
    
    if (!['domain-detection', 'task-decomposition', 'expertise-identification', 'complexity-analysis'].includes(request.analysisType)) {
      throw new Error('Invalid analysis type');
    }
    
    // Sanitize text input
    request.text = this.sanitizeText(request.text);
  }

  private sanitizeText(text: string): string {
    // Remove potential security threats
    return text
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      .trim();
  }

  private async makeRequestWithRetry(request: TaskMasterRequest, context: RequestContext): Promise<TaskMasterResponse> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        context.retryCount = attempt - 1;
        return await this.makeRequest(request, context);
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on client errors (4xx)
        if (error instanceof Error && error.message.includes('4')) {
          break;
        }
        
        // Don't retry on last attempt
        if (attempt === this.config.retryAttempts) {
          break;
        }
        
        // Exponential backoff
        const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError || new Error('Request failed after all retry attempts');
  }

  private async makeRequest(request: TaskMasterRequest, context: RequestContext): Promise<TaskMasterResponse> {
    // Rate limiting
    await this.rateLimiter.acquire();
    
    // Create request payload
    const payload = {
      ...request,
      requestId: context.requestId,
      timestamp: new Date().toISOString()
    };
    
    // Make HTTP request
    const response = await fetch(`${this.config.baseUrl}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'X-Request-ID': context.requestId,
        'X-Correlation-ID': context.correlationId || ''
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.config.timeout)
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorBody}`);
    }
    
    const result = await response.json();
    
    // Validate response structure
    this.validateResponse(result);
    
    return result;
  }

  private validateResponse(response: any): void {
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid response format');
    }
    
    if (!response.requestId || !response.timestamp || !response.status) {
      throw new Error('Missing required response fields');
    }
    
    if (!['success', 'error', 'partial'].includes(response.status)) {
      throw new Error('Invalid response status');
    }
  }

  private createRequestContext(request: TaskMasterRequest): RequestContext {
    return {
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: request.context?.userId as string,
      projectId: request.context?.projectId as string,
      correlationId: `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      retryCount: 0,
      startTime: new Date(),
      metadata: {}
    };
  }

  private generateCacheKey(request: TaskMasterRequest): string {
    const keyData = {
      text: request.text,
      analysisType: request.analysisType,
      options: request.options
    };
    
    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  private createErrorResponse(error: unknown, context: RequestContext): TaskMasterResponse {
    const errorObj = error as TaskMasterError;
    
    return {
      requestId: context.requestId,
      timestamp: new Date(),
      status: 'error',
      confidence: 0,
      analysis: {
        intent: 'unknown',
        domains: [],
        complexity: 'simple',
        estimatedDuration: 0,
        priority: 'low',
        requiredCapabilities: [],
        riskFactors: [],
        confidence: 0,
        reasoning: 'Request failed due to error',
        tags: [],
        category: 'infrastructure'
      },
      metadata: {
        processingTime: Date.now() - context.startTime.getTime(),
        modelVersion: 'unknown',
        tokensUsed: 0,
        cached: false
      }
    };
  }

  private updateMetrics(success: boolean, cached: boolean, responseTime: number): void {
    if (!this.config.enableMetrics) return;
    
    this.metrics.totalRequests++;
    this.metrics.lastRequestTime = new Date();
    
    if (success) {
      this.metrics.successfulRequests++;
      this.metrics.lastSuccessTime = new Date();
    } else {
      this.metrics.failedRequests++;
      this.metrics.lastErrorTime = new Date();
    }
    
    // Update average response time
    const totalTime = this.metrics.averageResponseTime * Math.max(1, this.metrics.totalRequests - 1) + responseTime;
    this.metrics.averageResponseTime = totalTime / this.metrics.totalRequests;
    
    // Update API health
    const recentFailureRate = this.metrics.failedRequests / Math.max(1, this.metrics.totalRequests);
    if (recentFailureRate > 0.5) {
      this.metrics.apiHealth = 'down';
    } else if (recentFailureRate > 0.2) {
      this.metrics.apiHealth = 'degraded';
    } else {
      this.metrics.apiHealth = 'healthy';
    }
    
    this.metrics.uptime = Date.now() - this.metrics.lastRequestTime!.getTime();
  }

  private initializeMetrics(): TaskMasterMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      rateLimitHits: 0,
      errorsByType: {},
      requestsByAnalysisType: {},
      uptime: 0,
      apiHealth: 'healthy'
    };
  }
}