/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DashboardManager, WidgetType, ChartType } from './DashboardManager.js';
import { AlertingManager, AlertSeverity, NotificationChannelType, AlertState } from './AlertingManager.js';
import { ReportingManager, ReportType, ReportFormat, ReportFrequency } from './ReportingManager.js';

describe('Dashboard and Alerting System', () => {
  describe('DashboardManager', () => {
    let dashboardManager: DashboardManager;

    beforeEach(() => {
      dashboardManager = new DashboardManager();
    });

    afterEach(() => {
      dashboardManager.destroy();
    });

    it('should create dashboard from template', () => {
      const dashboard = dashboardManager.createDashboardFromTemplate(
        'performance-overview',
        'Test Performance Dashboard',
        { service_name: 'test-service', time_range: '2h' }
      );

      expect(dashboard).toBeDefined();
      expect(dashboard.name).toBe('Test Performance Dashboard');
      expect(dashboard.category).toBe('performance');
      expect(dashboard.widgets).toHaveLength(4); // Default performance template has 4 widgets
      expect(dashboard.settings.timeRange).toBe('2h');
    });

    it('should create custom dashboard', () => {
      const customDashboard = dashboardManager.createCustomDashboard({
        name: 'Custom Test Dashboard',
        description: 'A custom dashboard for testing',
        category: 'test',
        tags: ['test', 'custom'],
        widgets: [
          {
            id: 'test-widget',
            type: WidgetType.GAUGE,
            title: 'Test Gauge',
            position: { x: 0, y: 0, width: 4, height: 3 },
            config: {
              metricName: 'test_metric',
              format: 'percentage'
            },
            dataSources: ['test-source']
          }
        ],
        layout: {
          autoFit: true,
          gridSize: 12,
          margin: 8
        },
        settings: {
          refreshInterval: 30000,
          timeRange: '1h',
          timezone: 'UTC',
          enableAutoRefresh: true,
          showLegend: true
        },
        permissions: {
          viewers: ['*'],
          editors: ['admin'],
          owners: ['admin']
        },
        version: '1.0.0'
      });

      expect(customDashboard).toBeDefined();
      expect(customDashboard.name).toBe('Custom Test Dashboard');
      expect(customDashboard.widgets).toHaveLength(1);
      expect(customDashboard.widgets[0].type).toBe(WidgetType.GAUGE);
    });

    it('should add and remove widgets', () => {
      const dashboard = dashboardManager.createDashboardFromTemplate(
        'performance-overview',
        'Widget Test Dashboard'
      );

      const initialWidgetCount = dashboard.widgets.length;

      // Add widget
      const newWidget = dashboardManager.addWidget(dashboard.id, {
        type: WidgetType.METRIC_CHART,
        title: 'New Chart Widget',
        position: { x: 8, y: 0, width: 4, height: 3 },
        config: {
          chartType: ChartType.LINE,
          metricName: 'new_metric',
          refreshInterval: 10000
        },
        dataSources: ['metrics']
      });

      expect(newWidget).toBeDefined();
      expect(newWidget.title).toBe('New Chart Widget');
      expect(dashboard.widgets).toHaveLength(initialWidgetCount + 1);

      // Remove widget
      const removed = dashboardManager.removeWidget(dashboard.id, newWidget.id);
      expect(removed).toBe(true);
      expect(dashboard.widgets).toHaveLength(initialWidgetCount);
    });

    it('should search and filter dashboards', () => {
      // Create test dashboards
      dashboardManager.createDashboardFromTemplate('performance-overview', 'Performance Test');
      dashboardManager.createDashboardFromTemplate('system-resources', 'System Monitor');
      dashboardManager.createDashboardFromTemplate('business-metrics', 'Business Analytics');

      // Search by name
      const performanceResults = dashboardManager.searchDashboards('performance');
      expect(performanceResults).toHaveLength(1);
      expect(performanceResults[0].name).toContain('Performance');

      // Get by category
      const infraDashboards = dashboardManager.getDashboardsByCategory('infrastructure');
      expect(infraDashboards).toHaveLength(1);
      expect(infraDashboards[0].category).toBe('infrastructure');

      // Get all dashboards
      const allDashboards = dashboardManager.getAllDashboards();
      expect(allDashboards.length).toBeGreaterThanOrEqual(3);
    });

    it('should export and import dashboards', () => {
      const originalDashboard = dashboardManager.createDashboardFromTemplate(
        'performance-overview',
        'Export Test Dashboard'
      );

      // Export dashboard
      const exported = dashboardManager.exportDashboard(originalDashboard.id, 'json');
      expect(exported).toBeDefined();
      expect(exported.dashboard.name).toBe('Export Test Dashboard');
      expect(exported.format).toBe('json');

      // Import dashboard
      const imported = dashboardManager.importDashboard(exported, 'Imported Dashboard');
      expect(imported).toBeDefined();
      expect(imported.name).toBe('Imported Dashboard');
      expect(imported.id).not.toBe(originalDashboard.id);
      expect(imported.widgets).toHaveLength(originalDashboard.widgets.length);
    });

    it('should generate Grafana-compatible dashboard', () => {
      const dashboard = dashboardManager.createDashboardFromTemplate(
        'performance-overview',
        'Grafana Test Dashboard'
      );

      const grafanaDashboard = dashboardManager.generateGrafanaDashboard(dashboard.id);
      
      expect(grafanaDashboard).toBeDefined();
      expect(grafanaDashboard.dashboard).toBeDefined();
      expect(grafanaDashboard.dashboard.title).toBe('Grafana Test Dashboard');
      expect(grafanaDashboard.dashboard.panels).toHaveLength(dashboard.widgets.length);
      expect(grafanaDashboard.meta).toBeDefined();
    });

    it('should provide dashboard statistics', () => {
      // Create test dashboards
      dashboardManager.createDashboardFromTemplate('performance-overview', 'Test 1');
      dashboardManager.createDashboardFromTemplate('system-resources', 'Test 2');
      dashboardManager.createDashboardFromTemplate('business-metrics', 'Test 3');

      const stats = dashboardManager.getStatistics();
      
      expect(stats.totalDashboards).toBeGreaterThanOrEqual(3);
      expect(stats.totalWidgets).toBeGreaterThan(0);
      expect(stats.averageWidgetsPerDashboard).toBeGreaterThan(0);
      expect(stats.dashboardsByCategory).toBeDefined();
      expect(stats.widgetsByType).toBeDefined();
    });

    it('should handle dashboard refresh and auto-refresh', async () => {
      const dashboard = dashboardManager.createDashboardFromTemplate(
        'performance-overview',
        'Refresh Test Dashboard',
        {},
        {
          settings: {
            refreshInterval: 100, // Very short for testing
            timeRange: '1h',
            timezone: 'UTC',
            enableAutoRefresh: true,
            showLegend: true
          }
        }
      );

      // Listen for refresh events
      let refreshCount = 0;
      dashboardManager.on('dashboard-refreshed', () => {
        refreshCount++;
      });

      // Wait for at least one refresh
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(refreshCount).toBeGreaterThan(0);
    });
  });

  describe('AlertingManager', () => {
    let alertingManager: AlertingManager;

    beforeEach(() => {
      alertingManager = new AlertingManager();
    });

    afterEach(() => {
      alertingManager.destroy();
    });

    it('should create alert rules', () => {
      const alertRule = alertingManager.createAlertRule({
        name: 'Test Alert Rule',
        description: 'A test alert rule',
        severity: AlertSeverity.WARNING,
        enabled: true,
        conditions: [
          {
            id: 'test-condition',
            metricName: 'test_metric',
            operator: 'gt' as any,
            value: 100,
            aggregation: 'avg',
            timeWindow: 300
          }
        ],
        evaluation: {
          intervalSeconds: 30,
          forDuration: 60,
          groupBy: ['service'],
          groupWait: 10,
          groupInterval: 300,
          repeatInterval: 3600
        },
        notifications: {
          channels: ['default-email']
        },
        labels: {
          team: 'test',
          severity: 'warning'
        },
        annotations: {
          summary: 'Test metric is too high',
          description: 'Test metric has exceeded the threshold'
        },
        createdBy: 'test-user'
      });

      expect(alertRule).toBeDefined();
      expect(alertRule.name).toBe('Test Alert Rule');
      expect(alertRule.severity).toBe(AlertSeverity.WARNING);
      expect(alertRule.conditions).toHaveLength(1);
    });

    it('should create notification channels', () => {
      const emailChannel = alertingManager.createNotificationChannel({
        name: 'Test Email Channel',
        type: NotificationChannelType.EMAIL,
        enabled: true,
        config: {
          to: ['test@example.com'],
          subject: 'Test Alert: {{.CommonLabels.alertname}}'
        },
        retryPolicy: {
          maxRetries: 3,
          backoffMultiplier: 2,
          maxDelay: 300000
        },
        rateLimit: {
          enabled: true,
          maxNotifications: 10,
          windowSeconds: 300
        }
      });

      expect(emailChannel).toBeDefined();
      expect(emailChannel.name).toBe('Test Email Channel');
      expect(emailChannel.type).toBe(NotificationChannelType.EMAIL);
      expect(emailChannel.config.to).toContain('test@example.com');

      const slackChannel = alertingManager.createNotificationChannel({
        name: 'Test Slack Channel',
        type: NotificationChannelType.SLACK,
        enabled: true,
        config: {
          webhook: 'https://hooks.slack.com/test',
          channel: '#alerts',
          username: 'AlertBot'
        },
        retryPolicy: {
          maxRetries: 5,
          backoffMultiplier: 1.5,
          maxDelay: 600000
        },
        rateLimit: {
          enabled: false,
          maxNotifications: 100,
          windowSeconds: 60
        }
      });

      expect(slackChannel).toBeDefined();
      expect(slackChannel.type).toBe(NotificationChannelType.SLACK);
    });

    it('should create alert silences', () => {
      const silence = alertingManager.createAlertSilence({
        matchers: [
          {
            name: 'alertname',
            value: 'Test Alert Rule',
            isRegex: false
          },
          {
            name: 'severity',
            value: 'warning',
            isRegex: false
          }
        ],
        startsAt: Date.now(),
        endsAt: Date.now() + 3600000, // 1 hour
        comment: 'Silencing for maintenance window',
        createdBy: 'test-user'
      });

      expect(silence).toBeDefined();
      expect(silence.matchers).toHaveLength(2);
      expect(silence.comment).toBe('Silencing for maintenance window');
    });

    it('should test notification channels', async () => {
      const channel = alertingManager.createNotificationChannel({
        name: 'Test Channel',
        type: NotificationChannelType.WEBHOOK,
        enabled: true,
        config: {
          url: 'http://localhost:3000/test-webhook',
          method: 'POST'
        },
        retryPolicy: {
          maxRetries: 3,
          backoffMultiplier: 2,
          maxDelay: 300000
        },
        rateLimit: {
          enabled: false,
          maxNotifications: 100,
          windowSeconds: 60
        }
      });

      // Test the channel (will simulate success/failure)
      const testResult = await alertingManager.testNotificationChannel(channel.id);
      expect(typeof testResult).toBe('boolean');
    });

    it('should track alerting statistics', () => {
      // Create test rules and channels
      alertingManager.createAlertRule({
        name: 'Test Rule 1',
        description: 'Test rule 1',
        severity: AlertSeverity.WARNING,
        enabled: true,
        conditions: [{
          id: 'condition-1',
          metricName: 'metric1',
          operator: 'gt' as any,
          value: 50
        }],
        evaluation: {
          intervalSeconds: 30,
          forDuration: 60,
          groupBy: [],
          groupWait: 10,
          groupInterval: 300,
          repeatInterval: 3600
        },
        notifications: { channels: [] },
        labels: {},
        annotations: {},
        createdBy: 'test'
      });

      alertingManager.createAlertRule({
        name: 'Test Rule 2',
        description: 'Test rule 2',
        severity: AlertSeverity.CRITICAL,
        enabled: false,
        conditions: [{
          id: 'condition-2',
          metricName: 'metric2',
          operator: 'lt' as any,
          value: 10
        }],
        evaluation: {
          intervalSeconds: 15,
          forDuration: 30,
          groupBy: [],
          groupWait: 5,
          groupInterval: 300,
          repeatInterval: 1800
        },
        notifications: { channels: [] },
        labels: {},
        annotations: {},
        createdBy: 'test'
      });

      const stats = alertingManager.getStatistics();
      
      expect(stats.totalRules).toBe(5); // 3 default + 2 test rules
      expect(stats.enabledRules).toBe(4); // 3 default + 1 enabled test rule
      expect(stats.notificationChannels).toBeGreaterThanOrEqual(2); // Default channels
      expect(stats.activeAlerts).toBeGreaterThanOrEqual(0);
      expect(stats.pendingNotifications).toBeGreaterThanOrEqual(0);
    });

    it('should get health status', () => {
      const health = alertingManager.getHealth();
      
      expect(health.status).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(health.evaluationActive).toBe(true);
      expect(health.rulesProcessed).toBeGreaterThanOrEqual(0);
      expect(health.notificationQueueSize).toBeGreaterThanOrEqual(0);
      expect(health.failedNotifications).toBeGreaterThanOrEqual(0);
    });

    it('should handle alert rule lifecycle', () => {
      // Create rule
      const rule = alertingManager.createAlertRule({
        name: 'Lifecycle Test Rule',
        description: 'Testing rule lifecycle',
        severity: AlertSeverity.INFO,
        enabled: true,
        conditions: [{
          id: 'lifecycle-condition',
          metricName: 'lifecycle_metric',
          operator: 'gte' as any,
          value: 75
        }],
        evaluation: {
          intervalSeconds: 60,
          forDuration: 120,
          groupBy: ['service'],
          groupWait: 30,
          groupInterval: 300,
          repeatInterval: 3600
        },
        notifications: { channels: [] },
        labels: { test: 'true' },
        annotations: { description: 'Lifecycle test alert' },
        createdBy: 'test-lifecycle'
      });

      expect(rule).toBeDefined();

      // Update rule
      const updatedRule = alertingManager.updateAlertRule(rule.id, {
        description: 'Updated lifecycle test rule',
        severity: AlertSeverity.WARNING,
        enabled: false
      });

      expect(updatedRule.description).toBe('Updated lifecycle test rule');
      expect(updatedRule.severity).toBe(AlertSeverity.WARNING);
      expect(updatedRule.enabled).toBe(false);

      // Delete rule
      const deleted = alertingManager.deleteAlertRule(rule.id);
      expect(deleted).toBe(true);

      // Verify deletion
      const rules = alertingManager.getAlertRules();
      expect(rules.find(r => r.id === rule.id)).toBeUndefined();
    });
  });

  describe('ReportingManager', () => {
    let reportingManager: ReportingManager;

    beforeEach(() => {
      reportingManager = new ReportingManager();
    });

    afterEach(() => {
      reportingManager.destroy();
    });

    it('should create report configurations', () => {
      const reportConfig = reportingManager.createReportConfig({
        name: 'Test Performance Report',
        description: 'A test performance report',
        type: ReportType.PERFORMANCE_SUMMARY,
        format: ReportFormat.HTML,
        schedule: {
          frequency: ReportFrequency.DAILY,
          time: '09:00',
          timezone: 'UTC'
        },
        parameters: {
          timeRange: '24h',
          services: ['test-service'],
          metrics: ['response_time', 'error_rate'],
          includeCharts: true,
          includeTrends: true,
          includeRecommendations: true
        },
        recipients: {
          email: ['test@example.com']
        },
        enabled: true
      });

      expect(reportConfig).toBeDefined();
      expect(reportConfig.name).toBe('Test Performance Report');
      expect(reportConfig.type).toBe(ReportType.PERFORMANCE_SUMMARY);
      expect(reportConfig.format).toBe(ReportFormat.HTML);
    });

    it('should generate reports on demand', async () => {
      const config = reportingManager.createReportConfig({
        name: 'On-Demand Test Report',
        description: 'Test report generated on demand',
        type: ReportType.SLI_REPORT,
        format: ReportFormat.JSON,
        schedule: {
          frequency: ReportFrequency.ON_DEMAND,
          timezone: 'UTC'
        },
        parameters: {
          timeRange: '1h',
          metrics: ['sli_availability', 'sli_latency'],
          includeCharts: false,
          includeTrends: true,
          includeRecommendations: false
        },
        recipients: {},
        enabled: true
      });

      const report = await reportingManager.generateReport(config.id);
      
      expect(report).toBeDefined();
      expect(report.configId).toBe(config.id);
      expect(report.type).toBe(ReportType.SLI_REPORT);
      expect(report.format).toBe(ReportFormat.JSON);
      expect(report.content).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.metadata.generationDuration).toBeGreaterThan(0);
    });

    it('should generate different report formats', async () => {
      const formats = [ReportFormat.HTML, ReportFormat.MARKDOWN, ReportFormat.CSV, ReportFormat.JSON];
      
      for (const format of formats) {
        const config = reportingManager.createReportConfig({
          name: `Test ${format} Report`,
          description: `Test report in ${format} format`,
          type: ReportType.PERFORMANCE_SUMMARY,
          format,
          schedule: {
            frequency: ReportFrequency.ON_DEMAND,
            timezone: 'UTC'
          },
          parameters: {
            timeRange: '1h',
            metrics: ['test_metric'],
            includeCharts: format === ReportFormat.HTML,
            includeTrends: true,
            includeRecommendations: true
          },
          recipients: {},
          enabled: true
        });

        const report = await reportingManager.generateReport(config.id);
        
        expect(report.format).toBe(format);
        expect(report.content).toBeDefined();
        expect(report.content.length).toBeGreaterThan(0);

        if (format === ReportFormat.JSON) {
          expect(() => JSON.parse(report.content)).not.toThrow();
        }
        if (format === ReportFormat.HTML) {
          expect(report.content).toContain('<html>');
          expect(report.content).toContain('</html>');
        }
        if (format === ReportFormat.MARKDOWN) {
          expect(report.content).toContain('#');
        }
        if (format === ReportFormat.CSV) {
          expect(report.content).toContain(',');
        }
      }
    });

    it('should create and manage runbooks', () => {
      const runbook = reportingManager.createRunbook({
        title: 'Test Incident Response',
        description: 'Test runbook for incident response',
        category: 'incident-response',
        tags: ['test', 'incident', 'response'],
        severity: 'high',
        content: {
          overview: 'This is a test runbook for incident response procedures.',
          prerequisites: [
            'Access to monitoring system',
            'SSH access to servers'
          ],
          steps: [
            {
              title: 'Initial Assessment',
              description: 'Assess the scope and impact of the incident',
              commands: ['curl -s https://api.example.com/health'],
              expectedOutput: '200 OK status',
              troubleshooting: ['Check if service is responding']
            },
            {
              title: 'Investigation',
              description: 'Investigate the root cause',
              commands: ['tail -f /var/log/app.log'],
              expectedOutput: 'Recent log entries',
              troubleshooting: ['Look for error patterns']
            }
          ],
          escalation: {
            contacts: ['on-call@example.com'],
            conditions: ['Incident affects > 50% of users'],
            nextSteps: ['Contact incident commander']
          },
          verification: {
            checks: ['Service is responding', 'Error rate is normal'],
            successCriteria: ['All checks passing for 5 minutes']
          }
        },
        metadata: {
          lastUpdated: Date.now(),
          version: '1.0.0',
          author: 'test-author'
        },
        relatedAlerts: ['high-error-rate'],
        relatedDashboards: ['performance-overview']
      });

      expect(runbook).toBeDefined();
      expect(runbook.title).toBe('Test Incident Response');
      expect(runbook.content.steps).toHaveLength(2);
      expect(runbook.content.escalation.contacts).toContain('on-call@example.com');
    });

    it('should search runbooks', () => {
      // The manager already has default runbooks
      const runbooks = reportingManager.getRunbooks();
      expect(runbooks.length).toBeGreaterThan(0);

      // Search by keyword
      const errorRunbooks = reportingManager.searchRunbooks('error');
      expect(errorRunbooks.length).toBeGreaterThan(0);
      
      const latencyRunbooks = reportingManager.searchRunbooks('latency');
      expect(latencyRunbooks.length).toBeGreaterThan(0);

      // Search by tag
      const performanceRunbooks = reportingManager.searchRunbooks('performance');
      expect(performanceRunbooks.length).toBeGreaterThan(0);
    });

    it('should provide reporting statistics', () => {
      // Create test report configs
      reportingManager.createReportConfig({
        name: 'Test Config 1',
        description: 'Test config 1',
        type: ReportType.PERFORMANCE_SUMMARY,
        format: ReportFormat.HTML,
        schedule: {
          frequency: ReportFrequency.DAILY,
          timezone: 'UTC'
        },
        parameters: {
          timeRange: '24h',
          includeCharts: true,
          includeTrends: true,
          includeRecommendations: true
        },
        recipients: {},
        enabled: true
      });

      reportingManager.createReportConfig({
        name: 'Test Config 2',
        description: 'Test config 2',
        type: ReportType.SLI_REPORT,
        format: ReportFormat.JSON,
        schedule: {
          frequency: ReportFrequency.WEEKLY,
          timezone: 'UTC'
        },
        parameters: {
          timeRange: '7d',
          includeCharts: false,
          includeTrends: true,
          includeRecommendations: false
        },
        recipients: {},
        enabled: false
      });

      const stats = reportingManager.getStatistics();
      
      expect(stats.totalConfigs).toBeGreaterThanOrEqual(5); // 3 default + 2 test
      expect(stats.enabledConfigs).toBeGreaterThanOrEqual(4); // 3 default + 1 enabled test
      expect(stats.totalReports).toBeGreaterThanOrEqual(0);
      expect(stats.totalRunbooks).toBeGreaterThanOrEqual(2); // Default runbooks
      expect(stats.runbooksByCategory).toBeDefined();
    });

    it('should update report configurations', () => {
      const config = reportingManager.createReportConfig({
        name: 'Update Test Config',
        description: 'Config for testing updates',
        type: ReportType.PERFORMANCE_SUMMARY,
        format: ReportFormat.HTML,
        schedule: {
          frequency: ReportFrequency.DAILY,
          timezone: 'UTC'
        },
        parameters: {
          timeRange: '24h',
          includeCharts: true,
          includeTrends: true,
          includeRecommendations: true
        },
        recipients: { email: ['old@example.com'] },
        enabled: true
      });

      const updatedConfig = reportingManager.updateReportConfig(config.id, {
        name: 'Updated Test Config',
        description: 'Updated config description',
        enabled: false,
        recipients: { email: ['new@example.com'] }
      });

      expect(updatedConfig.name).toBe('Updated Test Config');
      expect(updatedConfig.description).toBe('Updated config description');
      expect(updatedConfig.enabled).toBe(false);
      expect(updatedConfig.recipients.email).toContain('new@example.com');
      expect(updatedConfig.updatedAt).toBeGreaterThan(config.createdAt);
    });

    it('should handle custom report parameters', async () => {
      const config = reportingManager.createReportConfig({
        name: 'Custom Params Test',
        description: 'Testing custom parameters',
        type: ReportType.CUSTOM,
        format: ReportFormat.JSON,
        schedule: {
          frequency: ReportFrequency.ON_DEMAND,
          timezone: 'UTC'
        },
        parameters: {
          timeRange: '2h',
          metrics: ['custom_metric'],
          includeCharts: false,
          includeTrends: false,
          includeRecommendations: false
        },
        recipients: {},
        enabled: true
      });

      const customParams = {
        filters: {
          service: 'test-service',
          environment: 'production'
        },
        aggregation: 'hourly',
        includeRawData: true
      };

      const report = await reportingManager.generateReport(config.id, customParams);
      
      expect(report.data.customParams).toEqual(customParams);
    });
  });

  describe('Integration Tests', () => {
    let dashboardManager: DashboardManager;
    let alertingManager: AlertingManager;
    let reportingManager: ReportingManager;

    beforeEach(() => {
      dashboardManager = new DashboardManager();
      alertingManager = new AlertingManager();
      reportingManager = new ReportingManager();
    });

    afterEach(() => {
      dashboardManager.destroy();
      alertingManager.destroy();
      reportingManager.destroy();
    });

    it('should integrate dashboards with alert rules and runbooks', () => {
      // Create dashboard
      const dashboard = dashboardManager.createDashboardFromTemplate(
        'performance-overview',
        'Integrated Test Dashboard'
      );

      // Create alert rule related to dashboard metrics
      const alertRule = alertingManager.createAlertRule({
        name: 'Dashboard Integration Alert',
        description: 'Alert for dashboard integration test',
        severity: AlertSeverity.WARNING,
        enabled: true,
        conditions: [{
          id: 'integration-condition',
          metricName: 'request_duration_seconds',
          operator: 'gt' as any,
          value: 2.0
        }],
        evaluation: {
          intervalSeconds: 30,
          forDuration: 60,
          groupBy: ['service'],
          groupWait: 10,
          groupInterval: 300,
          repeatInterval: 3600
        },
        notifications: { channels: ['default-email'] },
        labels: { dashboard: dashboard.id },
        annotations: {
          dashboard_url: `https://grafana.example.com/d/${dashboard.id}`
        },
        createdBy: 'integration-test'
      });

      // Create runbook related to alert
      const runbook = reportingManager.createRunbook({
        title: 'Dashboard Integration Runbook',
        description: 'Runbook for dashboard integration alert',
        category: 'performance',
        tags: ['integration', 'performance'],
        severity: 'medium',
        content: {
          overview: 'This runbook addresses high response times detected in the dashboard.',
          prerequisites: ['Dashboard access', 'Monitoring access'],
          steps: [{
            title: 'Check Dashboard',
            description: 'Review the performance dashboard for patterns',
            commands: [`open https://grafana.example.com/d/${dashboard.id}`],
            expectedOutput: 'Dashboard shows current metrics',
            troubleshooting: ['Verify dashboard is loading correctly']
          }],
          escalation: {
            contacts: ['team@example.com'],
            conditions: ['Response time > 5 seconds'],
            nextSteps: ['Escalate to senior engineer']
          },
          verification: {
            checks: ['Response time < 2 seconds'],
            successCriteria: ['Dashboard shows green status']
          }
        },
        metadata: {
          lastUpdated: Date.now(),
          version: '1.0.0',
          author: 'integration-test'
        },
        relatedAlerts: [alertRule.id],
        relatedDashboards: [dashboard.id]
      });

      // Verify integration
      expect(dashboard).toBeDefined();
      expect(alertRule).toBeDefined();
      expect(runbook).toBeDefined();
      
      expect(alertRule.labels.dashboard).toBe(dashboard.id);
      expect(alertRule.annotations.dashboard_url).toContain(dashboard.id);
      expect(runbook.relatedAlerts).toContain(alertRule.id);
      expect(runbook.relatedDashboards).toContain(dashboard.id);
    });

    it('should create comprehensive monitoring setup', async () => {
      // Create performance dashboard
      const perfDashboard = dashboardManager.createDashboardFromTemplate(
        'performance-overview',
        'Production Performance Monitor'
      );

      // Create system resources dashboard
      const sysDashboard = dashboardManager.createDashboardFromTemplate(
        'system-resources',
        'Production System Resources'
      );

      // Create critical alerts
      const criticalAlert = alertingManager.createAlertRule({
        name: 'Production Service Down',
        description: 'Critical alert for service availability',
        severity: AlertSeverity.EMERGENCY,
        enabled: true,
        conditions: [{
          id: 'availability-condition',
          metricName: 'sli_availability',
          operator: 'lt' as any,
          value: 95.0
        }],
        evaluation: {
          intervalSeconds: 10,
          forDuration: 30,
          groupBy: ['service'],
          groupWait: 0,
          groupInterval: 60,
          repeatInterval: 300
        },
        notifications: { channels: ['default-email'] },
        labels: { environment: 'production', severity: 'critical' },
        annotations: {
          summary: 'Service availability below 95%',
          runbook_url: 'https://docs.example.com/runbooks/service-down'
        },
        createdBy: 'production-setup'
      });

      // Create warning alert
      const warningAlert = alertingManager.createAlertRule({
        name: 'Production High Latency',
        description: 'Warning alert for high response times',
        severity: AlertSeverity.WARNING,
        enabled: true,
        conditions: [{
          id: 'latency-condition',
          metricName: 'request_duration_seconds',
          operator: 'gt' as any,
          value: 1.5
        }],
        evaluation: {
          intervalSeconds: 30,
          forDuration: 120,
          groupBy: ['service', 'endpoint'],
          groupWait: 30,
          groupInterval: 300,
          repeatInterval: 1800
        },
        notifications: { channels: ['default-email'] },
        labels: { environment: 'production', severity: 'warning' },
        annotations: {
          summary: 'High response time detected',
          description: 'P95 response time above 1.5 seconds'
        },
        createdBy: 'production-setup'
      });

      // Create weekly performance report
      const weeklyReport = reportingManager.createReportConfig({
        name: 'Weekly Production Report',
        description: 'Comprehensive weekly performance review',
        type: ReportType.WEEKLY_REVIEW,
        format: ReportFormat.HTML,
        schedule: {
          frequency: ReportFrequency.WEEKLY,
          dayOfWeek: 1,
          time: '08:00',
          timezone: 'UTC'
        },
        parameters: {
          timeRange: '7d',
          metrics: [
            'sli_availability',
            'request_duration_seconds',
            'error_rate',
            'system_memory_heap_used_bytes',
            'system_process_cpu_usage_percent'
          ],
          includeCharts: true,
          includeTrends: true,
          includeRecommendations: true
        },
        recipients: {
          email: ['team@example.com', 'management@example.com']
        },
        enabled: true
      });

      // Generate test report
      const report = await reportingManager.generateReport(weeklyReport.id);

      // Verify comprehensive setup
      expect(perfDashboard.widgets.length).toBeGreaterThan(0);
      expect(sysDashboard.widgets.length).toBeGreaterThan(0);
      expect(criticalAlert.severity).toBe(AlertSeverity.EMERGENCY);
      expect(warningAlert.severity).toBe(AlertSeverity.WARNING);
      expect(report.type).toBe(ReportType.WEEKLY_REVIEW);
      expect(report.summary.totalMetrics).toBeGreaterThan(0);

      // Verify alert rules are active
      const alertStats = alertingManager.getStatistics();
      expect(alertStats.enabledRules).toBeGreaterThanOrEqual(5); // 3 default + 2 test

      // Verify dashboards are created
      const dashboardStats = dashboardManager.getStatistics();
      expect(dashboardStats.totalDashboards).toBeGreaterThanOrEqual(2);

      // Verify reporting is configured
      const reportingStats = reportingManager.getStatistics();
      expect(reportingStats.enabledConfigs).toBeGreaterThanOrEqual(4); // 3 default + 1 test
    });
  });
});