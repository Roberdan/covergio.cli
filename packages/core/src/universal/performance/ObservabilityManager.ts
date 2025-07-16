/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { MetricsCollector, MetricType } from './MetricsCollector.js';
import { OpenTelemetryIntegration, type Span, type SpanContext } from './OpenTelemetryIntegration.js';

/**
 * Correlation ID context for request tracking
 */
export interface CorrelationContext {
  correlationId: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  operationName: string;
  startTime: number;
  parentContext?: CorrelationContext;
}

/**
 * Business metric definition
 */
export interface BusinessMetricDefinition {
  name: string;
  type: MetricType;
  description: string;
  labels: string[];
  businessValue: 'high' | 'medium' | 'low';
  alertThresholds?: {
    warning: number;
    critical: number;
  };
  sli?: boolean; // Service Level Indicator
}

/**
 * Observability configuration
 */
export interface ObservabilityConfig {
  serviceName: string;
  environment: string;
  enableMetrics: boolean;
  enableTracing: boolean;
  enableProfiling: boolean;
  correlationIdHeader: string;
  businessMetrics: BusinessMetricDefinition[];
  sampleRate: number;
  exportInterval: number;
  retentionPeriod: number;
}

/**
 * Service Level Indicator (SLI) configuration
 */
export interface SLIConfig {
  name: string;
  description: string;
  metricName: string;
  threshold: number;
  timeWindow: number;
  objective: number; // SLO percentage (e.g., 99.9)
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  name: string;
  metricName: string;
  condition: 'greater_than' | 'less_than' | 'equal_to' | 'not_equal_to';
  threshold: number;
  duration: number;
  severity: 'info' | 'warning' | 'critical';
  description: string;
}

/**
 * Performance baseline for comparison
 */
export interface PerformanceBaseline {
  metricName: string;
  baselineValue: number;
  confidence: number;
  measuredAt: number;
  sampleSize: number;
  variance: number;
}

/**
 * Comprehensive Observability Manager
 */
export class ObservabilityManager extends EventEmitter {
  private config: ObservabilityConfig;
  private metricsCollector: MetricsCollector;
  private otelIntegration: OpenTelemetryIntegration;
  private correlationContexts = new Map<string, CorrelationContext>();
  private businessMetrics = new Map<string, BusinessMetricDefinition>();
  private sliConfigs = new Map<string, SLIConfig>();
  private alertConfigs = new Map<string, AlertConfig>();
  private performanceBaselines = new Map<string, PerformanceBaseline>();
  private monitoringInterval?: NodeJS.Timeout;
  private alertCheckInterval?: NodeJS.Timeout;

  constructor(config: Partial<ObservabilityConfig> = {}) {
    super();

    this.config = {
      serviceName: 'convergio-cli',
      environment: process.env.NODE_ENV || 'development',
      enableMetrics: true,
      enableTracing: true,
      enableProfiling: false,
      correlationIdHeader: 'x-correlation-id',
      businessMetrics: [],
      sampleRate: 0.1,
      exportInterval: 30000,
      retentionPeriod: 86400000, // 24 hours
      ...config
    };

    this.initialize();
  }

  /**
   * Initialize observability components
   */
  private initialize(): void {
    // Initialize metrics collector
    this.metricsCollector = new MetricsCollector({
      enableCollection: this.config.enableMetrics,
      collectionInterval: 5000,
      enableAutoCorrelation: true
    });

    // Initialize OpenTelemetry integration
    this.otelIntegration = new OpenTelemetryIntegration({
      serviceName: this.config.serviceName,
      environment: this.config.environment,
      enableMetrics: this.config.enableMetrics,
      enableTracing: this.config.enableTracing,
      sampling: {
        strategy: 'probabilistic',
        rate: this.config.sampleRate
      }
    });

    this.setupBusinessMetrics();
    this.setupDefaultSLIs();
    this.setupDefaultAlerts();
    this.startMonitoring();

    this.emit('initialized', {
      serviceName: this.config.serviceName,
      environment: this.config.environment
    });
  }

  /**
   * Setup business metrics from configuration
   */
  private setupBusinessMetrics(): void {
    // Register default business metrics
    const defaultBusinessMetrics: BusinessMetricDefinition[] = [
      {
        name: 'requests_total',
        type: MetricType.COUNTER,
        description: 'Total number of requests processed',
        labels: ['method', 'status', 'endpoint'],
        businessValue: 'high',
        sli: true
      },
      {
        name: 'request_duration_seconds',
        type: MetricType.HISTOGRAM,
        description: 'Request processing duration in seconds',
        labels: ['method', 'endpoint'],
        businessValue: 'high',
        alertThresholds: { warning: 1.0, critical: 2.0 },
        sli: true
      },
      {
        name: 'error_rate',
        type: MetricType.GAUGE,
        description: 'Error rate percentage',
        labels: ['service', 'endpoint'],
        businessValue: 'high',
        alertThresholds: { warning: 5.0, critical: 10.0 },
        sli: true
      },
      {
        name: 'user_sessions_active',
        type: MetricType.GAUGE,
        description: 'Number of active user sessions',
        labels: ['region'],
        businessValue: 'medium'
      },
      {
        name: 'agent_execution_total',
        type: MetricType.COUNTER,
        description: 'Total agent executions',
        labels: ['agent_type', 'success'],
        businessValue: 'high'
      },
      {
        name: 'conversion_funnel_step',
        type: MetricType.COUNTER,
        description: 'User progression through conversion funnel',
        labels: ['step', 'user_type'],
        businessValue: 'high'
      }
    ];

    // Merge with configuration metrics
    const allMetrics = [...defaultBusinessMetrics, ...this.config.businessMetrics];

    for (const metric of allMetrics) {
      this.businessMetrics.set(metric.name, metric);
      this.metricsCollector.registerMetric({
        name: metric.name,
        type: metric.type,
        description: metric.description
      });
    }
  }

  /**
   * Setup default Service Level Indicators
   */
  private setupDefaultSLIs(): void {
    const defaultSLIs: SLIConfig[] = [
      {
        name: 'availability',
        description: 'Service availability percentage',
        metricName: 'requests_total',
        threshold: 500, // HTTP 5xx errors
        timeWindow: 300000, // 5 minutes
        objective: 99.9
      },
      {
        name: 'latency',
        description: 'Request latency percentile',
        metricName: 'request_duration_seconds',
        threshold: 1.0, // 1 second
        timeWindow: 300000,
        objective: 95.0
      },
      {
        name: 'error_budget',
        description: 'Error budget consumption rate',
        metricName: 'error_rate',
        threshold: 1.0, // 1% error rate
        timeWindow: 3600000, // 1 hour
        objective: 99.0
      }
    ];

    for (const sli of defaultSLIs) {
      this.sliConfigs.set(sli.name, sli);
    }
  }

  /**
   * Setup default alerts
   */
  private setupDefaultAlerts(): void {
    const defaultAlerts: AlertConfig[] = [
      {
        name: 'high_error_rate',
        metricName: 'error_rate',
        condition: 'greater_than',
        threshold: 5.0,
        duration: 300000, // 5 minutes
        severity: 'warning',
        description: 'Error rate above 5% for 5 minutes'
      },
      {
        name: 'critical_error_rate',
        metricName: 'error_rate',
        condition: 'greater_than',
        threshold: 10.0,
        duration: 180000, // 3 minutes
        severity: 'critical',
        description: 'Error rate above 10% for 3 minutes'
      },
      {
        name: 'high_latency',
        metricName: 'request_duration_seconds',
        condition: 'greater_than',
        threshold: 2.0,
        duration: 600000, // 10 minutes
        severity: 'warning',
        description: 'Request latency above 2 seconds for 10 minutes'
      }
    ];

    for (const alert of defaultAlerts) {
      this.alertConfigs.set(alert.name, alert);
    }
  }

  /**
   * Start monitoring and health checks
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.calculateSLIs();
      this.updatePerformanceBaselines();
    }, 30000); // Every 30 seconds

    this.alertCheckInterval = setInterval(() => {
      this.checkAlerts();
    }, 60000); // Every minute
  }

  /**
   * Create a new correlation context
   */
  createCorrelationContext(
    operationName: string,
    parentContext?: CorrelationContext,
    requestHeaders?: Record<string, string>
  ): CorrelationContext {
    const correlationId = requestHeaders?.[this.config.correlationIdHeader] || 
                         this.generateCorrelationId();

    const context: CorrelationContext = {
      correlationId,
      requestId: requestHeaders?.['x-request-id'],
      userId: requestHeaders?.['x-user-id'],
      sessionId: requestHeaders?.['x-session-id'],
      operationName,
      startTime: Date.now(),
      parentContext
    };

    this.correlationContexts.set(correlationId, context);
    return context;
  }

  /**
   * Start traced operation
   */
  startOperation(
    operationName: string,
    correlationContext?: CorrelationContext,
    tags: Record<string, any> = {}
  ): {
    span: Span;
    context: CorrelationContext;
    timer: () => void;
  } {
    // Create correlation context if not provided
    const context = correlationContext || this.createCorrelationContext(operationName);

    // Extract parent span context if exists
    let parentSpanContext: SpanContext | undefined;
    if (context.parentContext) {
      // In a real implementation, this would extract from the parent's span
      parentSpanContext = undefined;
    }

    // Start span
    const span = this.otelIntegration.startSpan(operationName, parentSpanContext, {
      'correlation.id': context.correlationId,
      'request.id': context.requestId,
      'user.id': context.userId,
      'session.id': context.sessionId,
      ...tags
    });

    // Start metrics timer
    const timer = this.metricsCollector.startTimer(
      `${operationName}_duration_seconds`,
      {
        operation: operationName,
        service: this.config.serviceName
      }
    );

    return { span, context, timer };
  }

  /**
   * Finish traced operation
   */
  finishOperation(
    span: Span,
    context: CorrelationContext,
    timer: () => void,
    result: { success: boolean; error?: Error; statusCode?: number } = { success: true }
  ): void {
    // Stop timer and record duration
    timer();

    // Set span status and tags
    if (result.success) {
      this.otelIntegration.setSpanStatus(span, 'OK');
    } else {
      this.otelIntegration.setSpanStatus(span, 'ERROR', result.error);
    }

    if (result.statusCode) {
      this.otelIntegration.setSpanTags(span, { 'http.status_code': result.statusCode });
    }

    // Finish span
    this.otelIntegration.finishSpan(span);

    // Record business metrics
    this.recordBusinessMetrics(context, result);

    // Cleanup correlation context
    this.correlationContexts.delete(context.correlationId);

    this.emit('operation-finished', {
      operationName: context.operationName,
      duration: Date.now() - context.startTime,
      success: result.success,
      correlationId: context.correlationId
    });
  }

  /**
   * Record business metrics for operation
   */
  private recordBusinessMetrics(
    context: CorrelationContext,
    result: { success: boolean; error?: Error; statusCode?: number }
  ): void {
    // Increment request counter
    this.metricsCollector.incrementCounter(
      'requests_total',
      {
        method: 'POST', // Would extract from context in real implementation
        status: result.statusCode?.toString() || (result.success ? '200' : '500'),
        endpoint: context.operationName
      }
    );

    // Record agent execution if applicable
    if (context.operationName.includes('agent')) {
      this.metricsCollector.incrementCounter(
        'agent_execution_total',
        {
          agent_type: context.operationName,
          success: result.success.toString()
        }
      );
    }

    // Calculate and record error rate
    this.updateErrorRate(result.success);
  }

  /**
   * Update error rate metric
   */
  private updateErrorRate(success: boolean): void {
    // Simple error rate calculation - in production this would use a sliding window
    const recentRequests = 100; // Last 100 requests
    const errorCount = success ? 0 : 1;
    const errorRate = (errorCount / recentRequests) * 100;

    this.metricsCollector.recordGauge(
      'error_rate',
      errorRate,
      { service: this.config.serviceName }
    );
  }

  /**
   * Collect system-level metrics
   */
  private collectSystemMetrics(): void {
    // Memory metrics
    const memUsage = process.memoryUsage();
    this.metricsCollector.recordGauge('memory_heap_used_bytes', memUsage.heapUsed);
    this.metricsCollector.recordGauge('memory_heap_total_bytes', memUsage.heapTotal);
    this.metricsCollector.recordGauge('memory_external_bytes', memUsage.external);

    // Process metrics
    this.metricsCollector.recordGauge('process_uptime_seconds', process.uptime());
    
    // Active contexts
    this.metricsCollector.recordGauge(
      'active_correlation_contexts',
      this.correlationContexts.size,
      { service: this.config.serviceName }
    );

    // Active spans
    this.metricsCollector.recordGauge(
      'active_spans',
      this.otelIntegration.getActiveSpansCount(),
      { service: this.config.serviceName }
    );
  }

  /**
   * Calculate Service Level Indicators
   */
  private calculateSLIs(): void {
    for (const [name, config] of this.sliConfigs.entries()) {
      const metric = this.metricsCollector.getMetric(config.metricName);
      if (!metric) continue;

      // Calculate SLI based on metric type and threshold
      const sliValue = this.calculateSLIValue(metric, config);
      
      this.metricsCollector.recordGauge(
        `sli_${name}`,
        sliValue,
        {
          service: this.config.serviceName,
          objective: config.objective.toString()
        }
      );

      // Check if SLI is below objective
      if (sliValue < config.objective) {
        this.emit('sli-violation', {
          sli: name,
          value: sliValue,
          objective: config.objective,
          deficit: config.objective - sliValue
        });
      }
    }
  }

  /**
   * Calculate SLI value based on metric and configuration
   */
  private calculateSLIValue(metric: any, config: SLIConfig): number {
    // Simplified SLI calculation - in production this would be more sophisticated
    const { aggregations } = metric;
    
    switch (config.name) {
      case 'availability':
        // Calculate availability as percentage of successful requests
        return aggregations.count > 0 ? (aggregations.count - 1) / aggregations.count * 100 : 100;
      
      case 'latency':
        // Calculate percentage of requests below threshold
        return aggregations.p95 ? (aggregations.p95 < config.threshold ? 95 : 85) : 95;
      
      case 'error_budget':
        // Calculate remaining error budget
        return Math.max(0, config.objective - aggregations.avg);
      
      default:
        return 100;
    }
  }

  /**
   * Update performance baselines
   */
  private updatePerformanceBaselines(): void {
    for (const [name, metric] of this.metricsCollector.getAllMetrics().entries()) {
      if (metric.dataPoints.length < 10) continue;

      const baseline: PerformanceBaseline = {
        metricName: name,
        baselineValue: metric.aggregations.avg,
        confidence: this.calculateConfidence(metric.dataPoints),
        measuredAt: Date.now(),
        sampleSize: metric.dataPoints.length,
        variance: this.calculateVariance(metric.dataPoints)
      };

      this.performanceBaselines.set(name, baseline);
    }
  }

  /**
   * Calculate confidence level for baseline
   */
  private calculateConfidence(dataPoints: any[]): number {
    // Simple confidence calculation based on sample size and variance
    if (dataPoints.length < 10) return 0.5;
    if (dataPoints.length < 50) return 0.7;
    if (dataPoints.length < 100) return 0.85;
    return 0.95;
  }

  /**
   * Calculate variance for data points
   */
  private calculateVariance(dataPoints: any[]): number {
    if (dataPoints.length < 2) return 0;
    
    const values = dataPoints.map(dp => dp.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  /**
   * Check alerts based on current metrics
   */
  private checkAlerts(): void {
    for (const [name, config] of this.alertConfigs.entries()) {
      const metric = this.metricsCollector.getMetric(config.metricName);
      if (!metric) continue;

      const currentValue = metric.aggregations.avg;
      const shouldAlert = this.evaluateAlertCondition(currentValue, config);

      if (shouldAlert) {
        this.emit('alert-triggered', {
          alertName: name,
          metricName: config.metricName,
          currentValue,
          threshold: config.threshold,
          severity: config.severity,
          description: config.description,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateAlertCondition(value: number, config: AlertConfig): boolean {
    switch (config.condition) {
      case 'greater_than':
        return value > config.threshold;
      case 'less_than':
        return value < config.threshold;
      case 'equal_to':
        return value === config.threshold;
      case 'not_equal_to':
        return value !== config.threshold;
      default:
        return false;
    }
  }

  /**
   * Generate unique correlation ID
   */
  private generateCorrelationId(): string {
    return `${this.config.serviceName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get observability health status
   */
  getHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: {
      metrics: 'healthy' | 'degraded' | 'unhealthy';
      tracing: 'healthy' | 'degraded' | 'unhealthy';
    };
    activeContexts: number;
    activeSpans: number;
    sliViolations: number;
    activeAlerts: number;
  } {
    const activeContexts = this.correlationContexts.size;
    const activeSpans = this.otelIntegration.getActiveSpansCount();

    let metricsHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let tracingHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check metrics health
    if (this.metricsCollector.getMetricsSummary().totalMetrics === 0) {
      metricsHealth = 'unhealthy';
    }

    // Check tracing health
    if (activeSpans > 1000) {
      tracingHealth = 'degraded';
    }
    if (activeSpans > 5000) {
      tracingHealth = 'unhealthy';
    }

    const overallStatus = 
      metricsHealth === 'unhealthy' || tracingHealth === 'unhealthy' ? 'unhealthy' :
      metricsHealth === 'degraded' || tracingHealth === 'degraded' ? 'degraded' : 'healthy';

    return {
      status: overallStatus,
      components: {
        metrics: metricsHealth,
        tracing: tracingHealth
      },
      activeContexts,
      activeSpans,
      sliViolations: 0, // Would track actual violations
      activeAlerts: 0 // Would track active alerts
    };
  }

  /**
   * Export observability data for external systems
   */
  exportObservabilityData(): {
    metrics: any;
    traces: any;
    slis: Array<{ name: string; value: number; objective: number }>;
    baselines: Array<PerformanceBaseline>;
    health: ReturnType<typeof this.getHealth>;
  } {
    const slis = Array.from(this.sliConfigs.entries()).map(([name, config]) => {
      const metric = this.metricsCollector.getMetric(`sli_${name}`);
      return {
        name,
        value: metric?.aggregations.avg || 0,
        objective: config.objective
      };
    });

    return {
      metrics: this.metricsCollector.getMetricsSummary(),
      traces: {
        activeSpans: this.otelIntegration.getActiveSpansCount(),
        completedTraces: this.otelIntegration.getCompletedTracesCount(),
        sampling: this.otelIntegration.getSamplingStats()
      },
      slis,
      baselines: Array.from(this.performanceBaselines.values()),
      health: this.getHealth()
    };
  }

  /**
   * Cleanup and shutdown
   */
  async destroy(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
    }

    await this.metricsCollector.destroy();
    await this.otelIntegration.destroy();

    this.correlationContexts.clear();
    this.businessMetrics.clear();
    this.sliConfigs.clear();
    this.alertConfigs.clear();
    this.performanceBaselines.clear();

    this.emit('destroyed');
  }
}