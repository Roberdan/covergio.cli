/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Severity levels for security events
 */
export enum SecurityEventSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Types of security events that can be audited
 */
export enum SecurityEventType {
  AUTHENTICATION_SUCCESS = 'authentication_success',
  AUTHENTICATION_FAILURE = 'authentication_failure',
  AUTHORIZATION_GRANTED = 'authorization_granted',
  AUTHORIZATION_DENIED = 'authorization_denied',
  TOKEN_REFRESH = 'token_refresh',
  TOKEN_EXPIRED = 'token_expired',
  SESSION_CREATED = 'session_created',
  SESSION_TERMINATED = 'session_terminated',
  PERMISSION_CREATED = 'permission_created',
  PERMISSION_DELETED = 'permission_deleted',
  ROLE_CREATED = 'role_created',
  ROLE_DELETED = 'role_deleted',
  ROLE_ASSIGNED = 'role_assigned',
  ROLE_REMOVED = 'role_removed',
  ENCRYPTION_KEY_CREATED = 'encryption_key_created',
  ENCRYPTION_KEY_ROTATED = 'encryption_key_rotated',
  CERTIFICATE_VALIDATION_FAILED = 'certificate_validation_failed',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SECURITY_POLICY_VIOLATION = 'security_policy_violation',
  DATA_ACCESS = 'data_access',
  DATA_MODIFICATION = 'data_modification',
  SYSTEM_ERROR = 'system_error',
  CONFIGURATION_CHANGE = 'configuration_change'
}

/**
 * Core audit log entry structure
 */
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventType: SecurityEventType;
  severity: SecurityEventSeverity;
  userId?: string;
  sessionId?: string;
  sourceIp?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  outcome: 'success' | 'failure' | 'error';
  message: string;
  details?: Record<string, any>;
  metadata?: {
    version: string;
    source: string;
    requestId?: string;
    correlationId?: string;
  };
}

/**
 * Tamper-evident log entry with integrity verification
 */
export interface TamperEvidentLogEntry extends AuditLogEntry {
  hash: string;
  previousHash?: string;
  signature?: string;
  sequenceNumber: number;
}

/**
 * Security alert configuration
 */
export interface SecurityAlert {
  id: string;
  name: string;
  description: string;
  eventTypes: SecurityEventType[];
  conditions: AlertCondition[];
  severity: SecurityEventSeverity;
  enabled: boolean;
  notificationChannels: NotificationChannel[];
  cooldownPeriod: number; // seconds
  metadata?: Record<string, any>;
}

/**
 * Alert condition for triggering notifications
 */
export interface AlertCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'regex';
  value: any;
  timeWindow?: number; // seconds
  threshold?: number; // for count-based conditions
}

/**
 * Notification channel configuration
 */
export interface NotificationChannel {
  type: 'email' | 'webhook' | 'sms' | 'slack' | 'teams' | 'log';
  config: Record<string, any>;
  enabled: boolean;
}

/**
 * Log retention policy
 */
export interface LogRetentionPolicy {
  id: string;
  name: string;
  description: string;
  retentionPeriod: number; // days
  archiveAfter?: number; // days
  compressionEnabled: boolean;
  encryptionRequired: boolean;
  conditions?: {
    eventTypes?: SecurityEventType[];
    severity?: SecurityEventSeverity[];
    tags?: string[];
  };
}

/**
 * Audit log statistics
 */
export interface AuditLogStatistics {
  totalEntries: number;
  entriesByType: Record<SecurityEventType, number>;
  entriesBySeverity: Record<SecurityEventSeverity, number>;
  recentActivity: {
    last24Hours: number;
    lastWeek: number;
    lastMonth: number;
  };
  topUsers: Array<{
    userId: string;
    eventCount: number;
  }>;
  topResources: Array<{
    resource: string;
    accessCount: number;
  }>;
  integrityStatus: {
    verified: number;
    corrupted: number;
    lastVerification: string;
  };
}

/**
 * Audit log query parameters
 */
export interface AuditLogQuery {
  startTime?: string;
  endTime?: string;
  eventTypes?: SecurityEventType[];
  severity?: SecurityEventSeverity[];
  userId?: string;
  sessionId?: string;
  resource?: string;
  outcome?: 'success' | 'failure' | 'error';
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'severity' | 'eventType';
  sortOrder?: 'asc' | 'desc';
  includeDetails?: boolean;
  correlationId?: string;
}

/**
 * Real-time monitoring configuration
 */
export interface MonitoringConfig {
  enabled: boolean;
  alerting: {
    enabled: boolean;
    evaluationInterval: number; // seconds
    maxAlertsPerHour: number;
  };
  retention: {
    defaultPolicy: string;
    policies: LogRetentionPolicy[];
  };
  integrity: {
    verificationEnabled: boolean;
    verificationInterval: number; // hours
    signingKey?: string;
  };
  performance: {
    batchSize: number;
    flushInterval: number; // seconds
    maxMemoryUsage: number; // MB
  };
  storage: {
    backend: 'file' | 'database' | 'elasticsearch' | 'cloudwatch';
    config: Record<string, any>;
    compression: boolean;
    encryption: boolean;
  };
}

/**
 * Security monitoring dashboard data
 */
export interface SecurityDashboardData {
  overview: {
    totalEvents: number;
    criticalAlerts: number;
    activeThreats: number;
    systemHealth: 'healthy' | 'warning' | 'critical';
  };
  recentEvents: AuditLogEntry[];
  alertsTriggered: Array<{
    alertId: string;
    alertName: string;
    severity: SecurityEventSeverity;
    triggeredAt: string;
    eventCount: number;
  }>;
  threatIndicators: Array<{
    type: string;
    severity: SecurityEventSeverity;
    description: string;
    firstSeen: string;
    lastSeen: string;
    occurrences: number;
  }>;
  complianceStatus: {
    gdprCompliant: boolean;
    hipaaCompliant: boolean;
    sox404Compliant: boolean;
    lastAssessment: string;
  };
}

/**
 * Audit log export options
 */
export interface AuditLogExportOptions {
  format: 'json' | 'csv' | 'xml' | 'pdf';
  includeDetails: boolean;
  dateRange: {
    start: string;
    end: string;
  };
  filters?: AuditLogQuery;
  compression: boolean;
  encryption?: {
    enabled: boolean;
    password?: string;
    algorithm?: string;
  };
  metadata: {
    exportedBy: string;
    exportReason: string;
    classification?: string;
  };
}