/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';

/**
 * Metric types for different measurement scenarios
 */
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary'
}

/**
 * Metric configuration interface
 */
export interface MetricConfig {
  name: string;
  type: MetricType;
  description: string;
  labels?: Record<string, string>;
  unit?: string;
  buckets?: number[]; // For histograms
  objectives?: Record<number, number>; // For summaries
}

/**
 * Metric data point interface
 */
export interface MetricDataPoint {
  timestamp: number;
  value: number;
  labels: Record<string, string>;
  correlationId?: string;
}

/**
 * Comprehensive metric measurement
 */
export interface MetricMeasurement {
  name: string;
  type: MetricType;
  description: string;
  dataPoints: MetricDataPoint[];
  aggregations: {
    count: number;
    sum: number;
    min: number;
    max: number;
    avg: number;
    p50?: number;
    p95?: number;
    p99?: number;
  };
  createdAt: number;
  lastUpdated: number;
}

/**
 * Metrics collection configuration
 */
export interface MetricsConfig {
  enableCollection: boolean;
  collectionInterval: number;
  maxDataPoints: number;
  enableAutoCorrelation: boolean;
  exportInterval: number;
  enablePercentiles: boolean;
  histogramBuckets: number[];
  labels: Record<string, string>;
}

/**
 * Advanced Metrics Collector for Performance Monitoring
 */
export class MetricsCollector extends EventEmitter {
  private metrics = new Map<string, MetricMeasurement>();
  private config: MetricsConfig;
  private collectionInterval?: NodeJS.Timeout;
  private exportInterval?: NodeJS.Timeout;
  private correlationIdCounter = 0;
  private startTime: number = Date.now();

  constructor(config: Partial<MetricsConfig> = {}) {
    super();

    this.config = {
      enableCollection: true,
      collectionInterval: 5000, // 5 seconds
      maxDataPoints: 1000,
      enableAutoCorrelation: true,
      exportInterval: 30000, // 30 seconds
      enablePercentiles: true,
      histogramBuckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2.5, 5, 10],
      labels: {},
      ...config
    };

    this.initialize();
  }

  /**
   * Initialize metrics collector
   */
  private initialize(): void {
    if (this.config.enableCollection) {
      this.startCollection();
    }

    this.emit('initialized', { config: this.config });
  }

  /**
   * Start metrics collection
   */
  private startCollection(): void {
    this.collectionInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, this.config.collectionInterval);

    this.exportInterval = setInterval(() => {
      this.exportMetrics();
    }, this.config.exportInterval);

    this.emit('collection-started');
  }

  /**
   * Register a new metric
   */
  registerMetric(config: MetricConfig): void {
    const metric: MetricMeasurement = {
      name: config.name,
      type: config.type,
      description: config.description,
      dataPoints: [],
      aggregations: {
        count: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
        avg: 0
      },
      createdAt: Date.now(),
      lastUpdated: Date.now()
    };

    this.metrics.set(config.name, metric);
    this.emit('metric-registered', { name: config.name, type: config.type });
  }

  /**
   * Record a metric value
   */
  recordMetric(
    name: string,
    value: number,
    labels: Record<string, string> = {},
    correlationId?: string
  ): void {
    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`Metric ${name} not registered. Auto-registering as gauge.`);
      this.registerMetric({
        name,
        type: MetricType.GAUGE,
        description: `Auto-registered metric: ${name}`
      });
      return this.recordMetric(name, value, labels, correlationId);
    }

    const dataPoint: MetricDataPoint = {
      timestamp: Date.now(),
      value,
      labels: { ...this.config.labels, ...labels },
      correlationId: correlationId || (this.config.enableAutoCorrelation ? this.generateCorrelationId() : undefined)
    };

    metric.dataPoints.push(dataPoint);

    // Limit data points to prevent memory issues
    if (metric.dataPoints.length > this.config.maxDataPoints) {
      metric.dataPoints = metric.dataPoints.slice(-this.config.maxDataPoints);
    }

    // Update aggregations
    this.updateAggregations(metric);
    metric.lastUpdated = Date.now();

    this.emit('metric-recorded', { name, value, labels, correlationId });
  }

  /**
   * Record counter increment
   */
  incrementCounter(name: string, labels: Record<string, string> = {}, amount: number = 1): void {
    this.recordMetric(name, amount, labels);
  }

  /**
   * Record gauge value
   */
  recordGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    this.recordMetric(name, value, labels);
  }

  /**
   * Record histogram observation
   */
  recordHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    this.recordMetric(name, value, labels);
  }

  /**
   * Record timing measurement
   */
  recordTiming(name: string, startTime: number, labels: Record<string, string> = {}): void {
    const duration = Date.now() - startTime;
    this.recordHistogram(`${name}_duration_ms`, duration, labels);
  }

  /**
   * Create a timer for measuring operation duration
   */
  startTimer(name: string, labels: Record<string, string> = {}): () => void {
    const startTime = Date.now();
    return () => {
      this.recordTiming(name, startTime, labels);
    };
  }

  /**
   * Update metric aggregations
   */
  private updateAggregations(metric: MetricMeasurement): void {
    const values = metric.dataPoints.map(dp => dp.value);
    
    if (values.length === 0) return;

    metric.aggregations = {
      count: values.length,
      sum: values.reduce((sum, val) => sum + val, 0),
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((sum, val) => sum + val, 0) / values.length
    };

    // Calculate percentiles if enabled
    if (this.config.enablePercentiles && values.length >= 2) {
      const sorted = [...values].sort((a, b) => a - b);
      metric.aggregations.p50 = this.calculatePercentile(sorted, 0.5);
      metric.aggregations.p95 = this.calculatePercentile(sorted, 0.95);
      metric.aggregations.p99 = this.calculatePercentile(sorted, 0.99);
    }
  }

  /**
   * Calculate percentile value
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = Math.ceil(sortedValues.length * percentile) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }

  /**
   * Generate unique correlation ID
   */
  private generateCorrelationId(): string {
    return `metrics-${Date.now()}-${++this.correlationIdCounter}`;
  }

  /**
   * Collect system-level metrics automatically
   */
  private collectSystemMetrics(): void {
    // Memory metrics
    const memUsage = process.memoryUsage();
    this.recordGauge('system_memory_heap_used_bytes', memUsage.heapUsed, { component: 'system' });
    this.recordGauge('system_memory_heap_total_bytes', memUsage.heapTotal, { component: 'system' });
    this.recordGauge('system_memory_external_bytes', memUsage.external, { component: 'system' });
    this.recordGauge('system_memory_rss_bytes', memUsage.rss, { component: 'system' });

    // Process metrics
    this.recordGauge('system_process_uptime_seconds', process.uptime(), { component: 'system' });
    this.recordGauge('system_process_cpu_usage_percent', process.cpuUsage().user / 1000000, { component: 'system' });

    // Event loop lag (approximation)
    const start = Date.now();
    setImmediate(() => {
      const lag = Date.now() - start;
      this.recordGauge('system_event_loop_lag_ms', lag, { component: 'system' });
    });

    // Custom business metrics
    this.recordGauge('system_metrics_collection_duration_seconds', (Date.now() - this.startTime) / 1000, { component: 'metrics' });
    this.recordGauge('system_registered_metrics_count', this.metrics.size, { component: 'metrics' });
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, MetricMeasurement> {
    return new Map(this.metrics);
  }

  /**
   * Get specific metric
   */
  getMetric(name: string): MetricMeasurement | undefined {
    return this.metrics.get(name);
  }

  /**
   * Get metrics by pattern
   */
  getMetricsByPattern(pattern: RegExp): MetricMeasurement[] {
    const results: MetricMeasurement[] = [];
    
    for (const [name, metric] of this.metrics.entries()) {
      if (pattern.test(name)) {
        results.push(metric);
      }
    }

    return results;
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): {
    totalMetrics: number;
    totalDataPoints: number;
    registeredTypes: Record<MetricType, number>;
    oldestMetric: number;
    newestMetric: number;
  } {
    let totalDataPoints = 0;
    let oldestMetric = Date.now();
    let newestMetric = 0;
    const registeredTypes: Record<MetricType, number> = {
      [MetricType.COUNTER]: 0,
      [MetricType.GAUGE]: 0,
      [MetricType.HISTOGRAM]: 0,
      [MetricType.SUMMARY]: 0
    };

    for (const metric of this.metrics.values()) {
      totalDataPoints += metric.dataPoints.length;
      registeredTypes[metric.type]++;
      
      if (metric.createdAt < oldestMetric) {
        oldestMetric = metric.createdAt;
      }
      if (metric.lastUpdated > newestMetric) {
        newestMetric = metric.lastUpdated;
      }
    }

    return {
      totalMetrics: this.metrics.size,
      totalDataPoints,
      registeredTypes,
      oldestMetric,
      newestMetric
    };
  }

  /**
   * Export metrics for external consumption
   */
  private exportMetrics(): void {
    const summary = this.getMetricsSummary();
    const exportData = {
      timestamp: Date.now(),
      summary,
      metrics: Array.from(this.metrics.values()).map(metric => ({
        name: metric.name,
        type: metric.type,
        description: metric.description,
        aggregations: metric.aggregations,
        lastUpdated: metric.lastUpdated,
        dataPointsCount: metric.dataPoints.length
      }))
    };

    this.emit('metrics-exported', exportData);
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusFormat(): string {
    let output = '';
    
    for (const metric of this.metrics.values()) {
      // Add help text
      output += `# HELP ${metric.name} ${metric.description}\n`;
      
      // Add type
      let promType = 'gauge';
      switch (metric.type) {
        case MetricType.COUNTER:
          promType = 'counter';
          break;
        case MetricType.HISTOGRAM:
          promType = 'histogram';
          break;
        case MetricType.SUMMARY:
          promType = 'summary';
          break;
      }
      output += `# TYPE ${metric.name} ${promType}\n`;

      // Add latest data point
      const latest = metric.dataPoints[metric.dataPoints.length - 1];
      if (latest) {
        const labels = Object.entries(latest.labels)
          .map(([key, value]) => `${key}="${value}"`)
          .join(',');
        const labelStr = labels ? `{${labels}}` : '';
        output += `${metric.name}${labelStr} ${latest.value} ${latest.timestamp}\n`;
      }

      output += '\n';
    }

    return output;
  }

  /**
   * Clear specific metric
   */
  clearMetric(name: string): boolean {
    return this.metrics.delete(name);
  }

  /**
   * Clear all metrics
   */
  clearAllMetrics(): void {
    this.metrics.clear();
    this.emit('metrics-cleared');
  }

  /**
   * Reset metric data but keep registration
   */
  resetMetric(name: string): boolean {
    const metric = this.metrics.get(name);
    if (!metric) return false;

    metric.dataPoints = [];
    metric.aggregations = {
      count: 0,
      sum: 0,
      min: Infinity,
      max: -Infinity,
      avg: 0
    };
    metric.lastUpdated = Date.now();

    this.emit('metric-reset', { name });
    return true;
  }

  /**
   * Get correlation ID for current context
   */
  getCurrentCorrelationId(): string | undefined {
    return this.config.enableAutoCorrelation ? this.generateCorrelationId() : undefined;
  }

  /**
   * Create metric snapshot for analysis
   */
  createSnapshot(): {
    timestamp: number;
    summary: ReturnType<typeof this.getMetricsSummary>;
    metrics: Array<{
      name: string;
      type: MetricType;
      aggregations: MetricMeasurement['aggregations'];
      recentTrend: number; // Growth rate over last 10 data points
    }>;
  } {
    const summary = this.getMetricsSummary();
    const metrics = Array.from(this.metrics.values()).map(metric => {
      // Calculate trend
      let recentTrend = 0;
      if (metric.dataPoints.length >= 10) {
        const recent = metric.dataPoints.slice(-10);
        const first = recent[0].value;
        const last = recent[recent.length - 1].value;
        recentTrend = first !== 0 ? (last - first) / first : 0;
      }

      return {
        name: metric.name,
        type: metric.type,
        aggregations: metric.aggregations,
        recentTrend
      };
    });

    return {
      timestamp: Date.now(),
      summary,
      metrics
    };
  }

  /**
   * Stop metrics collection and cleanup
   */
  destroy(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
    }

    if (this.exportInterval) {
      clearInterval(this.exportInterval);
    }

    this.emit('destroyed');
  }
}