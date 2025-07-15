/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuditLogger } from '../AuditLogger';
import { 
  SecurityEventType, 
  SecurityEventSeverity, 
  MonitoringConfig,
  TamperEvidentLogEntry 
} from '../types';

describe('AuditLogger', () => {
  let auditLogger: AuditLogger;
  let config: MonitoringConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      alerting: {
        enabled: true,
        evaluationInterval: 60,
        maxAlertsPerHour: 100
      },
      retention: {
        defaultPolicy: 'default',
        policies: []
      },
      integrity: {
        verificationEnabled: true,
        verificationInterval: 24,
        signingKey: 'test-signing-key-for-hmac-verification'
      },
      performance: {
        batchSize: 100,
        flushInterval: 30,
        maxMemoryUsage: 512
      },
      storage: {
        backend: 'file',
        config: {},
        compression: false,
        encryption: false
      }
    };

    auditLogger = new AuditLogger(config);
  });

  afterEach(async () => {
    await auditLogger.cleanup();
  });

  describe('Event Logging', () => {
    it('should log events with tamper-evident properties', async () => {
      const event = {
        eventType: SecurityEventType.AUTHENTICATION_SUCCESS,
        severity: SecurityEventSeverity.INFO,
        outcome: 'success' as const,
        message: 'Test authentication success',
        userId: 'test-user'
      };

      const logEntry = await auditLogger.logEvent(event);

      expect(logEntry).toMatchObject({
        eventType: SecurityEventType.AUTHENTICATION_SUCCESS,
        severity: SecurityEventSeverity.INFO,
        outcome: 'success',
        message: 'Test authentication success',
        userId: 'test-user'
      });

      expect(logEntry.id).toBeDefined();
      expect(logEntry.timestamp).toBeDefined();
      expect(logEntry.hash).toBeDefined();
      expect(logEntry.signature).toBeDefined();
      expect(logEntry.sequenceNumber).toBe(1);
      expect(logEntry.previousHash).toBeUndefined(); // First entry has no previous hash
    });

    it('should create hash chain for sequential entries', async () => {
      const event1 = {
        eventType: SecurityEventType.AUTHENTICATION_SUCCESS,
        severity: SecurityEventSeverity.INFO,
        outcome: 'success' as const,
        message: 'First event'
      };

      const event2 = {
        eventType: SecurityEventType.AUTHENTICATION_FAILURE,
        severity: SecurityEventSeverity.WARNING,
        outcome: 'failure' as const,
        message: 'Second event'
      };

      const logEntry1 = await auditLogger.logEvent(event1);
      const logEntry2 = await auditLogger.logEvent(event2);

      expect(logEntry1.sequenceNumber).toBe(1);
      expect(logEntry2.sequenceNumber).toBe(2);
      expect(logEntry2.previousHash).toBe(logEntry1.hash);
    });

    it('should emit log events', async () => {
      const logEventSpy = vi.fn();
      auditLogger.on('log', logEventSpy);

      const event = {
        eventType: SecurityEventType.AUTHENTICATION_SUCCESS,
        severity: SecurityEventSeverity.INFO,
        outcome: 'success' as const,
        message: 'Test event'
      };

      await auditLogger.logEvent(event);

      expect(logEventSpy).toHaveBeenCalledOnce();
      expect(logEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityEventType.AUTHENTICATION_SUCCESS,
          message: 'Test event'
        })
      );
    });
  });

  describe('Specialized Logging Methods', () => {
    it('should log authentication attempts correctly', async () => {
      const successEntry = await auditLogger.logAuthenticationAttempt(
        'test-user',
        'success',
        { sourceIp: '192.168.1.100' }
      );

      expect(successEntry.eventType).toBe(SecurityEventType.AUTHENTICATION_SUCCESS);
      expect(successEntry.severity).toBe(SecurityEventSeverity.INFO);
      expect(successEntry.userId).toBe('test-user');
      expect(successEntry.sourceIp).toBe('192.168.1.100');

      const failureEntry = await auditLogger.logAuthenticationAttempt(
        'test-user',
        'failure',
        { sourceIp: '192.168.1.100' }
      );

      expect(failureEntry.eventType).toBe(SecurityEventType.AUTHENTICATION_FAILURE);
      expect(failureEntry.severity).toBe(SecurityEventSeverity.WARNING);
    });

    it('should log authorization decisions correctly', async () => {
      const successEntry = await auditLogger.logAuthorizationDecision(
        'test-user',
        'documents',
        'read',
        'success'
      );

      expect(successEntry.eventType).toBe(SecurityEventType.AUTHORIZATION_GRANTED);
      expect(successEntry.severity).toBe(SecurityEventSeverity.INFO);
      expect(successEntry.resource).toBe('documents');
      expect(successEntry.action).toBe('read');

      const failureEntry = await auditLogger.logAuthorizationDecision(
        'test-user',
        'admin-panel',
        'access',
        'failure',
        'Insufficient permissions'
      );

      expect(failureEntry.eventType).toBe(SecurityEventType.AUTHORIZATION_DENIED);
      expect(failureEntry.severity).toBe(SecurityEventSeverity.WARNING);
      expect(failureEntry.details?.reason).toBe('Insufficient permissions');
    });

    it('should log suspicious activity correctly', async () => {
      const entry = await auditLogger.logSuspiciousActivity(
        'Multiple failed login attempts from same IP',
        SecurityEventSeverity.WARNING,
        { sourceIp: '192.168.1.100', attempts: 5 }
      );

      expect(entry.eventType).toBe(SecurityEventType.SUSPICIOUS_ACTIVITY);
      expect(entry.severity).toBe(SecurityEventSeverity.WARNING);
      expect(entry.message).toContain('Multiple failed login attempts');
      expect(entry.details?.attempts).toBe(5);
    });

    it('should log security policy violations correctly', async () => {
      const entry = await auditLogger.logSecurityPolicyViolation(
        'Password Policy',
        'Password does not meet complexity requirements',
        'test-user',
        { passwordLength: 6, requiresSpecialChars: true }
      );

      expect(entry.eventType).toBe(SecurityEventType.SECURITY_POLICY_VIOLATION);
      expect(entry.severity).toBe(SecurityEventSeverity.ERROR);
      expect(entry.details?.policyName).toBe('Password Policy');
      expect(entry.details?.violation).toBe('Password does not meet complexity requirements');
    });
  });

  describe('Log Querying', () => {
    beforeEach(async () => {
      // Add some test data
      await auditLogger.logAuthenticationAttempt('user1', 'success');
      await auditLogger.logAuthenticationAttempt('user2', 'failure');
      await auditLogger.logAuthorizationDecision('user1', 'documents', 'read', 'success');
      await auditLogger.logSuspiciousActivity('Test suspicious activity');
    });

    it('should query logs by event type', async () => {
      const authLogs = await auditLogger.queryLogs({
        eventTypes: [SecurityEventType.AUTHENTICATION_SUCCESS, SecurityEventType.AUTHENTICATION_FAILURE]
      });

      expect(authLogs).toHaveLength(2);
      expect(authLogs.every(log => 
        log.eventType === SecurityEventType.AUTHENTICATION_SUCCESS ||
        log.eventType === SecurityEventType.AUTHENTICATION_FAILURE
      )).toBe(true);
    });

    it('should query logs by severity', async () => {
      const warningLogs = await auditLogger.queryLogs({
        severity: [SecurityEventSeverity.WARNING]
      });

      expect(warningLogs.length).toBeGreaterThan(0);
      expect(warningLogs.every(log => log.severity === SecurityEventSeverity.WARNING)).toBe(true);
    });

    it('should query logs by user ID', async () => {
      const user1Logs = await auditLogger.queryLogs({
        userId: 'user1'
      });

      expect(user1Logs.length).toBeGreaterThan(0);
      expect(user1Logs.every(log => log.userId === 'user1')).toBe(true);
    });

    it('should support pagination', async () => {
      const firstPage = await auditLogger.queryLogs({
        limit: 2,
        offset: 0
      });

      const secondPage = await auditLogger.queryLogs({
        limit: 2,
        offset: 2
      });

      expect(firstPage).toHaveLength(2);
      expect(secondPage).toHaveLength(2);
      expect(firstPage[0].id).not.toBe(secondPage[0].id);
    });

    it('should sort logs correctly', async () => {
      const ascLogs = await auditLogger.queryLogs({
        sortBy: 'timestamp',
        sortOrder: 'asc'
      });

      const descLogs = await auditLogger.queryLogs({
        sortBy: 'timestamp',
        sortOrder: 'desc'
      });

      expect(new Date(ascLogs[0].timestamp).getTime()).toBeLessThanOrEqual(
        new Date(ascLogs[ascLogs.length - 1].timestamp).getTime()
      );
      expect(new Date(descLogs[0].timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(descLogs[descLogs.length - 1].timestamp).getTime()
      );
    });
  });

  describe('Statistics and Analytics', () => {
    beforeEach(async () => {
      // Add diverse test data
      await auditLogger.logAuthenticationAttempt('user1', 'success');
      await auditLogger.logAuthenticationAttempt('user1', 'failure');
      await auditLogger.logAuthenticationAttempt('user2', 'success');
      await auditLogger.logAuthorizationDecision('user1', 'documents', 'read', 'success');
      await auditLogger.logSuspiciousActivity('Test activity', SecurityEventSeverity.WARNING);
    });

    it('should generate comprehensive statistics', () => {
      const stats = auditLogger.getStatistics();

      expect(stats.totalEntries).toBe(5);
      expect(stats.entriesByType[SecurityEventType.AUTHENTICATION_SUCCESS]).toBe(2);
      expect(stats.entriesByType[SecurityEventType.AUTHENTICATION_FAILURE]).toBe(1);
      expect(stats.entriesBySeverity[SecurityEventSeverity.INFO]).toBe(3);
      expect(stats.entriesBySeverity[SecurityEventSeverity.WARNING]).toBe(2);
      expect(stats.topUsers).toContainEqual(
        expect.objectContaining({ userId: 'user1', eventCount: 3 })
      );
      expect(stats.integrityStatus.verified).toBe(5);
      expect(stats.integrityStatus.corrupted).toBe(0);
    });

    it('should track recent activity periods', () => {
      const stats = auditLogger.getStatistics();

      expect(stats.recentActivity.last24Hours).toBe(5);
      expect(stats.recentActivity.lastWeek).toBe(5);
      expect(stats.recentActivity.lastMonth).toBe(5);
    });
  });

  describe('Integrity Verification', () => {
    it('should verify integrity of all logs', async () => {
      await auditLogger.logEvent({
        eventType: SecurityEventType.AUTHENTICATION_SUCCESS,
        severity: SecurityEventSeverity.INFO,
        outcome: 'success',
        message: 'Test event 1'
      });

      await auditLogger.logEvent({
        eventType: SecurityEventType.AUTHENTICATION_SUCCESS,
        severity: SecurityEventSeverity.INFO,
        outcome: 'success',
        message: 'Test event 2'
      });

      const isValid = await auditLogger.verifyIntegrity();
      expect(isValid).toBe(true);
    });

    it('should detect integrity violations', async () => {
      const violationSpy = vi.fn();
      auditLogger.on('integrityViolation', violationSpy);

      // Create a log entry
      const logEntry = await auditLogger.logEvent({
        eventType: SecurityEventType.AUTHENTICATION_SUCCESS,
        severity: SecurityEventSeverity.INFO,
        outcome: 'success',
        message: 'Test event'
      });

      // Manually tamper with the log (in real scenario this would be external tampering)
      // We'll access the private logs map through a workaround for testing
      const logs = (auditLogger as any).logs as Map<string, TamperEvidentLogEntry>;
      const tamperedEntry = { ...logEntry, message: 'Tampered message' };
      logs.set(logEntry.id, tamperedEntry);

      const isValid = await auditLogger.verifyIntegrity();
      expect(isValid).toBe(false);
      expect(violationSpy).toHaveBeenCalled();
    });
  });

  describe('Performance and Batching', () => {
    it('should batch logs when batch size is reached', async () => {
      // Set small batch size for testing
      const smallBatchConfig = { ...config, performance: { ...config.performance, batchSize: 2 } };
      const batchLogger = new AuditLogger(smallBatchConfig);
      
      const batchFlushSpy = vi.fn();
      batchLogger.on('batchFlush', batchFlushSpy);

      await batchLogger.logEvent({
        eventType: SecurityEventType.AUTHENTICATION_SUCCESS,
        severity: SecurityEventSeverity.INFO,
        outcome: 'success',
        message: 'Event 1'
      });

      await batchLogger.logEvent({
        eventType: SecurityEventType.AUTHENTICATION_SUCCESS,
        severity: SecurityEventSeverity.INFO,
        outcome: 'success',
        message: 'Event 2'
      });

      expect(batchFlushSpy).toHaveBeenCalledOnce();
      await batchLogger.cleanup();
    });

    it('should flush logs manually', async () => {
      const flushCompleteSpy = vi.fn();
      auditLogger.on('flushComplete', flushCompleteSpy);

      await auditLogger.logEvent({
        eventType: SecurityEventType.AUTHENTICATION_SUCCESS,
        severity: SecurityEventSeverity.INFO,
        outcome: 'success',
        message: 'Test event'
      });

      await auditLogger.flush();
      expect(flushCompleteSpy).toHaveBeenCalledOnce();
    });
  });

  describe('Indexing and Performance', () => {
    beforeEach(async () => {
      await auditLogger.logAuthenticationAttempt('user1', 'success');
      await auditLogger.logAuthenticationAttempt('user2', 'failure');
      await auditLogger.logSuspiciousActivity('Test activity');
    });

    it('should retrieve logs by type efficiently', () => {
      const authSuccessLogs = auditLogger.getLogsByType(SecurityEventType.AUTHENTICATION_SUCCESS);
      expect(authSuccessLogs).toHaveLength(1);
      expect(authSuccessLogs[0].eventType).toBe(SecurityEventType.AUTHENTICATION_SUCCESS);

      const suspiciousLogs = auditLogger.getLogsByType(SecurityEventType.SUSPICIOUS_ACTIVITY);
      expect(suspiciousLogs).toHaveLength(1);
      expect(suspiciousLogs[0].eventType).toBe(SecurityEventType.SUSPICIOUS_ACTIVITY);
    });

    it('should retrieve logs by user efficiently', () => {
      const user1Logs = auditLogger.getLogsByUser('user1');
      expect(user1Logs).toHaveLength(1);
      expect(user1Logs[0].userId).toBe('user1');

      const user2Logs = auditLogger.getLogsByUser('user2');
      expect(user2Logs).toHaveLength(1);
      expect(user2Logs[0].userId).toBe('user2');
    });
  });
});