/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
  EMERGENCY = 'emergency'
}

/**
 * Alert states
 */
export enum AlertState {
  PENDING = 'pending',
  FIRING = 'firing',
  RESOLVED = 'resolved',
  SILENCED = 'silenced'
}

/**
 * Alert condition operators
 */
export enum ConditionOperator {
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUAL = 'gte',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUAL = 'lte',
  EQUAL = 'eq',
  NOT_EQUAL = 'ne',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  REGEX_MATCH = 'regex_match'
}

/**
 * Notification channel types
 */
export enum NotificationChannelType {
  EMAIL = 'email',
  SLACK = 'slack',
  WEBHOOK = 'webhook',
  PAGERDUTY = 'pagerduty',
  SMS = 'sms',
  PUSH = 'push'
}

/**
 * Alert rule configuration
 */
export interface AlertRule {
  id: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  enabled: boolean;
  conditions: AlertCondition[];
  evaluation: {
    intervalSeconds: number;
    forDuration: number; // How long condition must be true
    groupBy: string[];
    groupWait: number;
    groupInterval: number;
    repeatInterval: number;
  };
  notifications: {
    channels: string[];
    template?: string;
    suppressionRules?: string[];
  };
  runbook?: {
    title: string;
    steps: string[];
    escalation: string[];
    contacts: string[];
  };
  labels: Record<string, string>;
  annotations: Record<string, string>;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

/**
 * Alert condition
 */
export interface AlertCondition {
  id: string;
  metricName: string;
  operator: ConditionOperator;
  value: number | string;
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count' | 'rate';
  timeWindow?: number; // in seconds
  labels?: Record<string, string>;
}

/**
 * Notification channel configuration
 */
export interface NotificationChannel {
  id: string;
  name: string;
  type: NotificationChannelType;
  enabled: boolean;
  config: {
    // Email config
    to?: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    
    // Slack config
    webhook?: string;
    channel?: string;
    username?: string;
    iconEmoji?: string;
    
    // Webhook config
    url?: string;
    method?: 'GET' | 'POST' | 'PUT';
    headers?: Record<string, string>;
    
    // PagerDuty config
    routingKey?: string;
    severity?: string;
    
    // SMS config
    phoneNumbers?: string[];
    
    // Push notification config
    deviceTokens?: string[];
    title?: string;
  };
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    maxDelay: number;
  };
  rateLimit: {
    enabled: boolean;
    maxNotifications: number;
    windowSeconds: number;
  };
  createdAt: number;
  updatedAt: number;
}

/**
 * Active alert instance
 */
export interface Alert {
  id: string;
  ruleId: string;
  state: AlertState;
  severity: AlertSeverity;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: number;
  endsAt?: number;
  updatedAt: number;
  fingerprint: string;
  generatorURL?: string;
  value?: number | string;
  silenceId?: string;
}

/**
 * Alert silence configuration
 */
export interface AlertSilence {
  id: string;
  matchers: Array<{
    name: string;
    value: string;
    isRegex: boolean;
  }>;
  startsAt: number;
  endsAt: number;
  comment: string;
  createdBy: string;
  createdAt: number;
}

/**
 * Alert notification event
 */
export interface AlertNotification {
  id: string;
  alertId: string;
  channelId: string;
  state: 'pending' | 'sent' | 'failed' | 'retry';
  attempts: number;
  lastAttempt?: number;
  error?: string;
  sentAt?: number;
  retryAt?: number;
}

/**
 * Escalation policy
 */
export interface EscalationPolicy {
  id: string;
  name: string;
  description: string;
  rules: Array<{
    level: number;
    delayMinutes: number;
    channels: string[];
    conditions?: {
      severity?: AlertSeverity[];
      labels?: Record<string, string>;
    };
  }>;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Comprehensive Alerting Manager
 */
export class AlertingManager extends EventEmitter {
  private alertRules = new Map<string, AlertRule>();
  private notificationChannels = new Map<string, NotificationChannel>();
  private activeAlerts = new Map<string, Alert>();
  private alertSilences = new Map<string, AlertSilence>();
  private escalationPolicies = new Map<string, EscalationPolicy>();
  private pendingNotifications = new Map<string, AlertNotification>();
  
  private evaluationInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private notificationQueue: AlertNotification[] = [];
  private processingNotifications = false;

  constructor() {
    super();
    this.setupDefaultChannels();
    this.setupDefaultRules();
    this.startEvaluation();
  }

  /**
   * Setup default notification channels
   */
  private setupDefaultChannels(): void {
    // Default email channel
    const emailChannel: NotificationChannel = {
      id: 'default-email',
      name: 'Default Email',
      type: NotificationChannelType.EMAIL,
      enabled: true,
      config: {
        to: ['admin@convergio.cli'],
        subject: '[Convergio CLI] Alert: {{.CommonLabels.alertname}}'
      },
      retryPolicy: {
        maxRetries: 3,
        backoffMultiplier: 2,
        maxDelay: 300000 // 5 minutes
      },
      rateLimit: {
        enabled: true,
        maxNotifications: 10,
        windowSeconds: 300 // 5 minutes
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Default webhook channel
    const webhookChannel: NotificationChannel = {
      id: 'default-webhook',
      name: 'Default Webhook',
      type: NotificationChannelType.WEBHOOK,
      enabled: false, // Disabled by default until configured
      config: {
        url: 'http://localhost:3000/alerts',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Convergio-CLI-AlertManager/1.0'
        }
      },
      retryPolicy: {
        maxRetries: 5,
        backoffMultiplier: 1.5,
        maxDelay: 600000 // 10 minutes
      },
      rateLimit: {
        enabled: false,
        maxNotifications: 100,
        windowSeconds: 60
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.notificationChannels.set(emailChannel.id, emailChannel);
    this.notificationChannels.set(webhookChannel.id, webhookChannel);
  }

  /**
   * Setup default alert rules
   */
  private setupDefaultRules(): void {
    // High error rate alert
    const errorRateRule: AlertRule = {
      id: 'high-error-rate',
      name: 'High Error Rate',
      description: 'Alert when error rate exceeds threshold',
      severity: AlertSeverity.WARNING,
      enabled: true,
      conditions: [
        {
          id: 'error-rate-condition',
          metricName: 'error_rate',
          operator: ConditionOperator.GREATER_THAN,
          value: 5.0,
          aggregation: 'avg',
          timeWindow: 300 // 5 minutes
        }
      ],
      evaluation: {
        intervalSeconds: 30,
        forDuration: 120, // 2 minutes
        groupBy: ['service', 'instance'],
        groupWait: 30,
        groupInterval: 300,
        repeatInterval: 3600 // 1 hour
      },
      notifications: {
        channels: ['default-email']
      },
      runbook: {
        title: 'High Error Rate Runbook',
        steps: [
          'Check service logs for error patterns',
          'Verify external dependencies are healthy',
          'Review recent deployments',
          'Check resource utilization',
          'Escalate to on-call engineer if needed'
        ],
        escalation: ['team-lead', 'on-call-engineer'],
        contacts: ['team@convergio.cli']
      },
      labels: {
        team: 'platform',
        severity: 'warning',
        component: 'api'
      },
      annotations: {
        summary: 'Error rate is {{ $value }}% for {{ $labels.service }}',
        description: 'Error rate has been above 5% for more than 2 minutes',
        runbook_url: 'https://docs.convergio.cli/runbooks/high-error-rate'
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'system'
    };

    // High response time alert
    const latencyRule: AlertRule = {
      id: 'high-latency',
      name: 'High Response Time',
      description: 'Alert when P95 response time is too high',
      severity: AlertSeverity.CRITICAL,
      enabled: true,
      conditions: [
        {
          id: 'latency-condition',
          metricName: 'request_duration_seconds',
          operator: ConditionOperator.GREATER_THAN,
          value: 2.0,
          aggregation: 'avg',
          timeWindow: 180 // 3 minutes
        }
      ],
      evaluation: {
        intervalSeconds: 15,
        forDuration: 60, // 1 minute
        groupBy: ['service', 'endpoint'],
        groupWait: 15,
        groupInterval: 300,
        repeatInterval: 1800 // 30 minutes
      },
      notifications: {
        channels: ['default-email', 'default-webhook']
      },
      runbook: {
        title: 'High Latency Runbook',
        steps: [
          'Check system resource usage (CPU, memory)',
          'Review database query performance',
          'Check external service response times',
          'Look for memory leaks or GC pressure',
          'Consider scaling resources if needed'
        ],
        escalation: ['sre-team', 'engineering-manager'],
        contacts: ['sre@convergio.cli']
      },
      labels: {
        team: 'sre',
        severity: 'critical',
        component: 'performance'
      },
      annotations: {
        summary: 'High response time detected: {{ $value }}s',
        description: 'P95 response time has been above 2 seconds for {{ $labels.service }}',
        dashboard_url: 'https://grafana.convergio.cli/d/performance'
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'system'
    };

    // Service down alert
    const serviceDownRule: AlertRule = {
      id: 'service-down',
      name: 'Service Down',
      description: 'Alert when service is unreachable',
      severity: AlertSeverity.EMERGENCY,
      enabled: true,
      conditions: [
        {
          id: 'uptime-condition',
          metricName: 'sli_availability',
          operator: ConditionOperator.LESS_THAN,
          value: 95.0,
          aggregation: 'avg',
          timeWindow: 60 // 1 minute
        }
      ],
      evaluation: {
        intervalSeconds: 10,
        forDuration: 30, // 30 seconds
        groupBy: ['service'],
        groupWait: 0,
        groupInterval: 60,
        repeatInterval: 300 // 5 minutes
      },
      notifications: {
        channels: ['default-email']
      },
      labels: {
        team: 'sre',
        severity: 'emergency',
        component: 'availability'
      },
      annotations: {
        summary: 'Service {{ $labels.service }} is down',
        description: 'Service availability is {{ $value }}% (below 95%)',
        priority: 'P0'
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'system'
    };

    this.alertRules.set(errorRateRule.id, errorRateRule);
    this.alertRules.set(latencyRule.id, latencyRule);
    this.alertRules.set(serviceDownRule.id, serviceDownRule);
  }

  /**
   * Start alert evaluation loop
   */
  private startEvaluation(): void {
    this.evaluationInterval = setInterval(() => {
      this.evaluateAlerts();
    }, 15000); // Evaluate every 15 seconds

    this.cleanupInterval = setInterval(() => {
      this.cleanupResolvedAlerts();
      this.cleanupExpiredSilences();
    }, 300000); // Cleanup every 5 minutes
  }

  /**
   * Evaluate all alert rules
   */
  private async evaluateAlerts(): Promise<void> {
    for (const [ruleId, rule] of this.alertRules.entries()) {
      if (!rule.enabled) continue;

      try {
        await this.evaluateRule(rule);
      } catch (error) {
        this.emit('rule-evaluation-error', { ruleId, error: (error as Error).message });
      }
    }
  }

  /**
   * Evaluate a specific alert rule
   */
  private async evaluateRule(rule: AlertRule): Promise<void> {
    // In a real implementation, this would query the metrics system
    // For now, we'll simulate metric evaluation
    const alertTriggered = this.simulateMetricEvaluation(rule);

    if (alertTriggered) {
      const existingAlert = this.findExistingAlert(rule);
      
      if (existingAlert) {
        // Update existing alert
        existingAlert.updatedAt = Date.now();
        existingAlert.state = AlertState.FIRING;
      } else {
        // Create new alert
        const alert = this.createAlert(rule);
        this.activeAlerts.set(alert.id, alert);
        
        // Queue notifications
        this.queueNotifications(alert);
        
        this.emit('alert-triggered', { alert, rule });
      }
    } else {
      // Check if we should resolve any existing alerts for this rule
      const existingAlert = this.findExistingAlert(rule);
      if (existingAlert && existingAlert.state === AlertState.FIRING) {
        existingAlert.state = AlertState.RESOLVED;
        existingAlert.endsAt = Date.now();
        existingAlert.updatedAt = Date.now();
        
        this.emit('alert-resolved', { alert: existingAlert, rule });
      }
    }
  }

  /**
   * Simulate metric evaluation (replace with real metric queries)
   */
  private simulateMetricEvaluation(rule: AlertRule): boolean {
    // This would be replaced with actual metric queries in a real implementation
    // For now, randomly trigger alerts to demonstrate functionality
    return Math.random() < 0.1; // 10% chance to trigger
  }

  /**
   * Find existing alert for a rule
   */
  private findExistingAlert(rule: AlertRule): Alert | undefined {
    return Array.from(this.activeAlerts.values())
      .find(alert => alert.ruleId === rule.id && alert.state !== AlertState.RESOLVED);
  }

  /**
   * Create new alert instance
   */
  private createAlert(rule: AlertRule): Alert {
    const alertId = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: alertId,
      ruleId: rule.id,
      state: AlertState.FIRING,
      severity: rule.severity,
      labels: { ...rule.labels, alertname: rule.name },
      annotations: rule.annotations,
      startsAt: Date.now(),
      updatedAt: Date.now(),
      fingerprint: this.generateFingerprint(rule),
      generatorURL: `https://convergio.cli/alerts/${rule.id}`
    };
  }

  /**
   * Generate alert fingerprint for deduplication
   */
  private generateFingerprint(rule: AlertRule): string {
    const labelString = Object.entries(rule.labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
    
    return `${rule.id}:${labelString}`;
  }

  /**
   * Queue notifications for an alert
   */
  private queueNotifications(alert: Alert): void {
    const rule = this.alertRules.get(alert.ruleId);
    if (!rule) return;

    for (const channelId of rule.notifications.channels) {
      const channel = this.notificationChannels.get(channelId);
      if (!channel || !channel.enabled) continue;

      // Check if alert is silenced
      if (this.isAlertSilenced(alert)) continue;

      // Check rate limiting
      if (this.isRateLimited(channelId)) continue;

      const notification: AlertNotification = {
        id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        alertId: alert.id,
        channelId,
        state: 'pending',
        attempts: 0
      };

      this.notificationQueue.push(notification);
      this.pendingNotifications.set(notification.id, notification);
    }

    this.processNotificationQueue();
  }

  /**
   * Process notification queue
   */
  private async processNotificationQueue(): Promise<void> {
    if (this.processingNotifications || this.notificationQueue.length === 0) {
      return;
    }

    this.processingNotifications = true;

    while (this.notificationQueue.length > 0) {
      const notification = this.notificationQueue.shift()!;
      
      try {
        await this.sendNotification(notification);
      } catch (error) {
        this.handleNotificationError(notification, error as Error);
      }
    }

    this.processingNotifications = false;
  }

  /**
   * Send notification through channel
   */
  private async sendNotification(notification: AlertNotification): Promise<void> {
    const channel = this.notificationChannels.get(notification.channelId);
    const alert = this.activeAlerts.get(notification.alertId);
    
    if (!channel || !alert) {
      throw new Error('Channel or alert not found');
    }

    notification.attempts++;
    notification.lastAttempt = Date.now();

    // Simulate notification sending based on channel type
    switch (channel.type) {
      case NotificationChannelType.EMAIL:
        await this.sendEmailNotification(channel, alert);
        break;
      case NotificationChannelType.WEBHOOK:
        await this.sendWebhookNotification(channel, alert);
        break;
      case NotificationChannelType.SLACK:
        await this.sendSlackNotification(channel, alert);
        break;
      default:
        throw new Error(`Unsupported channel type: ${channel.type}`);
    }

    notification.state = 'sent';
    notification.sentAt = Date.now();

    this.emit('notification-sent', { notification, alert, channel });
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    // Simulate email sending
    const emailPayload = {
      to: channel.config.to,
      subject: this.renderTemplate(channel.config.subject || 'Alert: {{.CommonLabels.alertname}}', alert),
      body: this.generateEmailBody(alert),
      headers: {
        'X-Alert-ID': alert.id,
        'X-Alert-Severity': alert.severity
      }
    };

    // In real implementation, this would use an email service
    console.log('Sending email notification:', emailPayload);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    const payload = {
      version: '4',
      groupKey: `${alert.labels.alertname}:${alert.fingerprint}`,
      status: alert.state,
      receiver: channel.name,
      groupLabels: alert.labels,
      commonLabels: alert.labels,
      commonAnnotations: alert.annotations,
      externalURL: 'https://convergio.cli',
      alerts: [alert]
    };

    // In real implementation, this would make an HTTP request
    console.log('Sending webhook notification:', {
      url: channel.config.url,
      method: channel.config.method,
      payload
    });

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    const payload = {
      channel: channel.config.channel,
      username: channel.config.username || 'Convergio CLI Alert',
      icon_emoji: channel.config.iconEmoji || ':warning:',
      text: this.generateSlackMessage(alert),
      attachments: [
        {
          color: this.getSeverityColor(alert.severity),
          fields: [
            {
              title: 'Alert',
              value: alert.labels.alertname,
              short: true
            },
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true
            },
            {
              title: 'Description',
              value: alert.annotations.description || 'No description available',
              short: false
            }
          ],
          ts: Math.floor(alert.startsAt / 1000)
        }
      ]
    };

    // In real implementation, this would call Slack API
    console.log('Sending Slack notification:', payload);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  /**
   * Handle notification sending error
   */
  private handleNotificationError(notification: AlertNotification, error: Error): void {
    notification.state = 'failed';
    notification.error = error.message;

    const channel = this.notificationChannels.get(notification.channelId);
    if (!channel) return;

    // Check if we should retry
    if (notification.attempts < channel.retryPolicy.maxRetries) {
      const delay = Math.min(
        Math.pow(channel.retryPolicy.backoffMultiplier, notification.attempts - 1) * 1000,
        channel.retryPolicy.maxDelay
      );

      notification.state = 'retry';
      notification.retryAt = Date.now() + delay;

      // Schedule retry
      setTimeout(() => {
        this.notificationQueue.push(notification);
        this.processNotificationQueue();
      }, delay);
    }

    this.emit('notification-failed', { notification, error: error.message });
  }

  /**
   * Check if alert is silenced
   */
  private isAlertSilenced(alert: Alert): boolean {
    const now = Date.now();
    
    for (const silence of this.alertSilences.values()) {
      if (now < silence.startsAt || now > silence.endsAt) continue;
      
      const matches = silence.matchers.every(matcher => {
        const labelValue = alert.labels[matcher.name];
        if (!labelValue) return false;
        
        if (matcher.isRegex) {
          const regex = new RegExp(matcher.value);
          return regex.test(labelValue);
        } else {
          return labelValue === matcher.value;
        }
      });
      
      if (matches) {
        alert.silenceId = silence.id;
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if channel is rate limited
   */
  private isRateLimited(channelId: string): boolean {
    const channel = this.notificationChannels.get(channelId);
    if (!channel?.rateLimit.enabled) return false;

    // Simple rate limiting implementation
    // In production, this would be more sophisticated
    return false;
  }

  /**
   * Generate email body for alert
   */
  private generateEmailBody(alert: Alert): string {
    return `
Alert: ${alert.labels.alertname}
Severity: ${alert.severity.toUpperCase()}
Status: ${alert.state.toUpperCase()}
Started: ${new Date(alert.startsAt).toISOString()}

Description:
${alert.annotations.description || 'No description available'}

Labels:
${Object.entries(alert.labels).map(([key, value]) => `  ${key}: ${value}`).join('\n')}

Runbook: ${alert.annotations.runbook_url || 'No runbook available'}
Dashboard: ${alert.annotations.dashboard_url || 'No dashboard available'}

Alert ID: ${alert.id}
    `.trim();
  }

  /**
   * Generate Slack message for alert
   */
  private generateSlackMessage(alert: Alert): string {
    const emoji = this.getSeverityEmoji(alert.severity);
    return `${emoji} *${alert.severity.toUpperCase()}*: ${alert.labels.alertname} is ${alert.state}`;
  }

  /**
   * Get color for alert severity
   */
  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.INFO:
        return 'good';
      case AlertSeverity.WARNING:
        return 'warning';
      case AlertSeverity.CRITICAL:
        return 'danger';
      case AlertSeverity.EMERGENCY:
        return '#FF0000';
      default:
        return '#CCCCCC';
    }
  }

  /**
   * Get emoji for alert severity
   */
  private getSeverityEmoji(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.INFO:
        return ':information_source:';
      case AlertSeverity.WARNING:
        return ':warning:';
      case AlertSeverity.CRITICAL:
        return ':exclamation:';
      case AlertSeverity.EMERGENCY:
        return ':rotating_light:';
      default:
        return ':question:';
    }
  }

  /**
   * Render template with alert data
   */
  private renderTemplate(template: string, alert: Alert): string {
    return template
      .replace(/\{\{\.CommonLabels\.(\w+)\}\}/g, (_, key) => alert.labels[key] || '')
      .replace(/\{\{\s*\$value\s*\}\}/g, String(alert.value || ''))
      .replace(/\{\{\s*\$labels\.(\w+)\s*\}\}/g, (_, key) => alert.labels[key] || '');
  }

  /**
   * Cleanup resolved alerts
   */
  private cleanupResolvedAlerts(): void {
    const now = Date.now();
    const retentionPeriod = 24 * 60 * 60 * 1000; // 24 hours

    for (const [alertId, alert] of this.activeAlerts.entries()) {
      if (alert.state === AlertState.RESOLVED && 
          alert.endsAt && 
          now - alert.endsAt > retentionPeriod) {
        this.activeAlerts.delete(alertId);
        this.emit('alert-cleaned-up', { alertId });
      }
    }
  }

  /**
   * Cleanup expired silences
   */
  private cleanupExpiredSilences(): void {
    const now = Date.now();

    for (const [silenceId, silence] of this.alertSilences.entries()) {
      if (now > silence.endsAt) {
        this.alertSilences.delete(silenceId);
        this.emit('silence-expired', { silenceId });
      }
    }
  }

  /**
   * Create alert rule
   */
  createAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): AlertRule {
    const ruleId = `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newRule: AlertRule = {
      ...rule,
      id: ruleId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.alertRules.set(ruleId, newRule);
    this.emit('rule-created', { ruleId, name: rule.name });

    return newRule;
  }

  /**
   * Update alert rule
   */
  updateAlertRule(ruleId: string, updates: Partial<AlertRule>): AlertRule {
    const rule = this.alertRules.get(ruleId);
    if (!rule) {
      throw new Error(`Alert rule not found: ${ruleId}`);
    }

    const updatedRule: AlertRule = {
      ...rule,
      ...updates,
      id: ruleId, // Prevent ID changes
      updatedAt: Date.now()
    };

    this.alertRules.set(ruleId, updatedRule);
    this.emit('rule-updated', { ruleId, updates });

    return updatedRule;
  }

  /**
   * Delete alert rule
   */
  deleteAlertRule(ruleId: string): boolean {
    const rule = this.alertRules.get(ruleId);
    if (!rule) return false;

    // Resolve any active alerts for this rule
    for (const alert of this.activeAlerts.values()) {
      if (alert.ruleId === ruleId && alert.state === AlertState.FIRING) {
        alert.state = AlertState.RESOLVED;
        alert.endsAt = Date.now();
        alert.updatedAt = Date.now();
      }
    }

    const deleted = this.alertRules.delete(ruleId);
    if (deleted) {
      this.emit('rule-deleted', { ruleId, name: rule.name });
    }

    return deleted;
  }

  /**
   * Create notification channel
   */
  createNotificationChannel(channel: Omit<NotificationChannel, 'id' | 'createdAt' | 'updatedAt'>): NotificationChannel {
    const channelId = `channel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newChannel: NotificationChannel = {
      ...channel,
      id: channelId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.notificationChannels.set(channelId, newChannel);
    this.emit('channel-created', { channelId, name: channel.name, type: channel.type });

    return newChannel;
  }

  /**
   * Create alert silence
   */
  createAlertSilence(silence: Omit<AlertSilence, 'id' | 'createdAt'>): AlertSilence {
    const silenceId = `silence-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newSilence: AlertSilence = {
      ...silence,
      id: silenceId,
      createdAt: Date.now()
    };

    this.alertSilences.set(silenceId, newSilence);
    this.emit('silence-created', { silenceId, comment: silence.comment });

    return newSilence;
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get notification channels
   */
  getNotificationChannels(): NotificationChannel[] {
    return Array.from(this.notificationChannels.values());
  }

  /**
   * Get alerting statistics
   */
  getStatistics(): {
    totalRules: number;
    enabledRules: number;
    activeAlerts: number;
    alertsBySeverity: Record<string, number>;
    notificationChannels: number;
    pendingNotifications: number;
  } {
    const alertsBySeverity: Record<string, number> = {};
    
    for (const alert of this.activeAlerts.values()) {
      if (alert.state === AlertState.FIRING) {
        alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;
      }
    }

    return {
      totalRules: this.alertRules.size,
      enabledRules: Array.from(this.alertRules.values()).filter(r => r.enabled).length,
      activeAlerts: Array.from(this.activeAlerts.values()).filter(a => a.state === AlertState.FIRING).length,
      alertsBySeverity,
      notificationChannels: this.notificationChannels.size,
      pendingNotifications: this.pendingNotifications.size
    };
  }

  /**
   * Test notification channel
   */
  async testNotificationChannel(channelId: string): Promise<boolean> {
    const channel = this.notificationChannels.get(channelId);
    if (!channel) {
      throw new Error(`Notification channel not found: ${channelId}`);
    }

    // Create test alert
    const testAlert: Alert = {
      id: 'test-alert',
      ruleId: 'test-rule',
      state: AlertState.FIRING,
      severity: AlertSeverity.INFO,
      labels: { alertname: 'Test Alert', service: 'test' },
      annotations: { 
        description: 'This is a test alert to verify notification channel configuration',
        summary: 'Test alert for channel validation'
      },
      startsAt: Date.now(),
      updatedAt: Date.now(),
      fingerprint: 'test-fingerprint'
    };

    try {
      await this.sendNotification({
        id: 'test-notification',
        alertId: testAlert.id,
        channelId,
        state: 'pending',
        attempts: 0
      });

      this.emit('channel-test-success', { channelId, channelName: channel.name });
      return true;
    } catch (error) {
      this.emit('channel-test-failed', { 
        channelId, 
        channelName: channel.name, 
        error: (error as Error).message 
      });
      return false;
    }
  }

  /**
   * Get health status
   */
  getHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    evaluationActive: boolean;
    rulesProcessed: number;
    notificationQueueSize: number;
    failedNotifications: number;
  } {
    const stats = this.getStatistics();
    const failedNotifications = Array.from(this.pendingNotifications.values())
      .filter(n => n.state === 'failed').length;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (failedNotifications > 5 || this.notificationQueue.length > 100) {
      status = 'degraded';
    }
    
    if (failedNotifications > 20 || this.notificationQueue.length > 500) {
      status = 'unhealthy';
    }

    return {
      status,
      evaluationActive: !!this.evaluationInterval,
      rulesProcessed: stats.enabledRules,
      notificationQueueSize: this.notificationQueue.length,
      failedNotifications
    };
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.alertRules.clear();
    this.notificationChannels.clear();
    this.activeAlerts.clear();
    this.alertSilences.clear();
    this.escalationPolicies.clear();
    this.pendingNotifications.clear();
    this.notificationQueue = [];

    this.emit('destroyed');
  }
}