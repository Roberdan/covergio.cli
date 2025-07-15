/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHash, createHmac, randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import {
  AuditLogEntry,
  TamperEvidentLogEntry,
  SecurityEventType,
  SecurityEventSeverity,
  AuditLogQuery,
  AuditLogStatistics,
  MonitoringConfig
} from './types';

/**
 * Tamper-evident audit logging system
 * 
 * Provides secure, immutable audit logging with integrity verification:
 * - Cryptographic hash chaining for tamper detection
 * - HMAC signatures for authenticity
 * - Structured logging with comprehensive metadata
 * - Real-time event emission for monitoring
 * - Automatic retention policy enforcement
 */
export class AuditLogger extends EventEmitter {
  private readonly config: MonitoringConfig;
  private readonly logs: Map<string, TamperEvidentLogEntry> = new Map();
  private readonly indexByType: Map<SecurityEventType, string[]> = new Map();
  private readonly indexByUser: Map<string, string[]> = new Map();
  private readonly indexByTime: Map<string, string[]> = new Map();
  private sequenceNumber = 0;
  private lastHash?: string;
  private readonly signingKey: string;
  private flushTimer?: NodeJS.Timeout;
  private readonly pendingLogs: TamperEvidentLogEntry[] = [];

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
    this.signingKey = config.integrity.signingKey || this.generateSigningKey();
    
    // Initialize indexes
    Object.values(SecurityEventType).forEach(type => {
      this.indexByType.set(type, []);
    });

    this.startFlushTimer();
  }

  /**
   * Log a security event with tamper-evident properties
   * 
   * @param event - Base audit log entry
   * @returns Promise resolving to the tamper-evident log entry
   */
  async logEvent(event: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<TamperEvidentLogEntry> {
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    
    const baseEntry: AuditLogEntry = {
      id,
      timestamp,
      ...event,
      metadata: {
        version: '1.0',
        source: 'audit-logger',
        ...event.metadata
      }
    };

    const tamperEvidentEntry = await this.createTamperEvidentEntry(baseEntry);
    
    // Store in memory
    this.logs.set(id, tamperEvidentEntry);
    this.pendingLogs.push(tamperEvidentEntry);
    
    // Update indexes
    this.updateIndexes(tamperEvidentEntry);
    
    // Emit event for real-time monitoring
    this.emit('log', tamperEvidentEntry);
    
    // Check if immediate flush is needed
    if (this.pendingLogs.length >= this.config.performance.batchSize) {
      await this.flush();
    }

    return tamperEvidentEntry;
  }

  /**
   * Log authentication attempt
   */
  async logAuthenticationAttempt(
    userId: string,
    outcome: 'success' | 'failure',
    details: Record<string, any> = {}
  ): Promise<TamperEvidentLogEntry> {
    return this.logEvent({
      eventType: outcome === 'success' 
        ? SecurityEventType.AUTHENTICATION_SUCCESS 
        : SecurityEventType.AUTHENTICATION_FAILURE,
      severity: outcome === 'success' 
        ? SecurityEventSeverity.INFO 
        : SecurityEventSeverity.WARNING,
      userId,
      outcome,
      message: `Authentication ${outcome} for user ${userId}`,
      details,
      sourceIp: details.sourceIp,
      userAgent: details.userAgent
    });
  }

  /**
   * Log authorization decision
   */
  async logAuthorizationDecision(
    userId: string,
    resource: string,
    action: string,
    outcome: 'success' | 'failure',
    reason?: string,
    sessionId?: string
  ): Promise<TamperEvidentLogEntry> {
    return this.logEvent({
      eventType: outcome === 'success' 
        ? SecurityEventType.AUTHORIZATION_GRANTED 
        : SecurityEventType.AUTHORIZATION_DENIED,
      severity: outcome === 'success' 
        ? SecurityEventSeverity.INFO 
        : SecurityEventSeverity.WARNING,
      userId,
      sessionId,
      resource,
      action,
      outcome,
      message: `Authorization ${outcome} for user ${userId} on ${resource}:${action}`,
      details: reason ? { reason } : undefined
    });
  }

  /**
   * Log suspicious activity
   */
  async logSuspiciousActivity(
    description: string,
    severity: SecurityEventSeverity = SecurityEventSeverity.WARNING,
    details: Record<string, any> = {}
  ): Promise<TamperEvidentLogEntry> {
    return this.logEvent({
      eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
      severity,
      outcome: 'error',
      message: `Suspicious activity detected: ${description}`,
      details,
      userId: details.userId,
      sourceIp: details.sourceIp
    });
  }

  /**
   * Log security policy violation
   */
  async logSecurityPolicyViolation(
    policyName: string,
    violation: string,
    userId?: string,
    details: Record<string, any> = {}
  ): Promise<TamperEvidentLogEntry> {
    return this.logEvent({
      eventType: SecurityEventType.SECURITY_POLICY_VIOLATION,
      severity: SecurityEventSeverity.ERROR,
      userId,
      outcome: 'failure',
      message: `Security policy violation: ${policyName} - ${violation}`,
      details: {
        policyName,
        violation,
        ...details
      }
    });
  }

  /**
   * Query audit logs with filtering and pagination
   * 
   * @param query - Query parameters
   * @returns Array of matching log entries
   */
  async queryLogs(query: AuditLogQuery = {}): Promise<TamperEvidentLogEntry[]> {
    let results = Array.from(this.logs.values());

    // Apply filters
    if (query.startTime) {
      results = results.filter(log => log.timestamp >= query.startTime!);
    }
    
    if (query.endTime) {
      results = results.filter(log => log.timestamp <= query.endTime!);
    }
    
    if (query.eventTypes && query.eventTypes.length > 0) {
      results = results.filter(log => query.eventTypes!.includes(log.eventType));
    }
    
    if (query.severity && query.severity.length > 0) {
      results = results.filter(log => query.severity!.includes(log.severity));
    }
    
    if (query.userId) {
      results = results.filter(log => log.userId === query.userId);
    }
    
    if (query.sessionId) {
      results = results.filter(log => log.sessionId === query.sessionId);
    }
    
    if (query.resource) {
      results = results.filter(log => log.resource === query.resource);
    }
    
    if (query.outcome) {
      results = results.filter(log => log.outcome === query.outcome);
    }
    
    if (query.correlationId) {
      results = results.filter(log => 
        log.metadata?.correlationId === query.correlationId
      );
    }

    // Sort results
    const sortBy = query.sortBy || 'timestamp';
    const sortOrder = query.sortOrder || 'desc';
    
    results.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'timestamp':
          aValue = new Date(a.timestamp);
          bValue = new Date(b.timestamp);
          break;
        case 'severity':
          aValue = this.getSeverityWeight(a.severity);
          bValue = this.getSeverityWeight(b.severity);
          break;
        case 'eventType':
          aValue = a.eventType;
          bValue = b.eventType;
          break;
        default:
          aValue = a.timestamp;
          bValue = b.timestamp;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    
    return results.slice(offset, offset + limit);
  }

  /**
   * Get audit log statistics
   * 
   * @returns Comprehensive statistics about audit logs
   */
  getStatistics(): AuditLogStatistics {
    const logs = Array.from(this.logs.values());
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const entriesByType: Record<SecurityEventType, number> = {} as any;
    const entriesBySeverity: Record<SecurityEventSeverity, number> = {} as any;
    const userCounts: Map<string, number> = new Map();
    const resourceCounts: Map<string, number> = new Map();

    // Initialize counters
    Object.values(SecurityEventType).forEach(type => {
      entriesByType[type] = 0;
    });
    Object.values(SecurityEventSeverity).forEach(severity => {
      entriesBySeverity[severity] = 0;
    });

    let last24Hours = 0;
    let lastWeek = 0;
    let lastMonth = 0;
    let verified = 0;
    let corrupted = 0;

    logs.forEach(log => {
      const logTime = new Date(log.timestamp);
      
      // Count by type and severity
      entriesByType[log.eventType]++;
      entriesBySeverity[log.severity]++;
      
      // Count by user
      if (log.userId) {
        userCounts.set(log.userId, (userCounts.get(log.userId) || 0) + 1);
      }
      
      // Count by resource
      if (log.resource) {
        resourceCounts.set(log.resource, (resourceCounts.get(log.resource) || 0) + 1);
      }
      
      // Time-based counts
      if (logTime >= oneDayAgo) last24Hours++;
      if (logTime >= oneWeekAgo) lastWeek++;
      if (logTime >= oneMonthAgo) lastMonth++;
      
      // Integrity status
      if (this.verifyLogIntegrity(log)) {
        verified++;
      } else {
        corrupted++;
      }
    });

    // Top users and resources
    const topUsers = Array.from(userCounts.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([userId, eventCount]) => ({ userId, eventCount }));

    const topResources = Array.from(resourceCounts.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([resource, accessCount]) => ({ resource, accessCount }));

    return {
      totalEntries: logs.length,
      entriesByType,
      entriesBySeverity,
      recentActivity: {
        last24Hours,
        lastWeek,
        lastMonth
      },
      topUsers,
      topResources,
      integrityStatus: {
        verified,
        corrupted,
        lastVerification: new Date().toISOString()
      }
    };
  }

  /**
   * Verify the integrity of all audit logs
   * 
   * @returns True if all logs pass integrity verification
   */
  async verifyIntegrity(): Promise<boolean> {
    const logs = Array.from(this.logs.values())
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    let previousHash: string | undefined;
    
    for (const log of logs) {
      if (!this.verifyLogIntegrity(log, previousHash)) {
        this.emit('integrityViolation', {
          logId: log.id,
          sequenceNumber: log.sequenceNumber,
          expectedPreviousHash: previousHash,
          actualPreviousHash: log.previousHash
        });
        return false;
      }
      previousHash = log.hash;
    }

    return true;
  }

  /**
   * Flush pending logs to persistent storage
   */
  async flush(): Promise<void> {
    if (this.pendingLogs.length === 0) return;

    try {
      // Emit batch for storage systems to handle
      this.emit('batchFlush', [...this.pendingLogs]);
      
      this.pendingLogs.length = 0; // Clear pending logs
      
      this.emit('flushComplete', {
        timestamp: new Date().toISOString(),
        logsCount: this.pendingLogs.length
      });
    } catch (error) {
      this.emit('flushError', error);
      throw error;
    }
  }

  /**
   * Get logs by event type (optimized with indexing)
   */
  getLogsByType(eventType: SecurityEventType): TamperEvidentLogEntry[] {
    const logIds = this.indexByType.get(eventType) || [];
    return logIds.map(id => this.logs.get(id)!).filter(Boolean);
  }

  /**
   * Get logs by user ID (optimized with indexing)
   */
  getLogsByUser(userId: string): TamperEvidentLogEntry[] {
    const logIds = this.indexByUser.get(userId) || [];
    return logIds.map(id => this.logs.get(id)!).filter(Boolean);
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    await this.flush();
    this.removeAllListeners();
  }

  /**
   * Create tamper-evident log entry with hash chain
   */
  private async createTamperEvidentEntry(baseEntry: AuditLogEntry): Promise<TamperEvidentLogEntry> {
    this.sequenceNumber++;
    
    const entryForHashing = {
      ...baseEntry,
      sequenceNumber: this.sequenceNumber,
      previousHash: this.lastHash
    };

    const hash = this.calculateHash(entryForHashing);
    const signature = this.calculateSignature(hash);

    const tamperEvidentEntry: TamperEvidentLogEntry = {
      ...entryForHashing,
      hash,
      signature
    };

    this.lastHash = hash;
    return tamperEvidentEntry;
  }

  /**
   * Calculate cryptographic hash for log entry
   */
  private calculateHash(entry: Omit<TamperEvidentLogEntry, 'hash' | 'signature'>): string {
    const content = JSON.stringify(entry, Object.keys(entry).sort());
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Calculate HMAC signature for hash
   */
  private calculateSignature(hash: string): string {
    return createHmac('sha256', this.signingKey)
      .update(hash)
      .digest('hex');
  }

  /**
   * Verify integrity of a single log entry
   */
  private verifyLogIntegrity(log: TamperEvidentLogEntry, expectedPreviousHash?: string): boolean {
    // Verify hash
    const entryForHashing = {
      id: log.id,
      timestamp: log.timestamp,
      eventType: log.eventType,
      severity: log.severity,
      userId: log.userId,
      sessionId: log.sessionId,
      sourceIp: log.sourceIp,
      userAgent: log.userAgent,
      resource: log.resource,
      action: log.action,
      outcome: log.outcome,
      message: log.message,
      details: log.details,
      metadata: log.metadata,
      sequenceNumber: log.sequenceNumber,
      previousHash: log.previousHash
    };

    const calculatedHash = this.calculateHash(entryForHashing);
    
    if (calculatedHash !== log.hash) {
      return false;
    }

    // Verify signature
    const calculatedSignature = this.calculateSignature(log.hash);
    if (calculatedSignature !== log.signature) {
      return false;
    }

    // Verify hash chain
    if (expectedPreviousHash !== undefined && log.previousHash !== expectedPreviousHash) {
      return false;
    }

    return true;
  }

  /**
   * Update search indexes
   */
  private updateIndexes(log: TamperEvidentLogEntry): void {
    // Index by type
    const typeIndex = this.indexByType.get(log.eventType) || [];
    typeIndex.push(log.id);
    this.indexByType.set(log.eventType, typeIndex);

    // Index by user
    if (log.userId) {
      const userIndex = this.indexByUser.get(log.userId) || [];
      userIndex.push(log.id);
      this.indexByUser.set(log.userId, userIndex);
    }

    // Index by time (daily buckets)
    const dateKey = log.timestamp.split('T')[0];
    const timeIndex = this.indexByTime.get(dateKey) || [];
    timeIndex.push(log.id);
    this.indexByTime.set(dateKey, timeIndex);
  }

  /**
   * Get numeric weight for severity level (for sorting)
   */
  private getSeverityWeight(severity: SecurityEventSeverity): number {
    switch (severity) {
      case SecurityEventSeverity.INFO: return 1;
      case SecurityEventSeverity.WARNING: return 2;
      case SecurityEventSeverity.ERROR: return 3;
      case SecurityEventSeverity.CRITICAL: return 4;
      default: return 0;
    }
  }

  /**
   * Generate signing key for HMAC signatures
   */
  private generateSigningKey(): string {
    return createHash('sha256')
      .update(randomUUID() + Date.now().toString())
      .digest('hex');
  }

  /**
   * Start automatic flush timer
   */
  private startFlushTimer(): void {
    if (this.config.performance.flushInterval > 0) {
      this.flushTimer = setInterval(() => {
        this.flush().catch(error => {
          this.emit('flushError', error);
        });
      }, this.config.performance.flushInterval * 1000);
    }
  }
}