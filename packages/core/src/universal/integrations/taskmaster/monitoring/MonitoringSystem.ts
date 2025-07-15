/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';

/**
 * Metric types
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'timer';

/**
 * Metric data point
 */
export interface MetricDataPoint {
  timestamp: Date;
  value: number;
  tags?: Record<string, string>;
}

/**
 * Metric definition
 */
export interface Metric {
  name: string;
  type: MetricType;
  description: string;
  unit?: string;
  dataPoints: MetricDataPoint[];
  labels?: Record<string, string>;
}

/**
 * Alert severity levels
 */
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Alert condition
 */
export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'ne';
  threshold: number;
  duration?: number; // Duration in ms for sustained conditions
}

/**
 * Alert definition
 */
export interface Alert {
  id: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  condition: AlertCondition;
  enabled: boolean;
  lastTriggered?: Date;
  triggerCount: number;
}

/**
 * Alert instance when triggered
 */
export interface TriggeredAlert {
  alert: Alert;
  triggeredAt: Date;
  currentValue: number;
  threshold: number;
  message: string;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * System health status
 */
export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheckResult[];
  lastUpdated: Date;
}

/**
 * Performance metrics for Task-Master-AI operations
 */
export interface TaskMasterPerformanceMetrics {
  // Request metrics
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  
  // API specific metrics
  requestsPerSecond: number;
  errorRate: number;
  timeoutRate: number;
  retryRate: number;
  
  // Cache metrics
  cacheHitRate: number;
  cacheMissRate: number;
  cacheSize: number;
  cacheEvictions: number;
  
  // Resource metrics
  memoryUsage: number;
  cpuUsage: number;
  
  // Feature specific metrics
  decompositionRequests: number;
  expertiseRequests: number;
  analysisRequests: number;
  
  // Quality metrics
  decompositionAccuracy: number;
  expertiseMatchAccuracy: number;
}

/**
 * Monitoring events
 */
export interface MonitoringEvents {
  'metric-recorded': { metric: Metric; value: number };
  'alert-triggered': { alert: TriggeredAlert };
  'alert-resolved': { alert: Alert };
  'health-check-completed': { result: HealthCheckResult };
  'performance-report': { metrics: TaskMasterPerformanceMetrics };
  'threshold-exceeded': { metric: string; value: number; threshold: number };
  'system-degraded': { reason: string; severity: AlertSeverity };
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  metricsRetentionPeriod: number;
  healthCheckInterval: number;
  performanceReportInterval: number;
  alertCooldown: number;
  enabledChecks: string[];
  thresholds: Record<string, number>;
}

/**
 * Comprehensive monitoring system for Task-Master-AI integration
 */
export class MonitoringSystem extends EventEmitter {
  private metrics = new Map<string, Metric>();
  private alerts = new Map<string, Alert>();
  private responseTimes: number[] = [];
  private config: MonitoringConfig;
  private healthCheckTimer?: NodeJS.Timeout;
  private performanceTimer?: NodeJS.Timeout;
  private lastHealthCheck?: SystemHealth;

  constructor(config: Partial<MonitoringConfig> = {}) {
    super();

    this.config = {
      metricsRetentionPeriod: config.metricsRetentionPeriod || 24 * 60 * 60 * 1000, // 24 hours
      healthCheckInterval: config.healthCheckInterval || 30000, // 30 seconds
      performanceReportInterval: config.performanceReportInterval || 60000, // 1 minute
      alertCooldown: config.alertCooldown || 300000, // 5 minutes
      enabledChecks: config.enabledChecks || ['api', 'cache', 'memory', 'performance'],
      thresholds: {
        responseTime: 5000, // 5 seconds
        errorRate: 0.05, // 5%
        memoryUsage: 0.8, // 80%
        cacheHitRate: 0.5, // 50%
        ...config.thresholds
      }
    };

    this.initializeDefaultMetrics();
    this.initializeDefaultAlerts();
    this.startPeriodicTasks();
  }

  /**
   * Record a metric value
   */
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`Metric ${name} not found. Creating basic counter metric.`);
      this.createMetric(name, 'counter', `Auto-created metric: ${name}`);
    }

    const dataPoint: MetricDataPoint = {
      timestamp: new Date(),
      value,
      tags
    };

    const existingMetric = this.metrics.get(name)!;
    existingMetric.dataPoints.push(dataPoint);

    // Clean old data points
    this.cleanOldDataPoints(existingMetric);

    this.emit('metric-recorded', { metric: existingMetric, value });

    // Check alerts for this metric
    this.checkAlertsForMetric(name, value);
  }

  /**
   * Create a new metric
   */
  createMetric(
    name: string,
    type: MetricType,
    description: string,
    unit?: string,
    labels?: Record<string, string>
  ): void {
    const metric: Metric = {
      name,
      type,
      description,
      unit,
      dataPoints: [],
      labels
    };

    this.metrics.set(name, metric);
  }

  /**
   * Get metric by name
   */
  getMetric(name: string): Metric | undefined {
    return this.metrics.get(name);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Metric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get metric value aggregations
   */
  getMetricAggregations(
    name: string,
    timeWindow?: number
  ): {
    current: number;
    average: number;
    min: number;
    max: number;
    count: number;
    rate?: number;
  } | null {
    const metric = this.metrics.get(name);
    if (!metric || metric.dataPoints.length === 0) {
      return null;
    }

    let dataPoints = metric.dataPoints;
    
    if (timeWindow) {
      const cutoff = Date.now() - timeWindow;
      dataPoints = dataPoints.filter(dp => dp.timestamp.getTime() > cutoff);
    }

    if (dataPoints.length === 0) {
      return null;
    }

    const values = dataPoints.map(dp => dp.value);
    const current = values[values.length - 1];
    const sum = values.reduce((a, b) => a + b, 0);
    const average = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    let rate: number | undefined;
    if (timeWindow && dataPoints.length > 1) {
      const timeSpan = dataPoints[dataPoints.length - 1].timestamp.getTime() - 
                     dataPoints[0].timestamp.getTime();
      rate = (sum / timeSpan) * 1000; // per second
    }

    return {
      current,
      average,
      min,
      max,
      count: values.length,
      rate
    };
  }

  /**
   * Create an alert
   */
  createAlert(
    id: string,
    name: string,
    description: string,
    severity: AlertSeverity,
    condition: AlertCondition
  ): void {
    const alert: Alert = {
      id,
      name,
      description,
      severity,
      condition,
      enabled: true,
      triggerCount: 0
    };

    this.alerts.set(id, alert);
  }

  /**
   * Enable/disable an alert
   */
  setAlertEnabled(id: string, enabled: boolean): boolean {
    const alert = this.alerts.get(id);
    if (!alert) {
      return false;
    }

    alert.enabled = enabled;
    return true;
  }

  /**
   * Record API response time
   */
  recordApiResponseTime(responseTime: number, operation: string): void {
    this.responseTimes.push(responseTime);
    
    // Keep only last 1000 response times
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }

    this.recordMetric('api_response_time', responseTime, { operation });
    this.recordMetric('api_request_total', 1, { operation });
  }

  /**
   * Record API error
   */
  recordApiError(error: string, operation: string): void {
    this.recordMetric('api_error_total', 1, { error, operation });
  }

  /**
   * Record cache hit/miss
   */
  recordCacheHit(hit: boolean, key?: string): void {
    this.recordMetric('cache_requests_total', 1, { result: hit ? 'hit' : 'miss' });
    
    if (hit) {
      this.recordMetric('cache_hits_total', 1);
    } else {
      this.recordMetric('cache_misses_total', 1);
    }
  }

  /**
   * Perform health checks
   */
  async performHealthCheck(): Promise<SystemHealth> {
    const checks: HealthCheckResult[] = [];

    if (this.config.enabledChecks.includes('api')) {
      checks.push(await this.checkApiHealth());
    }

    if (this.config.enabledChecks.includes('cache')) {
      checks.push(await this.checkCacheHealth());
    }

    if (this.config.enabledChecks.includes('memory')) {
      checks.push(await this.checkMemoryHealth());
    }

    if (this.config.enabledChecks.includes('performance')) {
      checks.push(await this.checkPerformanceHealth());
    }

    // Determine overall health
    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;
    const degradedCount = checks.filter(c => c.status === 'degraded').length;

    if (unhealthyCount > 0) {
      overall = 'unhealthy';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    }

    const health: SystemHealth = {
      overall,
      checks,
      lastUpdated: new Date()
    };

    this.lastHealthCheck = health;
    
    // Emit health check events
    checks.forEach(check => {
      this.emit('health-check-completed', { result: check });
    });

    return health;
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): TaskMasterPerformanceMetrics {
    const totalRequests = this.getMetricValue('api_request_total') || 0;
    const totalErrors = this.getMetricValue('api_error_total') || 0;
    const cacheHits = this.getMetricValue('cache_hits_total') || 0;
    const cacheMisses = this.getMetricValue('cache_misses_total') || 0;
    const totalCacheRequests = cacheHits + cacheMisses;

    // Calculate response time percentiles
    const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);

    const metrics: TaskMasterPerformanceMetrics = {
      totalRequests,
      successfulRequests: Math.max(0, totalRequests - totalErrors),
      failedRequests: totalErrors,
      averageResponseTime: this.calculateAverageResponseTime(),
      p95ResponseTime: sortedTimes[p95Index] || 0,
      p99ResponseTime: sortedTimes[p99Index] || 0,
      
      requestsPerSecond: this.calculateRequestsPerSecond(),
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      timeoutRate: this.calculateTimeoutRate(),
      retryRate: this.calculateRetryRate(),
      
      cacheHitRate: totalCacheRequests > 0 ? cacheHits / totalCacheRequests : 0,
      cacheMissRate: totalCacheRequests > 0 ? cacheMisses / totalCacheRequests : 0,
      cacheSize: this.getMetricValue('cache_size') || 0,
      cacheEvictions: this.getMetricValue('cache_evictions_total') || 0,
      
      memoryUsage: this.getMemoryUsage(),
      cpuUsage: this.getCpuUsage(),
      
      decompositionRequests: this.getMetricValue('decomposition_requests_total') || 0,
      expertiseRequests: this.getMetricValue('expertise_requests_total') || 0,
      analysisRequests: this.getMetricValue('analysis_requests_total') || 0,
      
      decompositionAccuracy: this.getMetricValue('decomposition_accuracy') || 0,
      expertiseMatchAccuracy: this.getMetricValue('expertise_match_accuracy') || 0
    };

    this.emit('performance-report', { metrics });
    
    return metrics;
  }

  /**
   * Get system health status
   */
  getSystemHealth(): SystemHealth | null {
    return this.lastHealthCheck || null;
  }

  /**
   * Destroy monitoring system
   */
  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    if (this.performanceTimer) {
      clearInterval(this.performanceTimer);
    }

    this.removeAllListeners();
  }

  /**
   * Initialize default metrics
   */
  private initializeDefaultMetrics(): void {
    // API metrics
    this.createMetric('api_request_total', 'counter', 'Total API requests', 'requests');
    this.createMetric('api_response_time', 'histogram', 'API response time', 'milliseconds');
    this.createMetric('api_error_total', 'counter', 'Total API errors', 'errors');
    
    // Cache metrics
    this.createMetric('cache_hits_total', 'counter', 'Total cache hits', 'hits');
    this.createMetric('cache_misses_total', 'counter', 'Total cache misses', 'misses');
    this.createMetric('cache_requests_total', 'counter', 'Total cache requests', 'requests');
    this.createMetric('cache_size', 'gauge', 'Current cache size', 'bytes');
    this.createMetric('cache_evictions_total', 'counter', 'Total cache evictions', 'evictions');
    
    // Task-Master specific metrics
    this.createMetric('decomposition_requests_total', 'counter', 'Total decomposition requests', 'requests');
    this.createMetric('expertise_requests_total', 'counter', 'Total expertise requests', 'requests');
    this.createMetric('analysis_requests_total', 'counter', 'Total analysis requests', 'requests');
    this.createMetric('decomposition_accuracy', 'gauge', 'Decomposition accuracy rate', 'percentage');
    this.createMetric('expertise_match_accuracy', 'gauge', 'Expertise match accuracy rate', 'percentage');
    
    // System metrics
    this.createMetric('memory_usage', 'gauge', 'Memory usage', 'bytes');
    this.createMetric('cpu_usage', 'gauge', 'CPU usage', 'percentage');
  }

  /**
   * Initialize default alerts
   */
  private initializeDefaultAlerts(): void {
    this.createAlert(
      'high_response_time',
      'High Response Time',
      'API response time is too high',
      'warning',
      { metric: 'api_response_time', operator: 'gt', threshold: this.config.thresholds.responseTime }
    );

    this.createAlert(
      'high_error_rate',
      'High Error Rate',
      'API error rate is too high',
      'error',
      { metric: 'api_error_total', operator: 'gt', threshold: this.config.thresholds.errorRate }
    );

    this.createAlert(
      'low_cache_hit_rate',
      'Low Cache Hit Rate',
      'Cache hit rate is too low',
      'warning',
      { metric: 'cache_hits_total', operator: 'lt', threshold: this.config.thresholds.cacheHitRate }
    );

    this.createAlert(
      'high_memory_usage',
      'High Memory Usage',
      'Memory usage is too high',
      'critical',
      { metric: 'memory_usage', operator: 'gt', threshold: this.config.thresholds.memoryUsage }
    );
  }

  /**
   * Check alerts for a specific metric
   */
  private checkAlertsForMetric(metricName: string, value: number): void {
    for (const alert of this.alerts.values()) {
      if (!alert.enabled || alert.condition.metric !== metricName) {
        continue;
      }

      // Check cooldown period
      if (alert.lastTriggered) {
        const timeSinceLastTrigger = Date.now() - alert.lastTriggered.getTime();
        if (timeSinceLastTrigger < this.config.alertCooldown) {
          continue;
        }
      }

      const conditionMet = this.evaluateCondition(alert.condition, value);
      
      if (conditionMet) {
        this.triggerAlert(alert, value);
      }
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateCondition(condition: AlertCondition, value: number): boolean {
    switch (condition.operator) {
      case 'gt': return value > condition.threshold;
      case 'lt': return value < condition.threshold;
      case 'eq': return value === condition.threshold;
      case 'gte': return value >= condition.threshold;
      case 'lte': return value <= condition.threshold;
      case 'ne': return value !== condition.threshold;
      default: return false;
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(alert: Alert, currentValue: number): void {
    alert.lastTriggered = new Date();
    alert.triggerCount++;

    const triggeredAlert: TriggeredAlert = {
      alert,
      triggeredAt: new Date(),
      currentValue,
      threshold: alert.condition.threshold,
      message: `${alert.name}: ${alert.condition.metric} is ${currentValue} (threshold: ${alert.condition.threshold})`
    };

    this.emit('alert-triggered', { alert: triggeredAlert });
  }

  /**
   * Clean old data points from metric
   */
  private cleanOldDataPoints(metric: Metric): void {
    const cutoff = Date.now() - this.config.metricsRetentionPeriod;
    metric.dataPoints = metric.dataPoints.filter(dp => dp.timestamp.getTime() > cutoff);
  }

  /**
   * Get metric value (latest data point)
   */
  private getMetricValue(name: string): number | null {
    const metric = this.metrics.get(name);
    if (!metric || metric.dataPoints.length === 0) {
      return null;
    }

    return metric.dataPoints[metric.dataPoints.length - 1].value;
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(): number {
    if (this.responseTimes.length === 0) return 0;
    return this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
  }

  /**
   * Calculate requests per second
   */
  private calculateRequestsPerSecond(): number {
    const recentRequests = this.getMetricAggregations('api_request_total', 60000); // Last minute
    return recentRequests?.rate || 0;
  }

  /**
   * Calculate timeout rate
   */
  private calculateTimeoutRate(): number {
    const timeouts = this.getMetricValue('api_timeout_total') || 0;
    const total = this.getMetricValue('api_request_total') || 0;
    return total > 0 ? timeouts / total : 0;
  }

  /**
   * Calculate retry rate
   */
  private calculateRetryRate(): number {
    const retries = this.getMetricValue('api_retry_total') || 0;
    const total = this.getMetricValue('api_request_total') || 0;
    return total > 0 ? retries / total : 0;
  }

  /**
   * Get memory usage
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  /**
   * Get CPU usage (simplified)
   */
  private getCpuUsage(): number {
    // In a real implementation, you would calculate actual CPU usage
    // For now, return a placeholder value
    return 0;
  }

  /**
   * Check API health
   */
  private async checkApiHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const errorRate = this.calculateTimeoutRate();
      const avgResponseTime = this.calculateAverageResponseTime();
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'API is responding normally';

      if (errorRate > 0.1) {
        status = 'unhealthy';
        message = `High error rate: ${(errorRate * 100).toFixed(1)}%`;
      } else if (errorRate > 0.05 || avgResponseTime > 2000) {
        status = 'degraded';
        message = `Elevated error rate or response time`;
      }

      return {
        name: 'api',
        status,
        message,
        duration: Date.now() - startTime,
        timestamp: new Date(),
        metadata: { errorRate, avgResponseTime }
      };
    } catch (error) {
      return {
        name: 'api',
        status: 'unhealthy',
        message: `Health check failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: new Date()
      };
    }
  }

  /**
   * Check cache health
   */
  private async checkCacheHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const hitRate = this.getPerformanceMetrics().cacheHitRate;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'Cache is performing well';

      if (hitRate < 0.3) {
        status = 'degraded';
        message = `Low cache hit rate: ${(hitRate * 100).toFixed(1)}%`;
      }

      return {
        name: 'cache',
        status,
        message,
        duration: Date.now() - startTime,
        timestamp: new Date(),
        metadata: { hitRate }
      };
    } catch (error) {
      return {
        name: 'cache',
        status: 'unhealthy',
        message: `Cache health check failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: new Date()
      };
    }
  }

  /**
   * Check memory health
   */
  private async checkMemoryHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const memoryUsage = this.getMemoryUsage();
      const memoryLimit = 512 * 1024 * 1024; // 512MB limit
      const usagePercent = memoryUsage / memoryLimit;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'Memory usage is normal';

      if (usagePercent > 0.9) {
        status = 'unhealthy';
        message = `Critical memory usage: ${(usagePercent * 100).toFixed(1)}%`;
      } else if (usagePercent > 0.7) {
        status = 'degraded';
        message = `High memory usage: ${(usagePercent * 100).toFixed(1)}%`;
      }

      return {
        name: 'memory',
        status,
        message,
        duration: Date.now() - startTime,
        timestamp: new Date(),
        metadata: { memoryUsage, usagePercent }
      };
    } catch (error) {
      return {
        name: 'memory',
        status: 'unhealthy',
        message: `Memory health check failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: new Date()
      };
    }
  }

  /**
   * Check performance health
   */
  private async checkPerformanceHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const metrics = this.getPerformanceMetrics();
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'Performance is good';

      if (metrics.p95ResponseTime > 5000 || metrics.errorRate > 0.1) {
        status = 'unhealthy';
        message = 'Poor performance detected';
      } else if (metrics.p95ResponseTime > 2000 || metrics.errorRate > 0.05) {
        status = 'degraded';
        message = 'Performance degradation detected';
      }

      return {
        name: 'performance',
        status,
        message,
        duration: Date.now() - startTime,
        timestamp: new Date(),
        metadata: { 
          p95ResponseTime: metrics.p95ResponseTime, 
          errorRate: metrics.errorRate 
        }
      };
    } catch (error) {
      return {
        name: 'performance',
        status: 'unhealthy',
        message: `Performance health check failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: new Date()
      };
    }
  }

  /**
   * Start periodic tasks
   */
  private startPeriodicTasks(): void {
    // Health checks
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);

    // Performance reports
    this.performanceTimer = setInterval(() => {
      this.getPerformanceMetrics();
    }, this.config.performanceReportInterval);
  }
}

// Type the EventEmitter properly
export interface MonitoringSystem {
  on<K extends keyof MonitoringEvents>(event: K, listener: (data: MonitoringEvents[K]) => void): this;
  emit<K extends keyof MonitoringEvents>(event: K, data: MonitoringEvents[K]): boolean;
}