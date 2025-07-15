/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SecurityMonitor } from '../SecurityMonitor';
import { AuditLogger } from '../AuditLogger';
import { 
  SecurityEventType, 
  SecurityEventSeverity, 
  MonitoringConfig,
  SecurityAlert 
} from '../types';

describe('SecurityMonitor', () => {
  let securityMonitor: SecurityMonitor;
  let auditLogger: AuditLogger;
  let config: MonitoringConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      alerting: {
        enabled: true,
        evaluationInterval: 1, // 1 second for testing
        maxAlertsPerHour: 100
      },
      retention: {
        defaultPolicy: 'default',
        policies: []
      },
      integrity: {
        verificationEnabled: true,
        verificationInterval: 24,
        signingKey: 'test-signing-key'
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
    securityMonitor = new SecurityMonitor(config, auditLogger);
  });

  afterEach(async () => {
    await securityMonitor.cleanup();
    await auditLogger.cleanup();
  });

  describe('Alert Management', () => {
    it('should add and retrieve alerts', () => {
      const alert: SecurityAlert = {
        id: 'test-alert',
        name: 'Test Alert',
        description: 'Test alert description',
        eventTypes: [SecurityEventType.AUTHENTICATION_FAILURE],
        conditions: [{
          field: 'eventType',
          operator: 'equals',
          value: SecurityEventType.AUTHENTICATION_FAILURE
        }],
        severity: SecurityEventSeverity.WARNING,
        enabled: true,
        notificationChannels: [{ type: 'log', config: {}, enabled: true }],
        cooldownPeriod: 300
      };

      securityMonitor.addAlert(alert);
      const alerts = securityMonitor.getAlerts();
      
      expect(alerts).toHaveLength(5); // 4 default + 1 added
      expect(alerts.find(a => a.id === 'test-alert')).toEqual(alert);
    });

    it('should remove alerts', () => {
      const alert: SecurityAlert = {
        id: 'test-alert',
        name: 'Test Alert',
        description: 'Test alert description',
        eventTypes: [SecurityEventType.AUTHENTICATION_FAILURE],
        conditions: [{
          field: 'eventType',
          operator: 'equals',
          value: SecurityEventType.AUTHENTICATION_FAILURE
        }],
        severity: SecurityEventSeverity.WARNING,
        enabled: true,
        notificationChannels: [{ type: 'log', config: {}, enabled: true }],
        cooldownPeriod: 300
      };

      securityMonitor.addAlert(alert);
      const removed = securityMonitor.removeAlert('test-alert');
      
      expect(removed).toBe(true);
      expect(securityMonitor.getAlerts().find(a => a.id === 'test-alert')).toBeUndefined();
    });

    it('should update alerts', () => {
      const alert: SecurityAlert = {
        id: 'test-alert',
        name: 'Test Alert',
        description: 'Test alert description',
        eventTypes: [SecurityEventType.AUTHENTICATION_FAILURE],
        conditions: [{
          field: 'eventType',
          operator: 'equals',
          value: SecurityEventType.AUTHENTICATION_FAILURE
        }],
        severity: SecurityEventSeverity.WARNING,
        enabled: true,
        notificationChannels: [{ type: 'log', config: {}, enabled: true }],
        cooldownPeriod: 300
      };

      securityMonitor.addAlert(alert);
      const updated = securityMonitor.updateAlert('test-alert', { 
        name: 'Updated Alert Name',
        severity: SecurityEventSeverity.ERROR 
      });
      
      expect(updated).toBe(true);
      const updatedAlert = securityMonitor.getAlerts().find(a => a.id === 'test-alert');
      expect(updatedAlert?.name).toBe('Updated Alert Name');
      expect(updatedAlert?.severity).toBe(SecurityEventSeverity.ERROR);
    });

    it('should emit events for alert management', () => {
      const addedSpy = vi.fn();
      const removedSpy = vi.fn();
      const updatedSpy = vi.fn();

      securityMonitor.on('alertAdded', addedSpy);
      securityMonitor.on('alertRemoved', removedSpy);
      securityMonitor.on('alertUpdated', updatedSpy);

      const alert: SecurityAlert = {
        id: 'test-alert',
        name: 'Test Alert',
        description: 'Test alert description',
        eventTypes: [SecurityEventType.AUTHENTICATION_FAILURE],
        conditions: [{
          field: 'eventType',
          operator: 'equals',
          value: SecurityEventType.AUTHENTICATION_FAILURE
        }],
        severity: SecurityEventSeverity.WARNING,
        enabled: true,
        notificationChannels: [{ type: 'log', config: {}, enabled: true }],
        cooldownPeriod: 300
      };

      securityMonitor.addAlert(alert);
      securityMonitor.updateAlert('test-alert', { name: 'Updated' });
      securityMonitor.removeAlert('test-alert');

      expect(addedSpy).toHaveBeenCalledWith(alert);
      expect(updatedSpy).toHaveBeenCalledWith(expect.objectContaining({ name: 'Updated' }));
      expect(removedSpy).toHaveBeenCalledWith({ alertId: 'test-alert' });
    });
  });

  describe('Threat Detection', () => {
    it('should detect brute force attacks', async () => {
      const threatSpy = vi.fn();
      securityMonitor.on('threatDetected', threatSpy);

      // Simulate multiple failed authentication attempts
      for (let i = 0; i < 6; i++) {
        await auditLogger.logAuthenticationAttempt('test-user', 'failure', {
          sourceIp: '192.168.1.100'
        });
      }

      // Give some time for threat analysis
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(threatSpy).toHaveBeenCalled();
      const threatCall = threatSpy.mock.calls[0][0];
      expect(threatCall.type).toBe('Brute Force Attack');
      expect(threatCall.metadata.userId).toBe('test-user');
    });

    it('should detect privilege escalation attempts', async () => {
      const threatSpy = vi.fn();
      securityMonitor.on('threatDetected', threatSpy);

      // Simulate multiple authorization denials
      for (let i = 0; i < 11; i++) {
        await auditLogger.logAuthorizationDecision(
          'test-user',
          'admin-panel',
          'access',
          'failure',
          'Insufficient permissions'
        );
      }

      // Give some time for threat analysis
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(threatSpy).toHaveBeenCalled();
      const threatCall = threatSpy.mock.calls[0][0];
      expect(threatCall.type).toBe('Privilege Escalation Attempt');
      expect(threatCall.metadata.userId).toBe('test-user');
    });

    it('should detect suspicious activities', async () => {
      const threatSpy = vi.fn();
      securityMonitor.on('threatDetected', threatSpy);

      await auditLogger.logSuspiciousActivity(
        'Unusual access pattern detected',
        SecurityEventSeverity.WARNING
      );

      // Give some time for threat analysis
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(threatSpy).toHaveBeenCalled();
      const threatCall = threatSpy.mock.calls[0][0];
      expect(threatCall.type).toBe('Suspicious Activity');
      expect(threatCall.description).toContain('Unusual access pattern detected');
    });

    it('should manage threat lifecycle', () => {
      const threatResolvedSpy = vi.fn();
      securityMonitor.on('threatResolved', threatResolvedSpy);

      // Add an error-level threat indicator (warning alone doesn't change threat level)
      securityMonitor.addThreatIndicator({
        id: 'test-threat',
        type: 'Test Threat',
        severity: SecurityEventSeverity.ERROR,
        description: 'Test threat description',
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        occurrences: 1
      });

      expect(securityMonitor.getThreatLevel()).toBe('medium');

      // Remove the threat
      const removed = securityMonitor.removeThreatIndicator('test-threat');
      expect(removed).toBe(true);
      expect(threatResolvedSpy).toHaveBeenCalledWith({ indicatorId: 'test-threat' });
      expect(securityMonitor.getThreatLevel()).toBe('low');
    });
  });

  describe('Alert Evaluation', () => {
    it('should evaluate alert conditions correctly', async () => {
      const alertTriggeredSpy = vi.fn();
      securityMonitor.on('alertTriggered', alertTriggeredSpy);

      // Add a simple alert for authentication failures
      const alert: SecurityAlert = {
        id: 'auth-failure-alert',
        name: 'Authentication Failure Alert',
        description: 'Triggered on authentication failures',
        eventTypes: [SecurityEventType.AUTHENTICATION_FAILURE],
        conditions: [{
          field: 'eventType',
          operator: 'equals',
          value: SecurityEventType.AUTHENTICATION_FAILURE
        }],
        severity: SecurityEventSeverity.WARNING,
        enabled: true,
        notificationChannels: [{ type: 'log', config: {}, enabled: true }],
        cooldownPeriod: 1 // 1 second for testing
      };

      securityMonitor.addAlert(alert);

      // Log an authentication failure
      await auditLogger.logAuthenticationAttempt('test-user', 'failure');

      // Manually trigger evaluation
      await securityMonitor.evaluateAlerts();

      expect(alertTriggeredSpy).toHaveBeenCalled();
      const alertEvent = alertTriggeredSpy.mock.calls[0][0];
      expect(alertEvent.alertId).toBe('auth-failure-alert');
      expect(alertEvent.severity).toBe(SecurityEventSeverity.WARNING);
    });

    it('should respect cooldown periods', async () => {
      const alertTriggeredSpy = vi.fn();
      
      // Use the existing monitor but listen for a specific alert
      securityMonitor.on('alertTriggered', (alertEvent) => {
        if (alertEvent.alertId === 'cooldown-test') {
          alertTriggeredSpy();
        }
      });

      const alert: SecurityAlert = {
        id: 'cooldown-test',
        name: 'Cooldown Test Alert',
        description: 'Test cooldown functionality',
        eventTypes: [SecurityEventType.AUTHENTICATION_FAILURE],
        conditions: [{
          field: 'eventType',
          operator: 'equals',
          value: SecurityEventType.AUTHENTICATION_FAILURE
        }],
        severity: SecurityEventSeverity.WARNING,
        enabled: true,
        notificationChannels: [{ type: 'log', config: {}, enabled: true }],
        cooldownPeriod: 5 // 5 seconds
      };

      securityMonitor.addAlert(alert);

      // Log failure and evaluate
      await auditLogger.logAuthenticationAttempt('test-user', 'failure');
      await securityMonitor.evaluateAlerts();

      // Log another failure immediately and evaluate again
      await auditLogger.logAuthenticationAttempt('test-user', 'failure');
      await securityMonitor.evaluateAlerts();

      // Should only trigger once due to cooldown
      expect(alertTriggeredSpy).toHaveBeenCalledTimes(1);
    });

    it('should evaluate threshold-based conditions', async () => {
      const alertTriggeredSpy = vi.fn();
      securityMonitor.on('alertTriggered', alertTriggeredSpy);

      const alert: SecurityAlert = {
        id: 'threshold-test',
        name: 'Threshold Test Alert',
        description: 'Test threshold functionality',
        eventTypes: [SecurityEventType.AUTHENTICATION_FAILURE],
        conditions: [{
          field: 'eventType',
          operator: 'equals',
          value: SecurityEventType.AUTHENTICATION_FAILURE,
          timeWindow: 60, // 1 minute
          threshold: 3 // Trigger after 3 failures
        }],
        severity: SecurityEventSeverity.WARNING,
        enabled: true,
        notificationChannels: [{ type: 'log', config: {}, enabled: true }],
        cooldownPeriod: 1
      };

      securityMonitor.addAlert(alert);

      // Log 2 failures - should not trigger
      await auditLogger.logAuthenticationAttempt('test-user', 'failure');
      await auditLogger.logAuthenticationAttempt('test-user', 'failure');
      await securityMonitor.evaluateAlerts();

      expect(alertTriggeredSpy).not.toHaveBeenCalled();

      // Log 3rd failure - should trigger
      await auditLogger.logAuthenticationAttempt('test-user', 'failure');
      await securityMonitor.evaluateAlerts();

      expect(alertTriggeredSpy).toHaveBeenCalledOnce();
    });
  });

  describe('Dashboard Data', () => {
    beforeEach(async () => {
      // Create some test data
      await auditLogger.logAuthenticationAttempt('user1', 'success');
      await auditLogger.logAuthenticationAttempt('user2', 'failure');
      await auditLogger.logSuspiciousActivity('Test activity', SecurityEventSeverity.WARNING);
      
      // Add a threat indicator
      securityMonitor.addThreatIndicator({
        id: 'test-threat',
        type: 'Test Threat',
        severity: SecurityEventSeverity.ERROR,
        description: 'Test threat for dashboard',
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        occurrences: 1
      });
    });

    it('should generate comprehensive dashboard data', async () => {
      const dashboardData = await securityMonitor.getDashboardData();

      expect(dashboardData.overview.totalEvents).toBe(3);
      expect(dashboardData.overview.activeThreats).toBeGreaterThanOrEqual(0);
      expect(dashboardData.overview.systemHealth).toMatch(/healthy|warning|critical/);
      expect(dashboardData.recentEvents).toHaveLength(3);
      expect(dashboardData.threatIndicators.length).toBeGreaterThanOrEqual(1); // Could be more due to auto-detection
      expect(dashboardData.threatIndicators.some(t => t.type === 'Test Threat')).toBe(true);
      expect(dashboardData.complianceStatus.gdprCompliant).toBe(true);
    });

    it('should cache dashboard data', async () => {
      const data1 = await securityMonitor.getDashboardData();
      const data2 = await securityMonitor.getDashboardData();

      // Should return same reference due to caching
      expect(data1).toBe(data2);
    });
  });

  describe('Threat Level Assessment', () => {
    it('should calculate threat level correctly', () => {
      expect(securityMonitor.getThreatLevel()).toBe('low');

      // Add a warning-level threat
      securityMonitor.addThreatIndicator({
        id: 'warning-threat',
        type: 'Warning Threat',
        severity: SecurityEventSeverity.WARNING,
        description: 'Warning level threat',
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        occurrences: 1
      });

      expect(securityMonitor.getThreatLevel()).toBe('low'); // Warning alone is still low

      // Add an error-level threat
      securityMonitor.addThreatIndicator({
        id: 'error-threat',
        type: 'Error Threat',
        severity: SecurityEventSeverity.ERROR,
        description: 'Error level threat',
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        occurrences: 1
      });

      expect(securityMonitor.getThreatLevel()).toBe('medium');

      // Add multiple error-level threats
      securityMonitor.addThreatIndicator({
        id: 'error-threat-2',
        type: 'Error Threat 2',
        severity: SecurityEventSeverity.ERROR,
        description: 'Second error level threat',
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        occurrences: 1
      });

      securityMonitor.addThreatIndicator({
        id: 'error-threat-3',
        type: 'Error Threat 3',
        severity: SecurityEventSeverity.ERROR,
        description: 'Third error level threat',
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        occurrences: 1
      });

      expect(securityMonitor.getThreatLevel()).toBe('high');

      // Add a critical threat
      securityMonitor.addThreatIndicator({
        id: 'critical-threat',
        type: 'Critical Threat',
        severity: SecurityEventSeverity.CRITICAL,
        description: 'Critical level threat',
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        occurrences: 1
      });

      expect(securityMonitor.getThreatLevel()).toBe('critical');
    });
  });

  describe('Integrity Violation Handling', () => {
    it('should handle integrity violations as critical threats', async () => {
      const threatSpy = vi.fn();
      securityMonitor.on('threatDetected', threatSpy);

      // Simulate integrity violation
      const violation = {
        logId: 'test-log-123',
        sequenceNumber: 5,
        expectedPreviousHash: 'expected-hash',
        actualPreviousHash: 'actual-hash'
      };

      // Emit integrity violation from audit logger
      auditLogger.emit('integrityViolation', violation);

      // Give some time for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(threatSpy).toHaveBeenCalled();
      const threat = threatSpy.mock.calls[0][0];
      expect(threat.type).toBe('Log Tampering');
      expect(threat.severity).toBe(SecurityEventSeverity.CRITICAL);
      expect(threat.description).toContain('integrity violation');
    });
  });
});