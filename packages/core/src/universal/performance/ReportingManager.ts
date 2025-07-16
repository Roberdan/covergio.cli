/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';

/**
 * Report types
 */
export enum ReportType {
  PERFORMANCE_SUMMARY = 'performance_summary',
  SLI_REPORT = 'sli_report',
  ALERT_SUMMARY = 'alert_summary',
  CAPACITY_PLANNING = 'capacity_planning',
  INCIDENT_REPORT = 'incident_report',
  WEEKLY_REVIEW = 'weekly_review',
  MONTHLY_REVIEW = 'monthly_review',
  CUSTOM = 'custom'
}

/**
 * Report format
 */
export enum ReportFormat {
  HTML = 'html',
  PDF = 'pdf',
  JSON = 'json',
  CSV = 'csv',
  MARKDOWN = 'markdown'
}

/**
 * Report schedule frequency
 */
export enum ReportFrequency {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ON_DEMAND = 'on_demand'
}

/**
 * Report configuration
 */
export interface ReportConfig {
  id: string;
  name: string;
  description: string;
  type: ReportType;
  format: ReportFormat;
  schedule: {
    frequency: ReportFrequency;
    time?: string; // HH:MM format
    dayOfWeek?: number; // 0-6, Sunday = 0
    dayOfMonth?: number; // 1-31
    timezone: string;
  };
  parameters: {
    timeRange: string;
    services?: string[];
    metrics?: string[];
    thresholds?: Record<string, number>;
    includeCharts: boolean;
    includeTrends: boolean;
    includeRecommendations: boolean;
  };
  recipients: {
    email?: string[];
    slack?: string[];
    webhook?: string;
  };
  template?: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  lastRun?: number;
  nextRun?: number;
}

/**
 * Generated report
 */
export interface GeneratedReport {
  id: string;
  configId: string;
  name: string;
  type: ReportType;
  format: ReportFormat;
  generatedAt: number;
  timeRange: {
    start: number;
    end: number;
  };
  data: any;
  content: string;
  charts?: Array<{
    id: string;
    title: string;
    type: string;
    data: any;
  }>;
  summary: {
    totalMetrics: number;
    alertsTriggered: number;
    sliViolations: number;
    recommendations: string[];
  };
  metadata: {
    generationDuration: number;
    dataPoints: number;
    fileSize?: number;
    filePath?: string;
  };
}

/**
 * Runbook configuration
 */
export interface Runbook {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  content: {
    overview: string;
    prerequisites: string[];
    steps: Array<{
      title: string;
      description: string;
      commands?: string[];
      expectedOutput?: string;
      troubleshooting?: string[];
    }>;
    escalation: {
      contacts: string[];
      conditions: string[];
      nextSteps: string[];
    };
    verification: {
      checks: string[];
      successCriteria: string[];
    };
  };
  metadata: {
    lastUpdated: number;
    version: string;
    author: string;
    reviewedBy?: string[];
    approvedBy?: string;
  };
  relatedAlerts: string[];
  relatedDashboards: string[];
}

/**
 * Performance trend analysis
 */
export interface TrendAnalysis {
  metric: string;
  timeRange: {
    start: number;
    end: number;
  };
  trend: 'improving' | 'stable' | 'degrading' | 'volatile';
  changePercent: number;
  analysis: {
    baseline: number;
    current: number;
    peak: number;
    trough: number;
    volatility: number;
  };
  predictions: {
    nextWeek: number;
    nextMonth: number;
    confidence: number;
  };
  recommendations: string[];
}

/**
 * Comprehensive Reporting Manager
 */
export class ReportingManager extends EventEmitter {
  private reportConfigs = new Map<string, ReportConfig>();
  private generatedReports = new Map<string, GeneratedReport>();
  private runbooks = new Map<string, Runbook>();
  private scheduleInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.setupDefaultReports();
    this.setupDefaultRunbooks();
    this.startScheduler();
  }

  /**
   * Setup default report configurations
   */
  private setupDefaultReports(): void {
    // Weekly Performance Summary
    const weeklyPerformance: ReportConfig = {
      id: 'weekly-performance',
      name: 'Weekly Performance Summary',
      description: 'Comprehensive weekly performance review',
      type: ReportType.WEEKLY_REVIEW,
      format: ReportFormat.HTML,
      schedule: {
        frequency: ReportFrequency.WEEKLY,
        time: '09:00',
        dayOfWeek: 1, // Monday
        timezone: 'UTC'
      },
      parameters: {
        timeRange: '7d',
        includeCharts: true,
        includeTrends: true,
        includeRecommendations: true,
        thresholds: {
          errorRate: 5.0,
          latency: 2000,
          availability: 99.9
        }
      },
      recipients: {
        email: ['team@convergio.cli', 'management@convergio.cli']
      },
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Daily SLI Report
    const dailySLI: ReportConfig = {
      id: 'daily-sli',
      name: 'Daily SLI Report',
      description: 'Daily Service Level Indicator summary',
      type: ReportType.SLI_REPORT,
      format: ReportFormat.JSON,
      schedule: {
        frequency: ReportFrequency.DAILY,
        time: '08:00',
        timezone: 'UTC'
      },
      parameters: {
        timeRange: '24h',
        metrics: ['sli_availability', 'sli_latency', 'sli_error_budget'],
        includeCharts: false,
        includeTrends: true,
        includeRecommendations: false
      },
      recipients: {
        webhook: 'https://api.convergio.cli/reports/sli'
      },
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Monthly Capacity Planning Report
    const monthlyCapacity: ReportConfig = {
      id: 'monthly-capacity',
      name: 'Monthly Capacity Planning',
      description: 'Resource utilization and capacity planning analysis',
      type: ReportType.CAPACITY_PLANNING,
      format: ReportFormat.PDF,
      schedule: {
        frequency: ReportFrequency.MONTHLY,
        dayOfMonth: 1,
        time: '10:00',
        timezone: 'UTC'
      },
      parameters: {
        timeRange: '30d',
        metrics: [
          'system_memory_heap_used_bytes',
          'system_process_cpu_usage_percent',
          'active_connections',
          'request_duration_seconds'
        ],
        includeCharts: true,
        includeTrends: true,
        includeRecommendations: true
      },
      recipients: {
        email: ['sre@convergio.cli', 'infrastructure@convergio.cli']
      },
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.reportConfigs.set(weeklyPerformance.id, weeklyPerformance);
    this.reportConfigs.set(dailySLI.id, dailySLI);
    this.reportConfigs.set(monthlyCapacity.id, monthlyCapacity);

    this.calculateNextRuns();
  }

  /**
   * Setup default runbooks
   */
  private setupDefaultRunbooks(): void {
    // High Error Rate Runbook
    const errorRateRunbook: Runbook = {
      id: 'high-error-rate-runbook',
      title: 'High Error Rate Response',
      description: 'Step-by-step guide for investigating and resolving high error rates',
      category: 'performance',
      tags: ['errors', 'troubleshooting', 'performance'],
      severity: 'high',
      content: {
        overview: `This runbook provides guidance for investigating and resolving high error rates in the Convergio CLI system. 
                   High error rates can indicate various issues including service degradation, configuration problems, 
                   or external dependency failures.`,
        prerequisites: [
          'Access to monitoring dashboards',
          'SSH access to application servers',
          'Database read access',
          'Log aggregation system access'
        ],
        steps: [
          {
            title: 'Initial Assessment',
            description: 'Quickly assess the scope and impact of the error rate increase',
            commands: [
              'curl -s https://api.convergio.cli/health',
              'kubectl get pods -n convergio-cli'
            ],
            expectedOutput: 'Healthy services should return 200 OK status',
            troubleshooting: [
              'If health check fails, proceed to step 2',
              'If pods are in error state, check logs immediately'
            ]
          },
          {
            title: 'Check Recent Deployments',
            description: 'Verify if recent deployments correlate with error spike',
            commands: [
              'git log --oneline --since="2 hours ago"',
              'kubectl rollout history deployment/convergio-cli'
            ],
            expectedOutput: 'List of recent commits and deployment history',
            troubleshooting: [
              'If recent deployment found, consider rollback',
              'Check deployment logs for any failures'
            ]
          },
          {
            title: 'Analyze Error Patterns',
            description: 'Examine error logs to identify patterns and root causes',
            commands: [
              'grep -i error /var/log/convergio-cli/app.log | tail -100',
              'journalctl -u convergio-cli --since "1 hour ago" | grep ERROR'
            ],
            expectedOutput: 'Error patterns showing specific failure modes',
            troubleshooting: [
              'Look for common error messages',
              'Check for external service timeouts',
              'Verify database connectivity'
            ]
          },
          {
            title: 'Check External Dependencies',
            description: 'Verify status of external services and APIs',
            commands: [
              'curl -s https://status.external-api.com',
              'ping external-database.com'
            ],
            expectedOutput: 'All external services should be operational',
            troubleshooting: [
              'If external service is down, implement circuit breaker',
              'Consider using cached responses if available'
            ]
          },
          {
            title: 'Resource Utilization Check',
            description: 'Monitor system resources for bottlenecks',
            commands: [
              'top -n 1',
              'df -h',
              'free -h'
            ],
            expectedOutput: 'CPU < 80%, Memory < 90%, Disk < 85%',
            troubleshooting: [
              'If resources are exhausted, scale horizontally',
              'Check for memory leaks in application'
            ]
          }
        ],
        escalation: {
          contacts: ['on-call-engineer@convergio.cli', 'team-lead@convergio.cli'],
          conditions: [
            'Error rate exceeds 20% for more than 5 minutes',
            'Multiple services affected simultaneously',
            'Unable to identify root cause within 15 minutes'
          ],
          nextSteps: [
            'Engage incident commander',
            'Prepare for emergency rollback',
            'Notify stakeholders via incident channel'
          ]
        },
        verification: {
          checks: [
            'Error rate returns to baseline (< 5%)',
            'All health checks passing',
            'No new error patterns in logs',
            'External dependencies responding normally'
          ],
          successCriteria: [
            'Error rate stable below 2% for 10 minutes',
            'All monitoring alerts resolved',
            'Post-incident review scheduled'
          ]
        }
      },
      metadata: {
        lastUpdated: Date.now(),
        version: '1.0.0',
        author: 'SRE Team',
        reviewedBy: ['tech-lead@convergio.cli'],
        approvedBy: 'engineering-manager@convergio.cli'
      },
      relatedAlerts: ['high-error-rate'],
      relatedDashboards: ['performance-overview']
    };

    // High Latency Runbook
    const latencyRunbook: Runbook = {
      id: 'high-latency-runbook',
      title: 'High Latency Investigation',
      description: 'Comprehensive guide for diagnosing and resolving performance issues',
      category: 'performance',
      tags: ['latency', 'performance', 'optimization'],
      severity: 'medium',
      content: {
        overview: `This runbook addresses high response time issues in the Convergio CLI system. 
                   High latency can severely impact user experience and may indicate underlying 
                   performance bottlenecks.`,
        prerequisites: [
          'Performance monitoring access',
          'Application profiling tools',
          'Database query analysis tools'
        ],
        steps: [
          {
            title: 'Latency Baseline Check',
            description: 'Compare current latency with historical baselines',
            commands: [
              'curl -w "@curl-format.txt" -s https://api.convergio.cli/benchmark'
            ],
            expectedOutput: 'Response time breakdown by component',
            troubleshooting: [
              'If total time > 2 seconds, investigate further',
              'Focus on highest contributor to total time'
            ]
          },
          {
            title: 'Database Performance Analysis',
            description: 'Check for slow queries and connection issues',
            commands: [
              'SHOW PROCESSLIST;',
              'SELECT * FROM information_schema.processlist WHERE time > 5;'
            ],
            expectedOutput: 'List of active database connections and queries',
            troubleshooting: [
              'Kill long-running queries if safe to do so',
              'Check for missing indexes on frequently queried columns'
            ]
          },
          {
            title: 'Application Profiling',
            description: 'Profile application performance to identify bottlenecks',
            commands: [
              'node --inspect app.js',
              'curl http://localhost:9229/json'
            ],
            expectedOutput: 'Profiling data showing function call times',
            troubleshooting: [
              'Look for functions consuming > 100ms',
              'Check for inefficient algorithms or loops'
            ]
          }
        ],
        escalation: {
          contacts: ['performance-team@convergio.cli'],
          conditions: [
            'P95 latency > 5 seconds for more than 10 minutes',
            'Database queries timing out'
          ],
          nextSteps: [
            'Enable detailed application profiling',
            'Consider emergency performance optimizations'
          ]
        },
        verification: {
          checks: [
            'P95 latency < 2 seconds',
            'No database query timeouts',
            'CPU utilization stable'
          ],
          successCriteria: [
            'All performance metrics within SLA',
            'User experience restored to normal'
          ]
        }
      },
      metadata: {
        lastUpdated: Date.now(),
        version: '1.0.0',
        author: 'Performance Team'
      },
      relatedAlerts: ['high-latency'],
      relatedDashboards: ['performance-overview', 'database-performance']
    };

    this.runbooks.set(errorRateRunbook.id, errorRateRunbook);
    this.runbooks.set(latencyRunbook.id, latencyRunbook);
  }

  /**
   * Start report scheduler
   */
  private startScheduler(): void {
    this.scheduleInterval = setInterval(() => {
      this.checkScheduledReports();
    }, 60000); // Check every minute

    this.cleanupInterval = setInterval(() => {
      this.cleanupOldReports();
    }, 3600000); // Cleanup every hour
  }

  /**
   * Check for scheduled reports that need to run
   */
  private async checkScheduledReports(): Promise<void> {
    const now = Date.now();

    for (const [configId, config] of this.reportConfigs.entries()) {
      if (!config.enabled) continue;
      if (!config.nextRun || now < config.nextRun) continue;

      try {
        await this.generateReport(configId);
        this.updateNextRun(config);
      } catch (error) {
        this.emit('report-generation-failed', { 
          configId, 
          error: (error as Error).message 
        });
      }
    }
  }

  /**
   * Generate report
   */
  async generateReport(configId: string, customParams?: any): Promise<GeneratedReport> {
    const config = this.reportConfigs.get(configId);
    if (!config) {
      throw new Error(`Report configuration not found: ${configId}`);
    }

    const startTime = Date.now();
    const reportId = `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Calculate time range
    const timeRange = this.parseTimeRange(config.parameters.timeRange);
    
    // Gather data based on report type
    const reportData = await this.gatherReportData(config, timeRange, customParams);
    
    // Generate content based on format
    const content = await this.generateReportContent(config, reportData);
    
    // Create charts if requested
    const charts = config.parameters.includeCharts ? 
      await this.generateCharts(config, reportData) : [];

    // Generate summary and recommendations
    const summary = this.generateSummary(reportData);
    const recommendations = config.parameters.includeRecommendations ? 
      this.generateRecommendations(reportData) : [];

    const report: GeneratedReport = {
      id: reportId,
      configId,
      name: config.name,
      type: config.type,
      format: config.format,
      generatedAt: Date.now(),
      timeRange,
      data: reportData,
      content,
      charts,
      summary: {
        ...summary,
        recommendations
      },
      metadata: {
        generationDuration: Date.now() - startTime,
        dataPoints: this.countDataPoints(reportData)
      }
    };

    this.generatedReports.set(reportId, report);

    // Update last run time
    config.lastRun = Date.now();
    config.updatedAt = Date.now();

    // Send report to recipients
    await this.distributeReport(report, config.recipients);

    this.emit('report-generated', { reportId, configId, type: config.type });
    
    return report;
  }

  /**
   * Parse time range string into timestamps
   */
  private parseTimeRange(timeRange: string): { start: number; end: number } {
    const end = Date.now();
    let start = end;

    const match = timeRange.match(/^(\d+)([hdwmy])$/);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];
      
      const multipliers = {
        h: 60 * 60 * 1000,      // hours
        d: 24 * 60 * 60 * 1000, // days
        w: 7 * 24 * 60 * 60 * 1000, // weeks
        m: 30 * 24 * 60 * 60 * 1000, // months (approximate)
        y: 365 * 24 * 60 * 60 * 1000 // years (approximate)
      };

      start = end - (value * multipliers[unit as keyof typeof multipliers]);
    }

    return { start, end };
  }

  /**
   * Gather data for report generation
   */
  private async gatherReportData(
    config: ReportConfig, 
    timeRange: { start: number; end: number },
    customParams?: any
  ): Promise<any> {
    // In a real implementation, this would query the metrics system
    // For now, we'll simulate data gathering
    
    const data = {
      timeRange,
      metrics: {},
      alerts: [],
      trends: [],
      sliData: {},
      systemHealth: {}
    };

    // Simulate metric data gathering
    if (config.parameters.metrics) {
      for (const metric of config.parameters.metrics) {
        data.metrics[metric] = this.simulateMetricData(metric, timeRange);
      }
    }

    // Simulate trend analysis
    if (config.parameters.includeTrends) {
      data.trends = this.simulateTrendAnalysis(config.parameters.metrics || []);
    }

    // Add custom parameters
    if (customParams) {
      data.customParams = customParams;
    }

    return data;
  }

  /**
   * Simulate metric data for reports
   */
  private simulateMetricData(metricName: string, timeRange: { start: number; end: number }): any {
    const points = [];
    const duration = timeRange.end - timeRange.start;
    const intervalMs = Math.min(duration / 100, 60000); // Max 1 minute intervals

    for (let time = timeRange.start; time <= timeRange.end; time += intervalMs) {
      let value = 0;
      
      // Generate realistic-looking data based on metric name
      if (metricName.includes('error_rate')) {
        value = Math.random() * 10; // 0-10% error rate
      } else if (metricName.includes('latency') || metricName.includes('duration')) {
        value = 100 + Math.random() * 500; // 100-600ms
      } else if (metricName.includes('memory')) {
        value = 50 + Math.random() * 40; // 50-90% memory usage
      } else if (metricName.includes('cpu')) {
        value = 20 + Math.random() * 60; // 20-80% CPU usage
      } else {
        value = Math.random() * 100;
      }

      points.push({ timestamp: time, value });
    }

    return {
      name: metricName,
      points,
      aggregations: {
        avg: points.reduce((sum, p) => sum + p.value, 0) / points.length,
        min: Math.min(...points.map(p => p.value)),
        max: Math.max(...points.map(p => p.value)),
        current: points[points.length - 1]?.value || 0
      }
    };
  }

  /**
   * Simulate trend analysis
   */
  private simulateTrendAnalysis(metrics: string[]): TrendAnalysis[] {
    return metrics.map(metric => ({
      metric,
      timeRange: { start: Date.now() - 7 * 24 * 60 * 60 * 1000, end: Date.now() },
      trend: ['improving', 'stable', 'degrading', 'volatile'][Math.floor(Math.random() * 4)] as any,
      changePercent: (Math.random() - 0.5) * 40, // -20% to +20%
      analysis: {
        baseline: 100,
        current: 95 + Math.random() * 10,
        peak: 120,
        trough: 80,
        volatility: Math.random() * 0.3
      },
      predictions: {
        nextWeek: 95 + Math.random() * 10,
        nextMonth: 90 + Math.random() * 20,
        confidence: 0.7 + Math.random() * 0.3
      },
      recommendations: [
        'Monitor for continued trend',
        'Consider optimization if degrading',
        'Validate with business metrics'
      ]
    }));
  }

  /**
   * Generate report content based on format
   */
  private async generateReportContent(config: ReportConfig, data: any): Promise<string> {
    switch (config.format) {
      case ReportFormat.HTML:
        return this.generateHTMLReport(config, data);
      case ReportFormat.MARKDOWN:
        return this.generateMarkdownReport(config, data);
      case ReportFormat.JSON:
        return JSON.stringify(data, null, 2);
      case ReportFormat.CSV:
        return this.generateCSVReport(config, data);
      default:
        return this.generateTextReport(config, data);
    }
  }

  /**
   * Generate HTML report
   */
  private generateHTMLReport(config: ReportConfig, data: any): string {
    const timeRange = new Date(data.timeRange.start).toISOString().split('T')[0] + 
                     ' to ' + 
                     new Date(data.timeRange.end).toISOString().split('T')[0];

    let html = `
<!DOCTYPE html>
<html>
<head>
    <title>${config.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f5f5f5; padding: 20px; border-radius: 5px; }
        .metric { margin: 10px 0; padding: 10px; border-left: 3px solid #007cba; }
        .trend-up { color: #28a745; }
        .trend-down { color: #dc3545; }
        .trend-stable { color: #6c757d; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${config.name}</h1>
        <p><strong>Report Type:</strong> ${config.type}</p>
        <p><strong>Time Range:</strong> ${timeRange}</p>
        <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
    </div>

    <h2>Executive Summary</h2>
    <p>This report provides insights into system performance for the specified time period.</p>
`;

    // Add metrics section
    if (data.metrics && Object.keys(data.metrics).length > 0) {
      html += '<h2>Key Metrics</h2>\n';
      for (const [metricName, metricData] of Object.entries(data.metrics)) {
        const metric = metricData as any;
        html += `
        <div class="metric">
            <h3>${metricName}</h3>
            <p><strong>Current:</strong> ${metric.aggregations.current.toFixed(2)}</p>
            <p><strong>Average:</strong> ${metric.aggregations.avg.toFixed(2)}</p>
            <p><strong>Min/Max:</strong> ${metric.aggregations.min.toFixed(2)} / ${metric.aggregations.max.toFixed(2)}</p>
        </div>
        `;
      }
    }

    // Add trends section
    if (data.trends && data.trends.length > 0) {
      html += '<h2>Trend Analysis</h2>\n<table>\n';
      html += '<tr><th>Metric</th><th>Trend</th><th>Change %</th><th>Confidence</th></tr>\n';
      
      for (const trend of data.trends) {
        const trendClass = trend.trend === 'improving' ? 'trend-up' : 
                          trend.trend === 'degrading' ? 'trend-down' : 'trend-stable';
        
        html += `
        <tr>
            <td>${trend.metric}</td>
            <td class="${trendClass}">${trend.trend.toUpperCase()}</td>
            <td>${trend.changePercent.toFixed(1)}%</td>
            <td>${(trend.predictions.confidence * 100).toFixed(1)}%</td>
        </tr>
        `;
      }
      html += '</table>\n';
    }

    html += '</body></html>';
    return html;
  }

  /**
   * Generate Markdown report
   */
  private generateMarkdownReport(config: ReportConfig, data: any): string {
    const timeRange = new Date(data.timeRange.start).toISOString().split('T')[0] + 
                     ' to ' + 
                     new Date(data.timeRange.end).toISOString().split('T')[0];

    let markdown = `# ${config.name}

**Report Type:** ${config.type}
**Time Range:** ${timeRange}
**Generated:** ${new Date().toISOString()}

## Executive Summary

This report provides comprehensive insights into system performance and health metrics.

`;

    // Add metrics section
    if (data.metrics && Object.keys(data.metrics).length > 0) {
      markdown += '## Key Metrics\n\n';
      for (const [metricName, metricData] of Object.entries(data.metrics)) {
        const metric = metricData as any;
        markdown += `### ${metricName}

- **Current Value:** ${metric.aggregations.current.toFixed(2)}
- **Average:** ${metric.aggregations.avg.toFixed(2)}
- **Range:** ${metric.aggregations.min.toFixed(2)} - ${metric.aggregations.max.toFixed(2)}

`;
      }
    }

    // Add trends section
    if (data.trends && data.trends.length > 0) {
      markdown += '## Trend Analysis\n\n';
      markdown += '| Metric | Trend | Change % | Confidence |\n';
      markdown += '|--------|-------|----------|------------|\n';
      
      for (const trend of data.trends) {
        const trendIcon = trend.trend === 'improving' ? '📈' : 
                         trend.trend === 'degrading' ? '📉' : '➡️';
        
        markdown += `| ${trend.metric} | ${trendIcon} ${trend.trend.toUpperCase()} | ${trend.changePercent.toFixed(1)}% | ${(trend.predictions.confidence * 100).toFixed(1)}% |\n`;
      }
      markdown += '\n';
    }

    return markdown;
  }

  /**
   * Generate CSV report
   */
  private generateCSVReport(config: ReportConfig, data: any): string {
    let csv = 'Metric,Current,Average,Min,Max,Trend,Change%\n';
    
    if (data.metrics) {
      for (const [metricName, metricData] of Object.entries(data.metrics)) {
        const metric = metricData as any;
        const trend = data.trends?.find((t: any) => t.metric === metricName);
        
        csv += `${metricName},`;
        csv += `${metric.aggregations.current.toFixed(2)},`;
        csv += `${metric.aggregations.avg.toFixed(2)},`;
        csv += `${metric.aggregations.min.toFixed(2)},`;
        csv += `${metric.aggregations.max.toFixed(2)},`;
        csv += `${trend?.trend || 'unknown'},`;
        csv += `${trend?.changePercent.toFixed(1) || '0'}\n`;
      }
    }
    
    return csv;
  }

  /**
   * Generate text report
   */
  private generateTextReport(config: ReportConfig, data: any): string {
    const timeRange = new Date(data.timeRange.start).toISOString().split('T')[0] + 
                     ' to ' + 
                     new Date(data.timeRange.end).toISOString().split('T')[0];

    let text = `${config.name}\n`;
    text += '='.repeat(config.name.length) + '\n\n';
    text += `Report Type: ${config.type}\n`;
    text += `Time Range: ${timeRange}\n`;
    text += `Generated: ${new Date().toISOString()}\n\n`;

    if (data.metrics) {
      text += 'KEY METRICS\n-----------\n';
      for (const [metricName, metricData] of Object.entries(data.metrics)) {
        const metric = metricData as any;
        text += `${metricName}:\n`;
        text += `  Current: ${metric.aggregations.current.toFixed(2)}\n`;
        text += `  Average: ${metric.aggregations.avg.toFixed(2)}\n`;
        text += `  Range: ${metric.aggregations.min.toFixed(2)} - ${metric.aggregations.max.toFixed(2)}\n\n`;
      }
    }

    return text;
  }

  /**
   * Generate charts for report
   */
  private async generateCharts(config: ReportConfig, data: any): Promise<any[]> {
    const charts = [];

    if (data.metrics) {
      for (const [metricName, metricData] of Object.entries(data.metrics)) {
        const metric = metricData as any;
        
        charts.push({
          id: `chart-${metricName}`,
          title: `${metricName} Over Time`,
          type: 'line',
          data: {
            labels: metric.points.map((p: any) => new Date(p.timestamp).toISOString().substr(11, 8)),
            datasets: [{
              label: metricName,
              data: metric.points.map((p: any) => p.value),
              borderColor: '#007cba',
              backgroundColor: 'rgba(0, 124, 186, 0.1)'
            }]
          }
        });
      }
    }

    return charts;
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(data: any): any {
    let totalMetrics = 0;
    let alertsTriggered = 0;
    let sliViolations = 0;

    if (data.metrics) {
      totalMetrics = Object.keys(data.metrics).length;
    }

    if (data.alerts) {
      alertsTriggered = data.alerts.length;
    }

    if (data.trends) {
      sliViolations = data.trends.filter((t: any) => t.trend === 'degrading').length;
    }

    return {
      totalMetrics,
      alertsTriggered,
      sliViolations
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(data: any): string[] {
    const recommendations: string[] = [];

    if (data.trends) {
      for (const trend of data.trends) {
        if (trend.trend === 'degrading' && Math.abs(trend.changePercent) > 10) {
          recommendations.push(`Monitor ${trend.metric} closely - showing ${trend.changePercent.toFixed(1)}% degradation`);
        }
      }
    }

    if (data.metrics) {
      for (const [metricName, metricData] of Object.entries(data.metrics)) {
        const metric = metricData as any;
        if (metricName.includes('error_rate') && metric.aggregations.avg > 5) {
          recommendations.push(`High error rate detected in ${metricName} - investigate root cause`);
        }
        if (metricName.includes('latency') && metric.aggregations.avg > 1000) {
          recommendations.push(`High latency in ${metricName} - consider performance optimization`);
        }
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('System performance is within normal parameters');
    }

    return recommendations;
  }

  /**
   * Count data points in report data
   */
  private countDataPoints(data: any): number {
    let count = 0;
    
    if (data.metrics) {
      for (const metricData of Object.values(data.metrics)) {
        const metric = metricData as any;
        count += metric.points?.length || 0;
      }
    }

    return count;
  }

  /**
   * Distribute report to recipients
   */
  private async distributeReport(report: GeneratedReport, recipients: ReportConfig['recipients']): Promise<void> {
    // Email distribution
    if (recipients.email && recipients.email.length > 0) {
      for (const email of recipients.email) {
        await this.sendEmailReport(report, email);
      }
    }

    // Slack distribution
    if (recipients.slack && recipients.slack.length > 0) {
      for (const channel of recipients.slack) {
        await this.sendSlackReport(report, channel);
      }
    }

    // Webhook distribution
    if (recipients.webhook) {
      await this.sendWebhookReport(report, recipients.webhook);
    }
  }

  /**
   * Send report via email
   */
  private async sendEmailReport(report: GeneratedReport, email: string): Promise<void> {
    // Simulate email sending
    console.log(`Sending ${report.format} report "${report.name}" to ${email}`);
    
    // In real implementation, this would use an email service
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.emit('report-email-sent', { reportId: report.id, email });
  }

  /**
   * Send report via Slack
   */
  private async sendSlackReport(report: GeneratedReport, channel: string): Promise<void> {
    // Simulate Slack sending
    console.log(`Sending report summary to Slack channel: ${channel}`);
    
    const message = {
      channel,
      text: `📊 New ${report.type} report: ${report.name}`,
      attachments: [
        {
          color: 'good',
          fields: [
            {
              title: 'Total Metrics',
              value: report.summary.totalMetrics.toString(),
              short: true
            },
            {
              title: 'Alerts Triggered',
              value: report.summary.alertsTriggered.toString(),
              short: true
            },
            {
              title: 'Generated',
              value: new Date(report.generatedAt).toISOString(),
              short: true
            }
          ]
        }
      ]
    };

    // In real implementation, this would call Slack API
    await new Promise(resolve => setTimeout(resolve, 150));
    
    this.emit('report-slack-sent', { reportId: report.id, channel });
  }

  /**
   * Send report via webhook
   */
  private async sendWebhookReport(report: GeneratedReport, webhookUrl: string): Promise<void> {
    // Simulate webhook sending
    console.log(`Sending report data to webhook: ${webhookUrl}`);
    
    const payload = {
      reportId: report.id,
      name: report.name,
      type: report.type,
      generatedAt: report.generatedAt,
      summary: report.summary,
      data: report.format === ReportFormat.JSON ? report.data : null
    };

    // In real implementation, this would make HTTP request
    await new Promise(resolve => setTimeout(resolve, 200));
    
    this.emit('report-webhook-sent', { reportId: report.id, webhookUrl });
  }

  /**
   * Update next run time for report config
   */
  private updateNextRun(config: ReportConfig): void {
    const now = Date.now();
    
    switch (config.schedule.frequency) {
      case ReportFrequency.HOURLY:
        config.nextRun = now + 60 * 60 * 1000;
        break;
      case ReportFrequency.DAILY:
        config.nextRun = now + 24 * 60 * 60 * 1000;
        break;
      case ReportFrequency.WEEKLY:
        config.nextRun = now + 7 * 24 * 60 * 60 * 1000;
        break;
      case ReportFrequency.MONTHLY:
        config.nextRun = now + 30 * 24 * 60 * 60 * 1000;
        break;
      default:
        config.nextRun = undefined;
    }
  }

  /**
   * Calculate next run times for all configs
   */
  private calculateNextRuns(): void {
    for (const config of this.reportConfigs.values()) {
      if (config.enabled && config.schedule.frequency !== ReportFrequency.ON_DEMAND) {
        this.updateNextRun(config);
      }
    }
  }

  /**
   * Cleanup old reports
   */
  private cleanupOldReports(): void {
    const now = Date.now();
    const retentionPeriod = 30 * 24 * 60 * 60 * 1000; // 30 days

    for (const [reportId, report] of this.generatedReports.entries()) {
      if (now - report.generatedAt > retentionPeriod) {
        this.generatedReports.delete(reportId);
        this.emit('report-cleaned-up', { reportId });
      }
    }
  }

  /**
   * Create report configuration
   */
  createReportConfig(config: Omit<ReportConfig, 'id' | 'createdAt' | 'updatedAt'>): ReportConfig {
    const configId = `config-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newConfig: ReportConfig = {
      ...config,
      id: configId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.reportConfigs.set(configId, newConfig);
    
    if (newConfig.enabled && newConfig.schedule.frequency !== ReportFrequency.ON_DEMAND) {
      this.updateNextRun(newConfig);
    }

    this.emit('report-config-created', { configId, name: config.name });
    
    return newConfig;
  }

  /**
   * Update report configuration
   */
  updateReportConfig(configId: string, updates: Partial<ReportConfig>): ReportConfig {
    const config = this.reportConfigs.get(configId);
    if (!config) {
      throw new Error(`Report configuration not found: ${configId}`);
    }

    const updatedConfig: ReportConfig = {
      ...config,
      ...updates,
      id: configId, // Prevent ID changes
      updatedAt: Date.now()
    };

    this.reportConfigs.set(configId, updatedConfig);
    
    // Recalculate next run if schedule changed
    if (updates.schedule) {
      this.updateNextRun(updatedConfig);
    }

    this.emit('report-config-updated', { configId, updates });
    
    return updatedConfig;
  }

  /**
   * Create runbook
   */
  createRunbook(runbook: Omit<Runbook, 'id'>): Runbook {
    const runbookId = `runbook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newRunbook: Runbook = {
      ...runbook,
      id: runbookId
    };

    this.runbooks.set(runbookId, newRunbook);
    this.emit('runbook-created', { runbookId, title: runbook.title });
    
    return newRunbook;
  }

  /**
   * Get report configurations
   */
  getReportConfigs(): ReportConfig[] {
    return Array.from(this.reportConfigs.values());
  }

  /**
   * Get generated reports
   */
  getGeneratedReports(limit?: number): GeneratedReport[] {
    const reports = Array.from(this.generatedReports.values())
      .sort((a, b) => b.generatedAt - a.generatedAt);
    
    return limit ? reports.slice(0, limit) : reports;
  }

  /**
   * Get runbooks
   */
  getRunbooks(): Runbook[] {
    return Array.from(this.runbooks.values());
  }

  /**
   * Get runbook by ID
   */
  getRunbook(runbookId: string): Runbook | undefined {
    return this.runbooks.get(runbookId);
  }

  /**
   * Search runbooks
   */
  searchRunbooks(query: string): Runbook[] {
    const lowercaseQuery = query.toLowerCase();
    return Array.from(this.runbooks.values())
      .filter(runbook => 
        runbook.title.toLowerCase().includes(lowercaseQuery) ||
        runbook.description.toLowerCase().includes(lowercaseQuery) ||
        runbook.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
      );
  }

  /**
   * Get reporting statistics
   */
  getStatistics(): {
    totalConfigs: number;
    enabledConfigs: number;
    totalReports: number;
    reportsThisWeek: number;
    totalRunbooks: number;
    runbooksByCategory: Record<string, number>;
  } {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    
    const reportsThisWeek = Array.from(this.generatedReports.values())
      .filter(report => report.generatedAt > weekAgo).length;

    const runbooksByCategory: Record<string, number> = {};
    for (const runbook of this.runbooks.values()) {
      runbooksByCategory[runbook.category] = (runbooksByCategory[runbook.category] || 0) + 1;
    }

    return {
      totalConfigs: this.reportConfigs.size,
      enabledConfigs: Array.from(this.reportConfigs.values()).filter(c => c.enabled).length,
      totalReports: this.generatedReports.size,
      reportsThisWeek,
      totalRunbooks: this.runbooks.size,
      runbooksByCategory
    };
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.reportConfigs.clear();
    this.generatedReports.clear();
    this.runbooks.clear();

    this.emit('destroyed');
  }
}