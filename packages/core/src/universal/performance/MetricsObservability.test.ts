/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MetricsCollector, MetricType } from './MetricsCollector.js';
import { OpenTelemetryIntegration } from './OpenTelemetryIntegration.js';
import { ObservabilityManager } from './ObservabilityManager.js';

describe('Metrics and Observability System', () => {
  describe('MetricsCollector', () => {
    let metricsCollector: MetricsCollector;

    beforeEach(() => {
      metricsCollector = new MetricsCollector({
        enableCollection: true,
        collectionInterval: 1000, // Faster for testing
        maxDataPoints: 100
      });
    });

    afterEach(async () => {
      await metricsCollector.destroy();
    });

    it('should register and record metrics correctly', () => {
      // Register metrics
      metricsCollector.registerMetric({
        name: 'test_counter',
        type: MetricType.COUNTER,
        description: 'Test counter metric'
      });

      metricsCollector.registerMetric({
        name: 'test_gauge',
        type: MetricType.GAUGE,
        description: 'Test gauge metric'
      });

      // Record values
      metricsCollector.incrementCounter('test_counter', { service: 'test' }, 5);
      metricsCollector.recordGauge('test_gauge', 42.5, { service: 'test' });

      // Verify metrics
      const counter = metricsCollector.getMetric('test_counter');
      const gauge = metricsCollector.getMetric('test_gauge');

      expect(counter).toBeDefined();
      expect(gauge).toBeDefined();
      expect(counter!.aggregations.sum).toBe(5);
      expect(gauge!.aggregations.avg).toBe(42.5);
    });

    it('should calculate percentiles correctly', () => {
      metricsCollector.registerMetric({
        name: 'latency_histogram',
        type: MetricType.HISTOGRAM,
        description: 'Latency histogram'
      });

      // Record various latency values
      const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      latencies.forEach(latency => {
        metricsCollector.recordHistogram('latency_histogram', latency);
      });

      const metric = metricsCollector.getMetric('latency_histogram');
      expect(metric).toBeDefined();
      expect(metric!.aggregations.p50).toBeDefined();
      expect(metric!.aggregations.p95).toBeDefined();
      expect(metric!.aggregations.p99).toBeDefined();

      // P50 should be around 50
      expect(metric!.aggregations.p50).toBeCloseTo(50, 0);
      // P95 should be around 95
      expect(metric!.aggregations.p95).toBeCloseTo(95, 0);
    });

    it('should track timing measurements correctly', async () => {
      metricsCollector.registerMetric({
        name: 'operation_duration_ms',
        type: MetricType.HISTOGRAM,
        description: 'Operation duration'
      });

      const timer = metricsCollector.startTimer('operation_duration_ms');
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 50));
      
      timer();

      const metric = metricsCollector.getMetric('operation_duration_ms');
      expect(metric).toBeDefined();
      expect(metric!.aggregations.count).toBe(1);
      expect(metric!.aggregations.avg).toBeGreaterThan(40); // Should be around 50ms
    });

    it('should export metrics in Prometheus format', () => {
      metricsCollector.registerMetric({
        name: 'http_requests_total',
        type: MetricType.COUNTER,
        description: 'Total HTTP requests'
      });

      metricsCollector.incrementCounter('http_requests_total', { 
        method: 'GET', 
        status: '200' 
      }, 10);

      const prometheusOutput = metricsCollector.exportPrometheusFormat();
      
      expect(prometheusOutput).toContain('# HELP http_requests_total Total HTTP requests');
      expect(prometheusOutput).toContain('# TYPE http_requests_total counter');
      expect(prometheusOutput).toContain('http_requests_total{method="GET",status="200"} 10');
    });

    it('should handle metric patterns and searches', () => {
      metricsCollector.registerMetric({
        name: 'api_latency_ms',
        type: MetricType.HISTOGRAM,
        description: 'API latency'
      });

      metricsCollector.registerMetric({
        name: 'api_requests_total',
        type: MetricType.COUNTER,
        description: 'API requests'
      });

      metricsCollector.registerMetric({
        name: 'db_connections',
        type: MetricType.GAUGE,
        description: 'Database connections'
      });

      const apiMetrics = metricsCollector.getMetricsByPattern(/^api_/);
      expect(apiMetrics).toHaveLength(2);
      expect(apiMetrics.map(m => m.name)).toEqual(['api_latency_ms', 'api_requests_total']);
    });

    it('should create and manage metric snapshots', () => {
      metricsCollector.registerMetric({
        name: 'test_trend',
        type: MetricType.GAUGE,
        description: 'Test trending metric'
      });

      // Record trending data
      for (let i = 1; i <= 20; i++) {
        metricsCollector.recordGauge('test_trend', i * 10);
      }

      const snapshot = metricsCollector.createSnapshot();
      
      expect(snapshot.summary.totalMetrics).toBeGreaterThan(0);
      expect(snapshot.metrics).toHaveLength(snapshot.summary.totalMetrics);
      
      const trendMetric = snapshot.metrics.find(m => m.name === 'test_trend');
      expect(trendMetric).toBeDefined();
      expect(trendMetric!.recentTrend).toBeGreaterThan(0); // Should show upward trend
    });

    it('should auto-collect system metrics', async () => {
      // Wait for auto-collection
      await new Promise(resolve => setTimeout(resolve, 1100));

      const systemMetrics = metricsCollector.getMetricsByPattern(/^system_/);
      expect(systemMetrics.length).toBeGreaterThan(0);

      // Check for specific system metrics
      const memoryMetric = metricsCollector.getMetric('system_memory_heap_used_bytes');
      const uptimeMetric = metricsCollector.getMetric('system_process_uptime_seconds');

      expect(memoryMetric).toBeDefined();
      expect(uptimeMetric).toBeDefined();
      expect(memoryMetric!.aggregations.avg).toBeGreaterThan(0);
      expect(uptimeMetric!.aggregations.avg).toBeGreaterThan(0);
    });
  });

  describe('OpenTelemetryIntegration', () => {
    let otelIntegration: OpenTelemetryIntegration;

    beforeEach(() => {
      otelIntegration = new OpenTelemetryIntegration({
        serviceName: 'test-service',
        enableTracing: true,
        enableMetrics: true,
        sampling: {
          strategy: 'always' // Always sample for testing
        }
      });
    });

    afterEach(() => {
      otelIntegration.destroy();
    });

    it('should create and manage spans correctly', () => {
      const span = otelIntegration.startSpan('test_operation', undefined, {
        'test.key': 'test.value'
      });

      expect(span).toBeDefined();
      expect(span.operationName).toBe('test_operation');
      expect(span.tags['test.key']).toBe('test.value');
      expect(span.context.traceId).toBeDefined();
      expect(span.context.spanId).toBeDefined();

      // Add logs and finish span
      otelIntegration.logToSpan(span, { message: 'Test log entry' });
      otelIntegration.setSpanStatus(span, 'OK');
      otelIntegration.finishSpan(span);

      expect(span.endTime).toBeDefined();
      expect(span.duration).toBeDefined();
      expect(span.logs).toHaveLength(1);
    });

    it('should handle parent-child span relationships', () => {
      const parentSpan = otelIntegration.startSpan('parent_operation');
      const childSpan = otelIntegration.startSpan(
        'child_operation',
        parentSpan.context,
        { 'child.tag': 'value' }
      );

      expect(childSpan.context.parentSpanId).toBe(parentSpan.context.spanId);
      expect(childSpan.context.traceId).toBe(parentSpan.context.traceId);
      expect(parentSpan.childSpans).toContain(childSpan);

      otelIntegration.finishSpan(childSpan);
      otelIntegration.finishSpan(parentSpan);
    });

    it('should handle span context injection and extraction', () => {
      const span = otelIntegration.startSpan('test_operation');
      const headers: Record<string, string> = {};

      // Inject span context into headers
      otelIntegration.injectSpanContext(span, headers);

      expect(headers['x-trace-id']).toBe(span.context.traceId);
      expect(headers['x-span-id']).toBe(span.context.spanId);

      // Extract span context from headers
      const extractedContext = otelIntegration.extractSpanContext(headers);

      expect(extractedContext).toBeDefined();
      expect(extractedContext!.traceId).toBe(span.context.traceId);
      expect(extractedContext!.spanId).toBe(span.context.spanId);

      otelIntegration.finishSpan(span);
    });

    it('should record metrics correctly', () => {
      // Create metric instruments
      otelIntegration.createMetricInstrument(
        'test_requests_total',
        'counter',
        'Total test requests'
      );

      otelIntegration.createMetricInstrument(
        'test_latency_ms',
        'histogram',
        'Test latency in milliseconds'
      );

      // Record metrics
      otelIntegration.incrementCounter('test_requests_total', { endpoint: '/test' }, 5);
      otelIntegration.recordHistogram('test_latency_ms', 150, { endpoint: '/test' });

      const counterInstrument = otelIntegration.getMetricInstrument('test_requests_total');
      const histogramInstrument = otelIntegration.getMetricInstrument('test_latency_ms');

      expect(counterInstrument).toBeDefined();
      expect(histogramInstrument).toBeDefined();
      expect(counterInstrument!.type).toBe('counter');
      expect(histogramInstrument!.type).toBe('histogram');
    });

    it('should handle different sampling strategies', () => {
      const neverSampleOtel = new OpenTelemetryIntegration({
        sampling: { strategy: 'never' }
      });

      const alwaysSampleOtel = new OpenTelemetryIntegration({
        sampling: { strategy: 'always' }
      });

      const span1 = neverSampleOtel.startSpan('never_sampled');
      const span2 = alwaysSampleOtel.startSpan('always_sampled');

      // Never sampled span should be no-op
      expect(span1.context.flags).toBe(0);
      expect(span1.context.spanId).toBe('');

      // Always sampled span should be real
      expect(span2.context.flags).toBe(1);
      expect(span2.context.spanId).toBeDefined();

      neverSampleOtel.destroy();
      alwaysSampleOtel.destroy();
    });

    it('should provide health and statistics information', () => {
      // Create some spans
      const span1 = otelIntegration.startSpan('operation1');
      const span2 = otelIntegration.startSpan('operation2');

      const health = otelIntegration.getHealth();
      const stats = otelIntegration.getSamplingStats();

      expect(health.status).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(health.activeSpans).toBe(2);
      expect(health.tracing).toBe(true);
      expect(health.metrics).toBe(true);

      expect(stats.strategy).toBe('always');
      expect(stats.sampledTraces).toBeGreaterThanOrEqual(0);

      otelIntegration.finishSpan(span1);
      otelIntegration.finishSpan(span2);
    });
  });

  describe('ObservabilityManager', () => {
    let observabilityManager: ObservabilityManager;

    beforeEach(() => {
      observabilityManager = new ObservabilityManager({
        serviceName: 'test-service',
        environment: 'test',
        enableMetrics: true,
        enableTracing: true,
        sampleRate: 1.0 // Always sample for testing
      });
    });

    afterEach(async () => {
      await observabilityManager.destroy();
    });

    it('should create and manage correlation contexts', () => {
      const context = observabilityManager.createCorrelationContext('test_operation');

      expect(context).toBeDefined();
      expect(context.operationName).toBe('test_operation');
      expect(context.correlationId).toBeDefined();
      expect(context.startTime).toBeDefined();
    });

    it('should handle complete operation lifecycle', async () => {
      const { span, context, timer } = observabilityManager.startOperation(
        'test_operation',
        undefined,
        { 'test.tag': 'test.value' }
      );

      expect(span).toBeDefined();
      expect(context).toBeDefined();
      expect(timer).toBeInstanceOf(Function);

      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 50));

      // Finish operation successfully
      observabilityManager.finishOperation(span, context, timer, {
        success: true,
        statusCode: 200
      });

      expect(span.endTime).toBeDefined();
      expect(span.duration).toBeGreaterThan(40);
    });

    it('should handle operation errors correctly', async () => {
      const { span, context, timer } = observabilityManager.startOperation('failing_operation');

      const error = new Error('Test error');
      
      observabilityManager.finishOperation(span, context, timer, {
        success: false,
        error,
        statusCode: 500
      });

      expect(span.status).toBe('ERROR');
      expect(span.tags['error']).toBe(true);
      expect(span.tags['error.message']).toBe('Test error');
    });

    it('should track business metrics correctly', async () => {
      // Perform several operations to generate metrics
      for (let i = 0; i < 5; i++) {
        const { span, context, timer } = observabilityManager.startOperation('api_request');
        
        await new Promise(resolve => setTimeout(resolve, 10));
        
        observabilityManager.finishOperation(span, context, timer, {
          success: i < 4, // Last one fails
          statusCode: i < 4 ? 200 : 500
        });
      }

      // Wait for metrics collection
      await new Promise(resolve => setTimeout(resolve, 100));

      const exportedData = observabilityManager.exportObservabilityData();
      
      expect(exportedData.metrics.totalMetrics).toBeGreaterThan(0);
      expect(exportedData.traces.activeSpans).toBeGreaterThanOrEqual(0);
      expect(exportedData.health.status).toMatch(/^(healthy|degraded|unhealthy)$/);
    });

    it('should calculate and monitor SLIs', async () => {
      // Generate some requests for SLI calculation
      for (let i = 0; i < 10; i++) {
        const { span, context, timer } = observabilityManager.startOperation('sli_test');
        
        // Vary the performance to test SLI calculations
        await new Promise(resolve => setTimeout(resolve, i < 8 ? 50 : 200)); // 2 slow requests
        
        observabilityManager.finishOperation(span, context, timer, {
          success: i < 9, // 1 failure
          statusCode: i < 9 ? 200 : 500
        });
      }

      // Wait for SLI calculation
      await new Promise(resolve => setTimeout(resolve, 100));

      const exportedData = observabilityManager.exportObservabilityData();
      expect(exportedData.slis).toBeInstanceOf(Array);
      expect(exportedData.slis.length).toBeGreaterThan(0);

      // Check for availability SLI
      const availabilitySLI = exportedData.slis.find(sli => sli.name === 'availability');
      expect(availabilitySLI).toBeDefined();
    });

    it('should provide comprehensive health status', () => {
      const health = observabilityManager.getHealth();

      expect(health.status).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(health.components.metrics).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(health.components.tracing).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(health.activeContexts).toBeGreaterThanOrEqual(0);
      expect(health.activeSpans).toBeGreaterThanOrEqual(0);
      expect(health.sliViolations).toBeGreaterThanOrEqual(0);
      expect(health.activeAlerts).toBeGreaterThanOrEqual(0);
    });

    it('should emit events for monitoring and alerting', (done) => {
      let eventsReceived = 0;
      const expectedEvents = ['operation-finished'];

      expectedEvents.forEach(eventName => {
        observabilityManager.on(eventName, () => {
          eventsReceived++;
          if (eventsReceived === expectedEvents.length) {
            done();
          }
        });
      });

      // Trigger events
      const { span, context, timer } = observabilityManager.startOperation('event_test');
      observabilityManager.finishOperation(span, context, timer, { success: true });
    });

    it('should handle correlation context inheritance', () => {
      const parentContext = observabilityManager.createCorrelationContext('parent_operation');
      const childContext = observabilityManager.createCorrelationContext(
        'child_operation',
        parentContext
      );

      expect(childContext.parentContext).toBe(parentContext);
      expect(childContext.correlationId).not.toBe(parentContext.correlationId);
    });

    it('should export complete observability data', () => {
      const exportedData = observabilityManager.exportObservabilityData();

      expect(exportedData.metrics).toBeDefined();
      expect(exportedData.traces).toBeDefined();
      expect(exportedData.slis).toBeInstanceOf(Array);
      expect(exportedData.baselines).toBeInstanceOf(Array);
      expect(exportedData.health).toBeDefined();

      // Verify structure
      expect(exportedData.metrics.totalMetrics).toBeGreaterThanOrEqual(0);
      expect(exportedData.traces.activeSpans).toBeGreaterThanOrEqual(0);
      expect(exportedData.health.status).toMatch(/^(healthy|degraded|unhealthy)$/);
    });
  });

  describe('Integration Testing', () => {
    let observabilityManager: ObservabilityManager;

    beforeEach(() => {
      observabilityManager = new ObservabilityManager({
        serviceName: 'integration-test',
        environment: 'test',
        enableMetrics: true,
        enableTracing: true
      });
    });

    afterEach(async () => {
      await observabilityManager.destroy();
    });

    it('should handle complex operation scenarios', async () => {
      // Simulate a complex business transaction
      const { span: orderSpan, context: orderContext, timer: orderTimer } = 
        observabilityManager.startOperation('process_order', undefined, {
          'order.id': '12345',
          'user.id': 'user789'
        });

      // Nested operation - payment processing
      const { span: paymentSpan, context: paymentContext, timer: paymentTimer } = 
        observabilityManager.startOperation('process_payment', orderContext, {
          'payment.method': 'credit_card',
          'payment.amount': 99.99
        });

      await new Promise(resolve => setTimeout(resolve, 30));

      observabilityManager.finishOperation(paymentSpan, paymentContext, paymentTimer, {
        success: true,
        statusCode: 200
      });

      // Nested operation - inventory update
      const { span: inventorySpan, context: inventoryContext, timer: inventoryTimer } = 
        observabilityManager.startOperation('update_inventory', orderContext, {
          'product.id': 'prod456',
          'quantity': 2
        });

      await new Promise(resolve => setTimeout(resolve, 20));

      observabilityManager.finishOperation(inventorySpan, inventoryContext, inventoryTimer, {
        success: true,
        statusCode: 200
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      observabilityManager.finishOperation(orderSpan, orderContext, orderTimer, {
        success: true,
        statusCode: 200
      });

      // Verify trace structure
      expect(orderSpan.childSpans).toHaveLength(2);
      expect(paymentSpan.parentSpan).toBe(orderSpan);
      expect(inventorySpan.parentSpan).toBe(orderSpan);
    });

    it('should handle high-throughput scenarios', async () => {
      const promises = [];
      const operationCount = 100;

      // Generate high load
      for (let i = 0; i < operationCount; i++) {
        const promise = (async () => {
          const { span, context, timer } = observabilityManager.startOperation(
            `operation_${i % 5}`, // 5 different operation types
            undefined,
            { 'operation.index': i }
          );

          // Random processing time
          await new Promise(resolve => setTimeout(resolve, Math.random() * 50));

          observabilityManager.finishOperation(span, context, timer, {
            success: Math.random() > 0.1, // 10% failure rate
            statusCode: Math.random() > 0.1 ? 200 : 500
          });
        })();

        promises.push(promise);
      }

      await Promise.all(promises);

      // Wait for metrics processing
      await new Promise(resolve => setTimeout(resolve, 200));

      const health = observabilityManager.getHealth();
      const exportedData = observabilityManager.exportObservabilityData();

      // System should remain healthy under load
      expect(['healthy', 'degraded']).toContain(health.status);
      expect(exportedData.metrics.totalMetrics).toBeGreaterThan(0);
    });
  });
});