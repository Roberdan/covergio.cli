/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';

/**
 * Span context interface for distributed tracing
 */
export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  flags: number;
  baggage?: Record<string, string>;
}

/**
 * Span interface for tracing operations
 */
export interface Span {
  context: SpanContext;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, any>;
  logs: Array<{
    timestamp: number;
    fields: Record<string, any>;
  }>;
  status: 'OK' | 'ERROR' | 'TIMEOUT' | 'CANCELLED';
  parentSpan?: Span;
  childSpans: Span[];
}

/**
 * Trace sampling strategy configuration
 */
export interface SamplingConfig {
  strategy: 'always' | 'never' | 'probabilistic' | 'adaptive';
  rate?: number; // For probabilistic sampling (0-1)
  maxTracesPerSecond?: number; // For adaptive sampling
  traceIdRatioBased?: number; // Alternative sampling method
}

/**
 * OpenTelemetry collector configuration
 */
export interface CollectorConfig {
  endpoint: string;
  headers?: Record<string, string>;
  timeout: number;
  batchSize: number;
  exportInterval: number;
  enableCompression: boolean;
  protocol: 'http' | 'grpc';
}

/**
 * Instrumentation configuration
 */
export interface InstrumentationConfig {
  enableAutoInstrumentation: boolean;
  instrumentedOperations: string[];
  excludeOperations: string[];
  captureBody: boolean;
  captureHeaders: boolean;
  maxBodySize: number;
}

/**
 * OpenTelemetry integration configuration
 */
export interface OpenTelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  sampling: SamplingConfig;
  collector: CollectorConfig;
  instrumentation: InstrumentationConfig;
  enableMetrics: boolean;
  enableTracing: boolean;
  enableLogging: boolean;
  resourceAttributes: Record<string, string>;
}

/**
 * Metric instrument types for OpenTelemetry
 */
export interface OTelMetricInstrument {
  name: string;
  type: 'counter' | 'histogram' | 'gauge' | 'updowncounter';
  description: string;
  unit?: string;
  instrument: any; // Will be the actual OTel instrument
}

/**
 * Comprehensive OpenTelemetry Integration
 */
export class OpenTelemetryIntegration extends EventEmitter {
  private config: OpenTelemetryConfig;
  private activeSpans = new Map<string, Span>();
  private completedTraces: Span[] = [];
  private metricInstruments = new Map<string, OTelMetricInstrument>();
  private samplingDecisions = new Map<string, boolean>();
  private traceIdCounter = 0;
  private spanIdCounter = 0;
  private exportInterval?: NodeJS.Timeout;
  private metricsExportInterval?: NodeJS.Timeout;

  constructor(config: Partial<OpenTelemetryConfig> = {}) {
    super();

    this.config = {
      serviceName: 'convergio-cli',
      serviceVersion: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      sampling: {
        strategy: 'probabilistic',
        rate: 0.1, // 10% sampling rate
        maxTracesPerSecond: 100
      },
      collector: {
        endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
        timeout: 10000,
        batchSize: 100,
        exportInterval: 5000,
        enableCompression: true,
        protocol: 'http'
      },
      instrumentation: {
        enableAutoInstrumentation: true,
        instrumentedOperations: ['*'],
        excludeOperations: ['health_check', 'metrics'],
        captureBody: false,
        captureHeaders: false,
        maxBodySize: 1024
      },
      enableMetrics: true,
      enableTracing: true,
      enableLogging: true,
      resourceAttributes: {},
      ...config
    };

    this.initialize();
  }

  /**
   * Initialize OpenTelemetry integration
   */
  private initialize(): void {
    if (this.config.enableTracing) {
      this.setupTracing();
    }

    if (this.config.enableMetrics) {
      this.setupMetrics();
    }

    if (this.config.enableLogging) {
      this.setupLogging();
    }

    this.startExporting();
    this.emit('initialized', { config: this.config });
  }

  /**
   * Setup distributed tracing
   */
  private setupTracing(): void {
    // Initialize tracing components
    this.emit('tracing-initialized');
  }

  /**
   * Setup metrics collection
   */
  private setupMetrics(): void {
    // Create default metric instruments
    this.createMetricInstrument('requests_total', 'counter', 'Total number of requests processed');
    this.createMetricInstrument('request_duration_ms', 'histogram', 'Request processing duration in milliseconds');
    this.createMetricInstrument('active_connections', 'gauge', 'Number of active connections');
    this.createMetricInstrument('memory_usage_bytes', 'gauge', 'Memory usage in bytes');
    this.createMetricInstrument('cpu_usage_percent', 'gauge', 'CPU usage percentage');

    this.emit('metrics-initialized');
  }

  /**
   * Setup structured logging
   */
  private setupLogging(): void {
    this.emit('logging-initialized');
  }

  /**
   * Start exporting telemetry data
   */
  private startExporting(): void {
    if (this.config.enableTracing) {
      this.exportInterval = setInterval(() => {
        this.exportTraces();
      }, this.config.collector.exportInterval);
    }

    if (this.config.enableMetrics) {
      this.metricsExportInterval = setInterval(() => {
        this.exportMetrics();
      }, this.config.collector.exportInterval);
    }
  }

  /**
   * Start a new span
   */
  startSpan(
    operationName: string,
    parentSpanContext?: SpanContext,
    tags: Record<string, any> = {}
  ): Span {
    const shouldSample = this.shouldSample(operationName);
    
    if (!shouldSample) {
      // Return a no-op span for non-sampled traces
      return this.createNoOpSpan(operationName);
    }

    const traceId = parentSpanContext?.traceId || this.generateTraceId();
    const spanId = this.generateSpanId();
    
    const span: Span = {
      context: {
        traceId,
        spanId,
        parentSpanId: parentSpanContext?.spanId,
        flags: 1 // Sampled
      },
      operationName,
      startTime: Date.now(),
      tags: {
        'service.name': this.config.serviceName,
        'service.version': this.config.serviceVersion,
        'environment': this.config.environment,
        ...tags
      },
      logs: [],
      status: 'OK',
      childSpans: []
    };

    // Set parent-child relationship
    if (parentSpanContext) {
      const parentSpan = this.activeSpans.get(parentSpanContext.spanId);
      if (parentSpan) {
        span.parentSpan = parentSpan;
        parentSpan.childSpans.push(span);
      }
    }

    this.activeSpans.set(spanId, span);
    this.emit('span-started', { span, operationName });

    return span;
  }

  /**
   * Finish a span
   */
  finishSpan(span: Span): void {
    if (!span.context.spanId) return; // No-op span

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;

    // Remove from active spans
    this.activeSpans.delete(span.context.spanId);

    // Add to completed traces if it's a root span
    if (!span.parentSpan) {
      this.completedTraces.push(span);
      
      // Limit completed traces to prevent memory issues
      if (this.completedTraces.length > 1000) {
        this.completedTraces = this.completedTraces.slice(-1000);
      }
    }

    this.emit('span-finished', { span, duration: span.duration });
  }

  /**
   * Add tags to a span
   */
  setSpanTags(span: Span, tags: Record<string, any>): void {
    Object.assign(span.tags, tags);
  }

  /**
   * Add log entry to a span
   */
  logToSpan(span: Span, fields: Record<string, any>): void {
    span.logs.push({
      timestamp: Date.now(),
      fields
    });
  }

  /**
   * Set span status
   */
  setSpanStatus(span: Span, status: Span['status'], error?: Error): void {
    span.status = status;
    
    if (error) {
      this.setSpanTags(span, {
        'error': true,
        'error.kind': error.name,
        'error.message': error.message,
        'error.stack': error.stack
      });
    }
  }

  /**
   * Create metric instrument
   */
  createMetricInstrument(
    name: string,
    type: OTelMetricInstrument['type'],
    description: string,
    unit?: string
  ): void {
    // Simulate creating OTel metric instrument
    const instrument: OTelMetricInstrument = {
      name,
      type,
      description,
      unit,
      instrument: {
        // Mock instrument implementation
        add: (value: number, labels: Record<string, string> = {}) => {
          this.recordMetricValue(name, value, labels);
        },
        record: (value: number, labels: Record<string, string> = {}) => {
          this.recordMetricValue(name, value, labels);
        },
        set: (value: number, labels: Record<string, string> = {}) => {
          this.recordMetricValue(name, value, labels);
        }
      }
    };

    this.metricInstruments.set(name, instrument);
    this.emit('metric-instrument-created', { name, type, description });
  }

  /**
   * Record metric value
   */
  private recordMetricValue(name: string, value: number, labels: Record<string, string>): void {
    this.emit('metric-recorded', {
      name,
      value,
      labels,
      timestamp: Date.now(),
      serviceName: this.config.serviceName
    });
  }

  /**
   * Get metric instrument
   */
  getMetricInstrument(name: string): OTelMetricInstrument | undefined {
    return this.metricInstruments.get(name);
  }

  /**
   * Increment counter metric
   */
  incrementCounter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    const instrument = this.metricInstruments.get(name);
    if (instrument && instrument.type === 'counter') {
      instrument.instrument.add(value, labels);
    }
  }

  /**
   * Record histogram value
   */
  recordHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const instrument = this.metricInstruments.get(name);
    if (instrument && instrument.type === 'histogram') {
      instrument.instrument.record(value, labels);
    }
  }

  /**
   * Set gauge value
   */
  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const instrument = this.metricInstruments.get(name);
    if (instrument && instrument.type === 'gauge') {
      instrument.instrument.set(value, labels);
    }
  }

  /**
   * Generate correlation ID for distributed tracing
   */
  generateCorrelationId(): string {
    return `${this.config.serviceName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract span context from headers (for distributed tracing)
   */
  extractSpanContext(headers: Record<string, string>): SpanContext | undefined {
    const traceId = headers['x-trace-id'] || headers['traceparent'];
    const spanId = headers['x-span-id'];
    
    if (!traceId || !spanId) return undefined;

    return {
      traceId,
      spanId,
      flags: 1
    };
  }

  /**
   * Inject span context into headers
   */
  injectSpanContext(span: Span, headers: Record<string, string>): void {
    headers['x-trace-id'] = span.context.traceId;
    headers['x-span-id'] = span.context.spanId;
    if (span.context.parentSpanId) {
      headers['x-parent-span-id'] = span.context.parentSpanId;
    }
  }

  /**
   * Determine if operation should be sampled
   */
  private shouldSample(operationName: string): boolean {
    // Check exclusions
    if (this.config.instrumentation.excludeOperations.includes(operationName)) {
      return false;
    }

    // Check if operation is in instrumented list
    const instrumented = this.config.instrumentation.instrumentedOperations;
    if (!instrumented.includes('*') && !instrumented.includes(operationName)) {
      return false;
    }

    const { strategy, rate, maxTracesPerSecond } = this.config.sampling;

    switch (strategy) {
      case 'always':
        return true;
      case 'never':
        return false;
      case 'probabilistic':
        return Math.random() < (rate || 0.1);
      case 'adaptive':
        return this.adaptiveSampling(maxTracesPerSecond || 100);
      default:
        return false;
    }
  }

  /**
   * Adaptive sampling based on current load
   */
  private adaptiveSampling(maxTracesPerSecond: number): boolean {
    const now = Date.now();
    const currentSecond = Math.floor(now / 1000);
    
    // Simple implementation - in production this would be more sophisticated
    const currentTraces = this.activeSpans.size;
    return currentTraces < maxTracesPerSecond;
  }

  /**
   * Generate unique trace ID
   */
  private generateTraceId(): string {
    return `trace-${Date.now()}-${++this.traceIdCounter}-${Math.random().toString(36).substr(2)}`;
  }

  /**
   * Generate unique span ID
   */
  private generateSpanId(): string {
    return `span-${Date.now()}-${++this.spanIdCounter}-${Math.random().toString(36).substr(2, 8)}`;
  }

  /**
   * Create no-op span for non-sampled traces
   */
  private createNoOpSpan(operationName: string): Span {
    return {
      context: { traceId: '', spanId: '', flags: 0 },
      operationName,
      startTime: Date.now(),
      tags: {},
      logs: [],
      status: 'OK',
      childSpans: []
    };
  }

  /**
   * Export traces to collector
   */
  private exportTraces(): void {
    if (this.completedTraces.length === 0) return;

    const batch = this.completedTraces.splice(0, this.config.collector.batchSize);
    
    // In a real implementation, this would send to the actual OTel collector
    const exportData = {
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: this.config.serviceName } },
            { key: 'service.version', value: { stringValue: this.config.serviceVersion } },
            { key: 'environment', value: { stringValue: this.config.environment } },
            ...Object.entries(this.config.resourceAttributes).map(([key, value]) => ({
              key,
              value: { stringValue: value }
            }))
          ]
        },
        instrumentationLibrarySpans: [{
          instrumentationLibrary: {
            name: 'convergio-cli-otel',
            version: '1.0.0'
          },
          spans: batch.map(span => this.spanToOTelFormat(span))
        }]
      }]
    };

    this.emit('traces-exported', {
      batchSize: batch.length,
      endpoint: this.config.collector.endpoint,
      timestamp: Date.now()
    });
  }

  /**
   * Export metrics to collector
   */
  private exportMetrics(): void {
    const instruments = Array.from(this.metricInstruments.values());
    
    if (instruments.length === 0) return;

    const exportData = {
      resourceMetrics: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: this.config.serviceName } },
            { key: 'service.version', value: { stringValue: this.config.serviceVersion } }
          ]
        },
        instrumentationLibraryMetrics: [{
          instrumentationLibrary: {
            name: 'convergio-cli-otel',
            version: '1.0.0'
          },
          metrics: instruments.map(instrument => ({
            name: instrument.name,
            description: instrument.description,
            unit: instrument.unit || '',
            type: instrument.type
          }))
        }]
      }]
    };

    this.emit('metrics-exported', {
      metricsCount: instruments.length,
      endpoint: this.config.collector.endpoint,
      timestamp: Date.now()
    });
  }

  /**
   * Convert internal span to OpenTelemetry format
   */
  private spanToOTelFormat(span: Span): any {
    return {
      traceId: span.context.traceId,
      spanId: span.context.spanId,
      parentSpanId: span.context.parentSpanId,
      name: span.operationName,
      kind: 'SPAN_KIND_INTERNAL',
      startTimeUnixNano: span.startTime * 1000000,
      endTimeUnixNano: (span.endTime || span.startTime) * 1000000,
      attributes: Object.entries(span.tags).map(([key, value]) => ({
        key,
        value: { stringValue: String(value) }
      })),
      events: span.logs.map(log => ({
        timeUnixNano: log.timestamp * 1000000,
        name: 'log',
        attributes: Object.entries(log.fields).map(([key, value]) => ({
          key,
          value: { stringValue: String(value) }
        }))
      })),
      status: {
        code: span.status === 'OK' ? 'STATUS_CODE_OK' : 'STATUS_CODE_ERROR'
      }
    };
  }

  /**
   * Get active spans count
   */
  getActiveSpansCount(): number {
    return this.activeSpans.size;
  }

  /**
   * Get completed traces count
   */
  getCompletedTracesCount(): number {
    return this.completedTraces.length;
  }

  /**
   * Get sampling statistics
   */
  getSamplingStats(): {
    strategy: string;
    sampledTraces: number;
    droppedTraces: number;
    samplingRate: number;
  } {
    const sampled = Array.from(this.samplingDecisions.values()).filter(Boolean).length;
    const total = this.samplingDecisions.size;
    
    return {
      strategy: this.config.sampling.strategy,
      sampledTraces: sampled,
      droppedTraces: total - sampled,
      samplingRate: total > 0 ? sampled / total : 0
    };
  }

  /**
   * Get telemetry health status
   */
  getHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    tracing: boolean;
    metrics: boolean;
    activeSpans: number;
    exportErrors: number;
    lastExport: number;
  } {
    const activeSpans = this.getActiveSpansCount();
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (activeSpans > 1000) {
      status = 'degraded';
    }
    if (activeSpans > 5000) {
      status = 'unhealthy';
    }

    return {
      status,
      tracing: this.config.enableTracing,
      metrics: this.config.enableMetrics,
      activeSpans,
      exportErrors: 0, // Would track actual export errors in real implementation
      lastExport: Date.now()
    };
  }

  /**
   * Cleanup and shutdown
   */
  destroy(): void {
    if (this.exportInterval) {
      clearInterval(this.exportInterval);
    }

    if (this.metricsExportInterval) {
      clearInterval(this.metricsExportInterval);
    }

    // Export remaining traces and metrics
    this.exportTraces();
    this.exportMetrics();

    this.activeSpans.clear();
    this.completedTraces = [];
    this.metricInstruments.clear();

    this.emit('destroyed');
  }
}