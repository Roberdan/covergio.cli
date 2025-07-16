/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';

/**
 * Resource configuration interface
 */
export interface ResourceConfig {
  maxConnections: number;
  minConnections: number;
  connectionTimeout: number;
  idleTimeout: number;
  maxRetries: number;
  retryDelay: number;
  healthCheckInterval: number;
  enablePooling: boolean;
  enableHealthChecks: boolean;
}

/**
 * Connection interface
 */
export interface Connection {
  id: string;
  created: number;
  lastUsed: number;
  inUse: boolean;
  healthy: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isHealthy(): Promise<boolean>;
  reset(): Promise<void>;
}

/**
 * Connection pool statistics
 */
export interface ConnectionPoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  pendingRequests: number;
  totalCreated: number;
  totalDestroyed: number;
  totalAcquired: number;
  totalReleased: number;
  averageWaitTime: number;
  connectionUtilization: number;
  healthCheckFailures: number;
}

/**
 * Resource limit enforcement
 */
export interface ResourceLimits {
  maxMemoryUsage: number;
  maxCpuUsage: number;
  maxFileHandles: number;
  maxNetworkConnections: number;
  alertThresholds: {
    memory: number;
    cpu: number;
    fileHandles: number;
    connections: number;
  };
}

/**
 * Resource usage metrics
 */
export interface ResourceMetrics {
  memory: {
    used: number;
    total: number;
    utilization: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  connections: {
    total: number;
    active: number;
    utilization: number;
  };
  fileHandles: {
    open: number;
    available: number;
  };
  gc: {
    collections: number;
    duration: number;
    frequency: number;
  };
}

/**
 * Connection factory function type
 */
export type ConnectionFactory<T extends Connection> = () => Promise<T>;

/**
 * Advanced Resource Manager with Connection Pooling
 */
export class ResourceManager extends EventEmitter {
  private connectionPools = new Map<string, ConnectionPool<any>>();
  private resourceLimits: ResourceLimits;
  private monitoringInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private resourceMetrics: ResourceMetrics;

  constructor(limits: Partial<ResourceLimits> = {}) {
    super();

    this.resourceLimits = {
      maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
      maxCpuUsage: 80, // 80%
      maxFileHandles: 1000,
      maxNetworkConnections: 1000,
      alertThresholds: {
        memory: 0.8,
        cpu: 0.7,
        fileHandles: 0.9,
        connections: 0.8
      },
      ...limits
    };

    this.resourceMetrics = this.initializeMetrics();
    this.startMonitoring();
  }

  /**
   * Initialize resource metrics
   */
  private initializeMetrics(): ResourceMetrics {
    return {
      memory: {
        used: 0,
        total: 0,
        utilization: 0
      },
      cpu: {
        usage: 0,
        loadAverage: [0, 0, 0]
      },
      connections: {
        total: 0,
        active: 0,
        utilization: 0
      },
      fileHandles: {
        open: 0,
        available: 0
      },
      gc: {
        collections: 0,
        duration: 0,
        frequency: 0
      }
    };
  }

  /**
   * Create connection pool for a specific resource type
   */
  createConnectionPool<T extends Connection>(
    name: string,
    factory: ConnectionFactory<T>,
    config: Partial<ResourceConfig> = {}
  ): ConnectionPool<T> {
    const poolConfig: ResourceConfig = {
      maxConnections: 10,
      minConnections: 2,
      connectionTimeout: 5000,
      idleTimeout: 300000, // 5 minutes
      maxRetries: 3,
      retryDelay: 1000,
      healthCheckInterval: 30000,
      enablePooling: true,
      enableHealthChecks: true,
      ...config
    };

    const pool = new ConnectionPool<T>(name, factory, poolConfig);
    this.connectionPools.set(name, pool);

    // Setup event listeners
    pool.on('connection-created', (data) => {
      this.emit('connection-created', { pool: name, ...data });
      this.updateConnectionMetrics();
    });

    pool.on('connection-destroyed', (data) => {
      this.emit('connection-destroyed', { pool: name, ...data });
      this.updateConnectionMetrics();
    });

    pool.on('pool-exhausted', (data) => {
      this.emit('pool-exhausted', { pool: name, ...data });
    });

    pool.on('health-check-failed', (data) => {
      this.emit('health-check-failed', { pool: name, ...data });
    });

    this.emit('pool-created', { name, config: poolConfig });
    return pool;
  }

  /**
   * Get connection pool by name
   */
  getConnectionPool<T extends Connection>(name: string): ConnectionPool<T> | undefined {
    return this.connectionPools.get(name) as ConnectionPool<T>;
  }

  /**
   * Get all connection pool statistics
   */
  getAllPoolStatistics(): Record<string, ConnectionPoolStats> {
    const stats: Record<string, ConnectionPoolStats> = {};
    
    for (const [name, pool] of this.connectionPools.entries()) {
      stats[name] = pool.getStatistics();
    }
    
    return stats;
  }

  /**
   * Update connection metrics across all pools
   */
  private updateConnectionMetrics(): void {
    let totalConnections = 0;
    let activeConnections = 0;

    for (const pool of this.connectionPools.values()) {
      const stats = pool.getStatistics();
      totalConnections += stats.totalConnections;
      activeConnections += stats.activeConnections;
    }

    this.resourceMetrics.connections = {
      total: totalConnections,
      active: activeConnections,
      utilization: totalConnections > 0 ? activeConnections / totalConnections : 0
    };
  }

  /**
   * Start resource monitoring
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectResourceMetrics();
      this.checkResourceLimits();
    }, 5000);

    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, 30000);
  }

  /**
   * Collect current resource metrics
   */
  private collectResourceMetrics(): void {
    // Memory metrics
    const memUsage = process.memoryUsage();
    this.resourceMetrics.memory = {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      utilization: memUsage.heapUsed / memUsage.heapTotal
    };

    // CPU metrics (approximation using process CPU usage)
    if (process.cpuUsage) {
      const cpuUsage = process.cpuUsage();
      const totalUsage = cpuUsage.user + cpuUsage.system;
      this.resourceMetrics.cpu = {
        usage: totalUsage / 1000000, // Convert to percentage approximation
        loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0]
      };
    }

    // Update connection metrics
    this.updateConnectionMetrics();

    // File handle metrics (platform-specific approximation)
    this.resourceMetrics.fileHandles = {
      open: this.approximateOpenFileHandles(),
      available: this.resourceLimits.maxFileHandles - this.approximateOpenFileHandles()
    };

    this.emit('metrics-updated', this.resourceMetrics);
  }

  /**
   * Approximate open file handles (rough estimation)
   */
  private approximateOpenFileHandles(): number {
    // This is a rough approximation - in production, you'd use system-specific tools
    let handles = 10; // Base handles for process
    handles += this.resourceMetrics.connections.total * 2; // Estimate 2 handles per connection
    return handles;
  }

  /**
   * Check resource limits and emit alerts
   */
  private checkResourceLimits(): void {
    const { memory, cpu, connections, fileHandles } = this.resourceMetrics;
    const thresholds = this.resourceLimits.alertThresholds;

    // Memory threshold check
    if (memory.utilization > thresholds.memory) {
      this.emit('resource-limit-warning', {
        resource: 'memory',
        usage: memory.utilization,
        threshold: thresholds.memory,
        recommendations: [
          'Consider forcing garbage collection',
          'Clear unnecessary caches',
          'Review memory-intensive operations'
        ]
      });
    }

    // CPU threshold check
    if (cpu.usage > thresholds.cpu) {
      this.emit('resource-limit-warning', {
        resource: 'cpu',
        usage: cpu.usage,
        threshold: thresholds.cpu,
        recommendations: [
          'Reduce CPU-intensive operations',
          'Consider request throttling',
          'Optimize algorithms'
        ]
      });
    }

    // Connection threshold check
    if (connections.utilization > thresholds.connections) {
      this.emit('resource-limit-warning', {
        resource: 'connections',
        usage: connections.utilization,
        threshold: thresholds.connections,
        recommendations: [
          'Increase connection pool sizes',
          'Implement connection sharing',
          'Review connection lifecycle'
        ]
      });
    }

    // File handle threshold check
    if (fileHandles.open > this.resourceLimits.maxFileHandles * thresholds.fileHandles) {
      this.emit('resource-limit-warning', {
        resource: 'fileHandles',
        usage: fileHandles.open,
        threshold: this.resourceLimits.maxFileHandles * thresholds.fileHandles,
        recommendations: [
          'Close unused file handles',
          'Review file operations',
          'Implement file handle pooling'
        ]
      });
    }
  }

  /**
   * Perform health checks on all pools
   */
  private async performHealthChecks(): Promise<void> {
    for (const [name, pool] of this.connectionPools.entries()) {
      try {
        await pool.performHealthCheck();
      } catch (error) {
        this.emit('pool-health-check-failed', {
          pool: name,
          error: (error as Error).message
        });
      }
    }
  }

  /**
   * Get current resource metrics
   */
  getResourceMetrics(): ResourceMetrics {
    return { ...this.resourceMetrics };
  }

  /**
   * Get resource health status
   */
  getResourceHealth(): {
    status: 'healthy' | 'degraded' | 'critical';
    memory: 'healthy' | 'warning' | 'critical';
    cpu: 'healthy' | 'warning' | 'critical';
    connections: 'healthy' | 'warning' | 'critical';
    recommendations: string[];
  } {
    const { memory, cpu, connections } = this.resourceMetrics;
    const thresholds = this.resourceLimits.alertThresholds;

    const memoryStatus = memory.utilization > 0.9 ? 'critical' : 
                        memory.utilization > thresholds.memory ? 'warning' : 'healthy';
    
    const cpuStatus = cpu.usage > 90 ? 'critical' : 
                     cpu.usage > thresholds.cpu ? 'warning' : 'healthy';
    
    const connectionStatus = connections.utilization > 0.95 ? 'critical' : 
                            connections.utilization > thresholds.connections ? 'warning' : 'healthy';

    const criticalCount = [memoryStatus, cpuStatus, connectionStatus].filter(s => s === 'critical').length;
    const warningCount = [memoryStatus, cpuStatus, connectionStatus].filter(s => s === 'warning').length;

    const overallStatus = criticalCount > 0 ? 'critical' : 
                         warningCount > 0 ? 'degraded' : 'healthy';

    const recommendations: string[] = [];
    if (memoryStatus !== 'healthy') {
      recommendations.push('Optimize memory usage - consider garbage collection or cache cleanup');
    }
    if (cpuStatus !== 'healthy') {
      recommendations.push('Reduce CPU load - throttle requests or optimize processing');
    }
    if (connectionStatus !== 'healthy') {
      recommendations.push('Optimize connection usage - increase pool sizes or improve sharing');
    }

    return {
      status: overallStatus,
      memory: memoryStatus,
      cpu: cpuStatus,
      connections: connectionStatus,
      recommendations
    };
  }

  /**
   * Force resource cleanup
   */
  async forceResourceCleanup(): Promise<void> {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Clear idle connections from all pools
    for (const pool of this.connectionPools.values()) {
      await pool.cleanupIdleConnections();
    }

    this.emit('resource-cleanup-performed');
  }

  /**
   * Scale connection pools based on current load
   */
  async autoscalePools(): Promise<void> {
    for (const [name, pool] of this.connectionPools.entries()) {
      const stats = pool.getStatistics();
      
      // Scale up if utilization is high
      if (stats.connectionUtilization > 0.8 && stats.totalConnections < pool['config'].maxConnections) {
        await pool.preWarmConnections(Math.min(2, pool['config'].maxConnections - stats.totalConnections));
        this.emit('pool-scaled-up', { pool: name, connections: stats.totalConnections });
      }
      
      // Scale down if utilization is low (but keep minimum)
      if (stats.connectionUtilization < 0.3 && stats.totalConnections > pool['config'].minConnections) {
        await pool.cleanupIdleConnections();
        this.emit('pool-scaled-down', { pool: name, connections: stats.totalConnections });
      }
    }
  }

  /**
   * Destroy all pools and cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Destroy all connection pools
    const destroyPromises = Array.from(this.connectionPools.values()).map(pool => pool.destroy());
    await Promise.all(destroyPromises);
    
    this.connectionPools.clear();
    this.emit('destroyed');
  }
}

/**
 * Connection Pool implementation
 */
export class ConnectionPool<T extends Connection> extends EventEmitter {
  private available: T[] = [];
  private borrowed = new Set<T>();
  private pendingRequests: Array<{
    resolve: (connection: T) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];

  private stats: ConnectionPoolStats;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(
    private name: string,
    private factory: ConnectionFactory<T>,
    private config: ResourceConfig
  ) {
    super();

    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      pendingRequests: 0,
      totalCreated: 0,
      totalDestroyed: 0,
      totalAcquired: 0,
      totalReleased: 0,
      averageWaitTime: 0,
      connectionUtilization: 0,
      healthCheckFailures: 0
    };

    this.initialize();
  }

  /**
   * Initialize pool with minimum connections
   */
  private async initialize(): Promise<void> {
    if (this.config.enablePooling) {
      await this.preWarmConnections(this.config.minConnections);
    }

    if (this.config.enableHealthChecks) {
      this.startHealthChecks();
    }
  }

  /**
   * Pre-warm pool with connections
   */
  async preWarmConnections(count: number): Promise<void> {
    const promises = [];
    for (let i = 0; i < count; i++) {
      if (this.getTotalConnections() < this.config.maxConnections) {
        promises.push(this.createConnection());
      }
    }
    await Promise.all(promises);
  }

  /**
   * Create new connection
   */
  private async createConnection(): Promise<T> {
    try {
      const connection = await this.factory();
      await connection.connect();
      
      this.available.push(connection);
      this.stats.totalCreated++;
      this.updateStats();
      
      this.emit('connection-created', { connectionId: connection.id });
      return connection;
    } catch (error) {
      this.emit('connection-creation-failed', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Acquire connection from pool
   */
  async acquire(): Promise<T> {
    const startTime = Date.now();
    
    // Try to get available connection
    let connection = this.available.pop();
    
    if (connection) {
      connection.inUse = true;
      connection.lastUsed = Date.now();
      this.borrowed.add(connection);
      this.stats.totalAcquired++;
      this.updateStats();
      return connection;
    }

    // Create new connection if under limit
    if (this.getTotalConnections() < this.config.maxConnections) {
      try {
        connection = await this.createConnection();
        connection.inUse = true;
        connection.lastUsed = Date.now();
        this.borrowed.add(connection);
        this.available.splice(this.available.indexOf(connection), 1);
        this.stats.totalAcquired++;
        this.updateStats();
        return connection;
      } catch (error) {
        // Fall through to wait for available connection
      }
    }

    // Wait for available connection
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.pendingRequests.findIndex(req => req.resolve === resolve);
        if (index !== -1) {
          this.pendingRequests.splice(index, 1);
        }
        reject(new Error(`Connection timeout after ${this.config.connectionTimeout}ms`));
      }, this.config.connectionTimeout);

      this.pendingRequests.push({
        resolve: (conn: T) => {
          clearTimeout(timeout);
          const waitTime = Date.now() - startTime;
          this.updateAverageWaitTime(waitTime);
          resolve(conn);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timestamp: startTime
      });

      this.updateStats();
    });
  }

  /**
   * Release connection back to pool
   */
  async release(connection: T): Promise<void> {
    if (!this.borrowed.has(connection)) {
      return;
    }

    this.borrowed.delete(connection);
    connection.inUse = false;

    try {
      // Reset connection state
      await connection.reset();
      
      // Return to available pool
      this.available.push(connection);
      this.stats.totalReleased++;
      
      // Process pending requests
      this.processPendingRequests();
      
    } catch (error) {
      // Connection is corrupted, destroy it
      await this.destroyConnection(connection);
    }

    this.updateStats();
  }

  /**
   * Process pending connection requests
   */
  private processPendingRequests(): void {
    while (this.pendingRequests.length > 0 && this.available.length > 0) {
      const request = this.pendingRequests.shift()!;
      const connection = this.available.pop()!;
      
      connection.inUse = true;
      connection.lastUsed = Date.now();
      this.borrowed.add(connection);
      this.stats.totalAcquired++;
      
      request.resolve(connection);
    }
  }

  /**
   * Destroy connection
   */
  private async destroyConnection(connection: T): Promise<void> {
    try {
      await connection.disconnect();
    } catch (error) {
      // Ignore disconnect errors
    }

    this.available = this.available.filter(c => c.id !== connection.id);
    this.borrowed.delete(connection);
    this.stats.totalDestroyed++;
    
    this.emit('connection-destroyed', { connectionId: connection.id });
    this.updateStats();
  }

  /**
   * Cleanup idle connections
   */
  async cleanupIdleConnections(): Promise<void> {
    const now = Date.now();
    const idleThreshold = now - this.config.idleTimeout;
    
    const idleConnections = this.available.filter(conn => conn.lastUsed < idleThreshold);
    
    for (const connection of idleConnections) {
      if (this.getTotalConnections() > this.config.minConnections) {
        await this.destroyConnection(connection);
      }
    }
  }

  /**
   * Perform health check on all connections
   */
  async performHealthCheck(): Promise<void> {
    const allConnections = [...this.available, ...this.borrowed];
    
    for (const connection of allConnections) {
      try {
        connection.healthy = await connection.isHealthy();
        if (!connection.healthy) {
          this.stats.healthCheckFailures++;
          await this.destroyConnection(connection);
        }
      } catch (error) {
        this.stats.healthCheckFailures++;
        await this.destroyConnection(connection);
        this.emit('health-check-failed', { 
          connectionId: connection.id, 
          error: (error as Error).message 
        });
      }
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
      await this.cleanupIdleConnections();
    }, this.config.healthCheckInterval);
  }

  /**
   * Update pool statistics
   */
  private updateStats(): void {
    this.stats.totalConnections = this.getTotalConnections();
    this.stats.activeConnections = this.borrowed.size;
    this.stats.idleConnections = this.available.length;
    this.stats.pendingRequests = this.pendingRequests.length;
    this.stats.connectionUtilization = this.stats.totalConnections > 0 ? 
      this.stats.activeConnections / this.stats.totalConnections : 0;
  }

  /**
   * Update average wait time
   */
  private updateAverageWaitTime(waitTime: number): void {
    if (this.stats.averageWaitTime === 0) {
      this.stats.averageWaitTime = waitTime;
    } else {
      this.stats.averageWaitTime = (this.stats.averageWaitTime + waitTime) / 2;
    }
  }

  /**
   * Get total connections
   */
  private getTotalConnections(): number {
    return this.available.length + this.borrowed.size;
  }

  /**
   * Get pool statistics
   */
  getStatistics(): ConnectionPoolStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Destroy pool and all connections
   */
  async destroy(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Reject all pending requests
    this.pendingRequests.forEach(request => {
      request.reject(new Error('Pool is being destroyed'));
    });
    this.pendingRequests = [];

    // Destroy all connections
    const allConnections = [...this.available, ...this.borrowed];
    await Promise.all(allConnections.map(conn => this.destroyConnection(conn)));

    this.emit('pool-destroyed');
  }
}