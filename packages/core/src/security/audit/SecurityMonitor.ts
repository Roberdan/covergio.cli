/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import {
  AuditLogEntry,
  TamperEvidentLogEntry,
  SecurityAlert,
  AlertCondition,
  NotificationChannel,
  SecurityEventType,
  SecurityEventSeverity,
  MonitoringConfig,
  SecurityDashboardData
} from './types';
import { AuditLogger } from './AuditLogger';

/**
 * Real-time security monitoring and alerting system
 * 
 * Provides comprehensive security monitoring capabilities:
 * - Real-time event analysis and pattern detection
 * - Configurable alerting with multiple notification channels
 * - Threat intelligence and risk scoring
 * - Automated response to security incidents
 * - Dashboard data aggregation and reporting
 */
export class SecurityMonitor extends EventEmitter {
  private readonly config: MonitoringConfig;
  private readonly auditLogger: AuditLogger;
  private readonly alerts: Map<string, SecurityAlert> = new Map();
  private readonly alertCooldowns: Map<string, number> = new Map();
  private readonly threatIndicators: Map<string, ThreatIndicator> = new Map();
  private readonly activeThreats: Set<string> = new Set();
  private evaluationTimer?: NodeJS.Timeout;
  private readonly eventBuffer: TamperEvidentLogEntry[] = [];
  private readonly dashboardCache: {
    data?: SecurityDashboardData;
    lastUpdate: number;
    ttl: number;
  } = { lastUpdate: 0, ttl: 30000 }; // 30 second cache

  constructor(config: MonitoringConfig, auditLogger: AuditLogger) {
    super();
    this.config = config;
    this.auditLogger = auditLogger;

    // Listen to audit logger events
    this.auditLogger.on('log', this.handleLogEvent.bind(this));
    this.auditLogger.on('integrityViolation', this.handleIntegrityViolation.bind(this));

    // Initialize default alerts
    this.initializeDefaultAlerts();

    // Start evaluation timer
    this.startEvaluationTimer();
  }

  /**
   * Add a security alert rule
   */
  addAlert(alert: SecurityAlert): void {
    this.alerts.set(alert.id, alert);
    this.emit('alertAdded', alert);
  }

  /**
   * Remove a security alert rule
   */
  removeAlert(alertId: string): boolean {
    const removed = this.alerts.delete(alertId);
    if (removed) {
      this.emit('alertRemoved', { alertId });
    }
    return removed;
  }

  /**
   * Update a security alert rule
   */
  updateAlert(alertId: string, updates: Partial<SecurityAlert>): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    const updatedAlert = { ...alert, ...updates };
    this.alerts.set(alertId, updatedAlert);
    this.emit('alertUpdated', updatedAlert);
    return true;
  }

  /**
   * Get all configured alerts
   */
  getAlerts(): SecurityAlert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Get dashboard data for security monitoring UI
   */
  async getDashboardData(): Promise<SecurityDashboardData> {
    const now = Date.now();
    
    // Return cached data if still valid
    if (this.dashboardCache.data && (now - this.dashboardCache.lastUpdate) < this.dashboardCache.ttl) {
      return this.dashboardCache.data;
    }

    const statistics = this.auditLogger.getStatistics();
    const recentEvents = await this.auditLogger.queryLogs({
      limit: 20,
      sortBy: 'timestamp',
      sortOrder: 'desc'
    });

    const criticalAlerts = this.getActiveAlertsCount(SecurityEventSeverity.CRITICAL);
    const threatIndicators = Array.from(this.threatIndicators.values());

    const dashboardData: SecurityDashboardData = {
      overview: {
        totalEvents: statistics.totalEntries,
        criticalAlerts,
        activeThreats: this.activeThreats.size,
        systemHealth: this.calculateSystemHealth(statistics, criticalAlerts)
      },
      recentEvents,
      alertsTriggered: this.getRecentAlerts(),
      threatIndicators: threatIndicators.map(indicator => ({
        type: indicator.type,
        severity: indicator.severity,
        description: indicator.description,
        firstSeen: indicator.firstSeen,
        lastSeen: indicator.lastSeen,
        occurrences: indicator.occurrences
      })),
      complianceStatus: {
        gdprCompliant: this.checkGdprCompliance(),
        hipaaCompliant: this.checkHipaaCompliance(),
        sox404Compliant: this.checkSox404Compliance(),
        lastAssessment: new Date().toISOString()
      }
    };

    // Update cache
    this.dashboardCache.data = dashboardData;
    this.dashboardCache.lastUpdate = now;

    return dashboardData;
  }

  /**
   * Manually trigger alert evaluation
   */
  async evaluateAlerts(): Promise<void> {
    if (!this.config.alerting.enabled) return;

    const now = Date.now();
    const alerts = Array.from(this.alerts.values()).filter(alert => alert.enabled);

    for (const alert of alerts) {
      // Check cooldown period
      const lastTriggered = this.alertCooldowns.get(alert.id) || 0;
      if (now - lastTriggered < alert.cooldownPeriod * 1000) {
        continue;
      }

      try {
        await this.evaluateAlert(alert);
      } catch (error) {
        this.emit('alertEvaluationError', { alertId: alert.id, error });
      }
    }
  }

  /**
   * Add a threat indicator
   */
  addThreatIndicator(indicator: ThreatIndicator): void {
    this.threatIndicators.set(indicator.id, indicator);
    
    if (indicator.severity === SecurityEventSeverity.CRITICAL) {
      this.activeThreats.add(indicator.id);
    }

    this.emit('threatDetected', indicator);
  }

  /**
   * Remove a threat indicator
   */
  removeThreatIndicator(indicatorId: string): boolean {
    const removed = this.threatIndicators.delete(indicatorId);
    this.activeThreats.delete(indicatorId);
    
    if (removed) {
      this.emit('threatResolved', { indicatorId });
    }
    
    return removed;
  }

  /**
   * Get current threat level
   */
  getThreatLevel(): 'low' | 'medium' | 'high' | 'critical' {
    const criticalThreats = Array.from(this.threatIndicators.values())
      .filter(t => t.severity === SecurityEventSeverity.CRITICAL).length;
    
    const highThreats = Array.from(this.threatIndicators.values())
      .filter(t => t.severity === SecurityEventSeverity.ERROR).length;

    if (criticalThreats > 0) return 'critical';
    if (highThreats > 2) return 'high';
    if (highThreats > 0) return 'medium';
    return 'low';
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
    }
    
    this.removeAllListeners();
    this.eventBuffer.length = 0;
  }

  /**
   * Handle new log events from audit logger
   */
  private async handleLogEvent(logEntry: TamperEvidentLogEntry): Promise<void> {
    // Add to event buffer for analysis
    this.eventBuffer.push(logEntry);
    
    // Keep buffer size manageable
    if (this.eventBuffer.length > 1000) {
      this.eventBuffer.splice(0, 500); // Remove oldest half
    }

    // Analyze for suspicious patterns
    await this.analyzeForThreats(logEntry);

    // Invalidate dashboard cache
    this.dashboardCache.lastUpdate = 0;
  }

  /**
   * Handle integrity violations
   */
  private async handleIntegrityViolation(violation: any): Promise<void> {
    const indicator: ThreatIndicator = {
      id: `integrity-violation-${Date.now()}`,
      type: 'Log Tampering',
      severity: SecurityEventSeverity.CRITICAL,
      description: `Audit log integrity violation detected for log ${violation.logId}`,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      occurrences: 1,
      metadata: violation
    };

    this.addThreatIndicator(indicator);

    // Log the security incident
    await this.auditLogger.logSuspiciousActivity(
      'Audit log integrity violation detected',
      SecurityEventSeverity.CRITICAL,
      violation
    );
  }

  /**
   * Initialize default security alerts
   */
  private initializeDefaultAlerts(): void {
    // Failed authentication attempts
    this.addAlert({
      id: 'failed-auth-attempts',
      name: 'Multiple Failed Authentication Attempts',
      description: 'Detects potential brute force attacks',
      eventTypes: [SecurityEventType.AUTHENTICATION_FAILURE],
      conditions: [{
        field: 'eventType',
        operator: 'equals',
        value: SecurityEventType.AUTHENTICATION_FAILURE,
        timeWindow: 300, // 5 minutes
        threshold: 5
      }],
      severity: SecurityEventSeverity.WARNING,
      enabled: true,
      notificationChannels: [{ type: 'log', config: {}, enabled: true }],
      cooldownPeriod: 600 // 10 minutes
    });

    // Suspicious activity detection
    this.addAlert({
      id: 'suspicious-activity',
      name: 'Suspicious Activity Detected',
      description: 'Alerts on any suspicious activity events',
      eventTypes: [SecurityEventType.SUSPICIOUS_ACTIVITY],
      conditions: [{
        field: 'eventType',
        operator: 'equals',
        value: SecurityEventType.SUSPICIOUS_ACTIVITY
      }],
      severity: SecurityEventSeverity.ERROR,
      enabled: true,
      notificationChannels: [{ type: 'log', config: {}, enabled: true }],
      cooldownPeriod: 300 // 5 minutes
    });

    // Rate limit violations
    this.addAlert({
      id: 'rate-limit-exceeded',
      name: 'Rate Limit Exceeded',
      description: 'Detects when rate limits are exceeded',
      eventTypes: [SecurityEventType.RATE_LIMIT_EXCEEDED],
      conditions: [{
        field: 'eventType',
        operator: 'equals',
        value: SecurityEventType.RATE_LIMIT_EXCEEDED,
        timeWindow: 60, // 1 minute
        threshold: 3
      }],
      severity: SecurityEventSeverity.WARNING,
      enabled: true,
      notificationChannels: [{ type: 'log', config: {}, enabled: true }],
      cooldownPeriod: 300 // 5 minutes
    });

    // Policy violations
    this.addAlert({
      id: 'policy-violations',
      name: 'Security Policy Violations',
      description: 'Alerts on security policy violations',
      eventTypes: [SecurityEventType.SECURITY_POLICY_VIOLATION],
      conditions: [{
        field: 'eventType',
        operator: 'equals',
        value: SecurityEventType.SECURITY_POLICY_VIOLATION
      }],
      severity: SecurityEventSeverity.ERROR,
      enabled: true,
      notificationChannels: [{ type: 'log', config: {}, enabled: true }],
      cooldownPeriod: 60 // 1 minute
    });
  }

  /**
   * Evaluate a specific alert rule
   */
  private async evaluateAlert(alert: SecurityAlert): Promise<void> {
    for (const condition of alert.conditions) {
      const isTriggered = await this.evaluateCondition(condition, alert.eventTypes);
      
      if (isTriggered) {
        await this.triggerAlert(alert, condition);
        break; // Only trigger once per evaluation
      }
    }
  }

  /**
   * Evaluate a specific alert condition
   */
  private async evaluateCondition(
    condition: AlertCondition,
    eventTypes: SecurityEventType[]
  ): Promise<boolean> {
    const timeWindow = condition.timeWindow || 3600; // Default 1 hour
    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindow * 1000);

    const relevantLogs = await this.auditLogger.queryLogs({
      startTime: windowStart.toISOString(),
      endTime: now.toISOString(),
      eventTypes,
      limit: 1000
    });

    // Count-based conditions
    if (condition.threshold) {
      const matchingLogs = relevantLogs.filter(log => 
        this.evaluateConditionMatch(log, condition)
      );
      return matchingLogs.length >= condition.threshold;
    }

    // Single-match conditions
    return relevantLogs.some(log => this.evaluateConditionMatch(log, condition));
  }

  /**
   * Check if a log entry matches a condition
   */
  private evaluateConditionMatch(log: TamperEvidentLogEntry, condition: AlertCondition): boolean {
    const logValue = this.getLogFieldValue(log, condition.field);
    
    switch (condition.operator) {
      case 'equals':
        return logValue === condition.value;
      case 'not_equals':
        return logValue !== condition.value;
      case 'contains':
        return String(logValue).includes(String(condition.value));
      case 'not_contains':
        return !String(logValue).includes(String(condition.value));
      case 'greater_than':
        return Number(logValue) > Number(condition.value);
      case 'less_than':
        return Number(logValue) < Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(logValue);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(logValue);
      case 'regex':
        return new RegExp(String(condition.value)).test(String(logValue));
      default:
        return false;
    }
  }

  /**
   * Get field value from log entry
   */
  private getLogFieldValue(log: TamperEvidentLogEntry, field: string): any {
    const fields = field.split('.');
    let value: any = log;
    
    for (const f of fields) {
      value = value?.[f];
    }
    
    return value;
  }

  /**
   * Trigger an alert
   */
  private async triggerAlert(alert: SecurityAlert, condition: AlertCondition): Promise<void> {
    const now = Date.now();
    this.alertCooldowns.set(alert.id, now);

    const alertEvent = {
      alertId: alert.id,
      alertName: alert.name,
      severity: alert.severity,
      triggeredAt: new Date().toISOString(),
      condition,
      metadata: alert.metadata
    };

    // Send notifications
    for (const channel of alert.notificationChannels.filter(c => c.enabled)) {
      try {
        await this.sendNotification(channel, alertEvent);
      } catch (error) {
        this.emit('notificationError', { channel, error, alert: alertEvent });
      }
    }

    // Log the alert
    await this.auditLogger.logEvent({
      eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
      severity: alert.severity,
      outcome: 'error',
      message: `Security alert triggered: ${alert.name}`,
      details: alertEvent
    });

    this.emit('alertTriggered', alertEvent);
  }

  /**
   * Send notification through specified channel
   */
  private async sendNotification(
    channel: NotificationChannel,
    alertEvent: any
  ): Promise<void> {
    switch (channel.type) {
      case 'log':
        console.warn(`[SECURITY ALERT] ${alertEvent.alertName}:`, alertEvent);
        break;
      case 'webhook':
        // Implement webhook notification
        break;
      case 'email':
        // Implement email notification
        break;
      case 'sms':
        // Implement SMS notification
        break;
      case 'slack':
        // Implement Slack notification
        break;
      case 'teams':
        // Implement Microsoft Teams notification
        break;
      default:
        throw new Error(`Unsupported notification channel: ${channel.type}`);
    }
  }

  /**
   * Analyze log entry for potential threats
   */
  private async analyzeForThreats(logEntry: TamperEvidentLogEntry): Promise<void> {
    // Analyze authentication patterns
    if (logEntry.eventType === SecurityEventType.AUTHENTICATION_FAILURE) {
      await this.analyzeFailedAuthentication(logEntry);
    }

    // Analyze authorization patterns
    if (logEntry.eventType === SecurityEventType.AUTHORIZATION_DENIED) {
      await this.analyzeFailedAuthorization(logEntry);
    }

    // Analyze suspicious activities
    if (logEntry.eventType === SecurityEventType.SUSPICIOUS_ACTIVITY) {
      await this.analyzeSuspiciousActivity(logEntry);
    }
  }

  /**
   * Analyze failed authentication patterns
   */
  private async analyzeFailedAuthentication(logEntry: TamperEvidentLogEntry): Promise<void> {
    const userId = logEntry.userId;
    const sourceIp = logEntry.sourceIp;
    
    if (userId || sourceIp) {
      const recentFailures = await this.auditLogger.queryLogs({
        startTime: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // Last 15 minutes
        eventTypes: [SecurityEventType.AUTHENTICATION_FAILURE],
        userId,
        limit: 10
      });

      if (recentFailures.length >= 5) {
        const indicatorId = `brute-force-${userId || sourceIp}-${Date.now()}`;
        this.addThreatIndicator({
          id: indicatorId,
          type: 'Brute Force Attack',
          severity: SecurityEventSeverity.WARNING,
          description: `Multiple failed authentication attempts for ${userId || sourceIp}`,
          firstSeen: recentFailures[recentFailures.length - 1].timestamp,
          lastSeen: logEntry.timestamp,
          occurrences: recentFailures.length,
          metadata: { userId, sourceIp, attempts: recentFailures.length }
        });
      }
    }
  }

  /**
   * Analyze failed authorization patterns
   */
  private async analyzeFailedAuthorization(logEntry: TamperEvidentLogEntry): Promise<void> {
    const userId = logEntry.userId;
    const resource = logEntry.resource;
    
    if (userId && resource) {
      const recentDenials = await this.auditLogger.queryLogs({
        startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // Last 30 minutes
        eventTypes: [SecurityEventType.AUTHORIZATION_DENIED],
        userId,
        limit: 10
      });

      if (recentDenials.length >= 10) {
        const indicatorId = `privilege-escalation-${userId}-${Date.now()}`;
        this.addThreatIndicator({
          id: indicatorId,
          type: 'Privilege Escalation Attempt',
          severity: SecurityEventSeverity.WARNING,
          description: `Multiple authorization failures for user ${userId}`,
          firstSeen: recentDenials[recentDenials.length - 1].timestamp,
          lastSeen: logEntry.timestamp,
          occurrences: recentDenials.length,
          metadata: { userId, resource, attempts: recentDenials.length }
        });
      }
    }
  }

  /**
   * Analyze suspicious activity events
   */
  private async analyzeSuspiciousActivity(logEntry: TamperEvidentLogEntry): Promise<void> {
    // Any suspicious activity is treated as a potential threat
    const indicatorId = `suspicious-${Date.now()}`;
    this.addThreatIndicator({
      id: indicatorId,
      type: 'Suspicious Activity',
      severity: logEntry.severity,
      description: logEntry.message,
      firstSeen: logEntry.timestamp,
      lastSeen: logEntry.timestamp,
      occurrences: 1,
      metadata: logEntry.details
    });
  }

  /**
   * Calculate system health status
   */
  private calculateSystemHealth(
    statistics: any,
    criticalAlerts: number
  ): 'healthy' | 'warning' | 'critical' {
    if (criticalAlerts > 0 || this.activeThreats.size > 0) {
      return 'critical';
    }

    const recentErrors = statistics.entriesBySeverity[SecurityEventSeverity.ERROR] || 0;
    const recentWarnings = statistics.entriesBySeverity[SecurityEventSeverity.WARNING] || 0;

    if (recentErrors > 10 || recentWarnings > 50) {
      return 'warning';
    }

    return 'healthy';
  }

  /**
   * Get count of active alerts by severity
   */
  private getActiveAlertsCount(severity: SecurityEventSeverity): number {
    return Array.from(this.threatIndicators.values())
      .filter(threat => threat.severity === severity).length;
  }

  /**
   * Get recent alerts for dashboard
   */
  private getRecentAlerts(): Array<{
    alertId: string;
    alertName: string;
    severity: SecurityEventSeverity;
    triggeredAt: string;
    eventCount: number;
  }> {
    // This would typically come from a persistent store
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Check GDPR compliance
   */
  private checkGdprCompliance(): boolean {
    // Implement GDPR compliance checks
    return true; // Placeholder
  }

  /**
   * Check HIPAA compliance
   */
  private checkHipaaCompliance(): boolean {
    // Implement HIPAA compliance checks
    return true; // Placeholder
  }

  /**
   * Check SOX 404 compliance
   */
  private checkSox404Compliance(): boolean {
    // Implement SOX 404 compliance checks
    return true; // Placeholder
  }

  /**
   * Start the alert evaluation timer
   */
  private startEvaluationTimer(): void {
    if (this.config.alerting.enabled && this.config.alerting.evaluationInterval > 0) {
      this.evaluationTimer = setInterval(() => {
        this.evaluateAlerts().catch(error => {
          this.emit('evaluationError', error);
        });
      }, this.config.alerting.evaluationInterval * 1000);
    }
  }
}

/**
 * Threat indicator interface
 */
interface ThreatIndicator {
  id: string;
  type: string;
  severity: SecurityEventSeverity;
  description: string;
  firstSeen: string;
  lastSeen: string;
  occurrences: number;
  metadata?: Record<string, any>;
}