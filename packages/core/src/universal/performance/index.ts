/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Export cache management
export {
  CacheManager,
  type CacheEntry,
  type CacheConfig,
  type CacheMetrics,
  type InvalidationOptions
} from './CacheManager.js';

// Export request queue
export {
  RequestQueue,
  RequestPriority,
  type RequestQueueConfig,
  type QueueMetrics,
  type RequestProcessor,
  type BatchRequestProcessor
} from './RequestQueue.js';

// Export circuit breaker
export {
  CircuitBreaker,
  CircuitBreakerFactory,
  CircuitState,
  type CircuitBreakerConfig,
  type CircuitBreakerMetrics
} from './CircuitBreaker.js';

// Export performance manager
export {
  PerformanceManager,
  type PerformanceConfig,
  type PerformanceMetrics,
  type PerformanceHealth
} from './PerformanceManager.js';

// Export memory profiler and resource manager
export {
  MemoryProfiler,
  type MemorySnapshot,
  type MemoryProfile,
  type ResourceLimits as MemoryResourceLimits,
  type PoolStatistics,
  ObjectPool
} from './MemoryProfiler.js';

export {
  ResourceManager,
  ConnectionPool,
  type ResourceConfig,
  type Connection,
  type ConnectionPoolStats,
  type ResourceLimits,
  type ResourceMetrics,
  type ConnectionFactory
} from './ResourceManager.js';

export {
  GCOptimizer,
  type GCOptimizerConfig,
  type GCStatistics,
  type GCTiming,
  MemoryPressureLevel
} from './GCOptimizer.js';

// Export metrics collection and observability
export {
  MetricsCollector,
  MetricType,
  type MetricConfig,
  type MetricDataPoint,
  type MetricMeasurement,
  type MetricsConfig
} from './MetricsCollector.js';

export {
  OpenTelemetryIntegration,
  type SpanContext,
  type Span,
  type SamplingConfig,
  type CollectorConfig,
  type InstrumentationConfig,
  type OpenTelemetryConfig,
  type OTelMetricInstrument
} from './OpenTelemetryIntegration.js';

export {
  ObservabilityManager,
  type CorrelationContext,
  type BusinessMetricDefinition,
  type ObservabilityConfig,
  type SLIConfig,
  type AlertConfig,
  type PerformanceBaseline
} from './ObservabilityManager.js';