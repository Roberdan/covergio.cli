/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';

/**
 * Dashboard widget types
 */
export enum WidgetType {
  METRIC_CHART = 'metric_chart',
  GAUGE = 'gauge',
  TABLE = 'table',
  TEXT = 'text',
  ALERT_LIST = 'alert_list',
  UPTIME = 'uptime',
  HEATMAP = 'heatmap',
  GRAPH = 'graph'
}

/**
 * Chart visualization types
 */
export enum ChartType {
  LINE = 'line',
  BAR = 'bar',
  AREA = 'area',
  SCATTER = 'scatter',
  PIE = 'pie',
  DONUT = 'donut'
}

/**
 * Dashboard widget configuration
 */
export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  description?: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  config: {
    chartType?: ChartType;
    metricName?: string;
    aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
    timeRange?: string;
    refreshInterval?: number;
    thresholds?: Array<{
      value: number;
      color: string;
      label: string;
    }>;
    format?: 'number' | 'percentage' | 'bytes' | 'duration' | 'currency';
    unit?: string;
  };
  dataSources: string[];
  filters?: Record<string, any>;
}

/**
 * Dashboard configuration
 */
export interface Dashboard {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  widgets: DashboardWidget[];
  layout: {
    autoFit: boolean;
    gridSize: number;
    margin: number;
  };
  settings: {
    refreshInterval: number;
    timeRange: string;
    timezone: string;
    enableAutoRefresh: boolean;
    showLegend: boolean;
  };
  permissions: {
    viewers: string[];
    editors: string[];
    owners: string[];
  };
  createdAt: number;
  updatedAt: number;
  version: string;
}

/**
 * Dashboard export format
 */
export interface DashboardExport {
  version: string;
  dashboard: Dashboard;
  exportedAt: number;
  exportedBy: string;
  format: 'grafana' | 'json' | 'prometheus';
}

/**
 * Dashboard template for common scenarios
 */
export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  useCases: string[];
  variables: Array<{
    name: string;
    description: string;
    type: 'string' | 'number' | 'boolean' | 'array';
    defaultValue: any;
    required: boolean;
  }>;
  widgets: Omit<DashboardWidget, 'id' | 'position'>[];
}

/**
 * Dashboard Manager for creating and managing monitoring dashboards
 */
export class DashboardManager extends EventEmitter {
  private dashboards = new Map<string, Dashboard>();
  private templates = new Map<string, DashboardTemplate>();
  private dashboardCache = new Map<string, any>();
  private refreshIntervals = new Map<string, NodeJS.Timeout>();

  constructor() {
    super();
    this.setupDefaultTemplates();
  }

  /**
   * Setup default dashboard templates
   */
  private setupDefaultTemplates(): void {
    // Performance Overview Dashboard Template
    const performanceTemplate: DashboardTemplate = {
      id: 'performance-overview',
      name: 'Performance Overview',
      description: 'Comprehensive performance monitoring dashboard',
      category: 'performance',
      useCases: ['performance monitoring', 'system health', 'SLI tracking'],
      variables: [
        {
          name: 'service_name',
          description: 'Service name to monitor',
          type: 'string',
          defaultValue: 'convergio-cli',
          required: true
        },
        {
          name: 'time_range',
          description: 'Time range for metrics',
          type: 'string',
          defaultValue: '1h',
          required: false
        }
      ],
      widgets: [
        {
          type: WidgetType.METRIC_CHART,
          title: 'Request Rate',
          description: 'Requests per second over time',
          config: {
            chartType: ChartType.LINE,
            metricName: 'requests_total',
            aggregation: 'sum',
            timeRange: '1h',
            refreshInterval: 30000,
            format: 'number',
            unit: 'req/s'
          },
          dataSources: ['prometheus', 'metrics']
        },
        {
          type: WidgetType.GAUGE,
          title: 'Error Rate',
          description: 'Current error rate percentage',
          config: {
            metricName: 'error_rate',
            thresholds: [
              { value: 1, color: 'green', label: 'Good' },
              { value: 5, color: 'yellow', label: 'Warning' },
              { value: 10, color: 'red', label: 'Critical' }
            ],
            format: 'percentage'
          },
          dataSources: ['metrics']
        },
        {
          type: WidgetType.METRIC_CHART,
          title: 'Response Time',
          description: 'P95 response time over time',
          config: {
            chartType: ChartType.AREA,
            metricName: 'request_duration_seconds',
            aggregation: 'avg',
            format: 'duration',
            unit: 'ms'
          },
          dataSources: ['metrics']
        },
        {
          type: WidgetType.UPTIME,
          title: 'Service Availability',
          description: 'Service uptime percentage',
          config: {
            metricName: 'sli_availability',
            format: 'percentage'
          },
          dataSources: ['metrics']
        }
      ]
    };

    // System Resources Dashboard Template
    const systemTemplate: DashboardTemplate = {
      id: 'system-resources',
      name: 'System Resources',
      description: 'System-level resource monitoring',
      category: 'infrastructure',
      useCases: ['resource monitoring', 'capacity planning', 'troubleshooting'],
      variables: [
        {
          name: 'instance',
          description: 'Instance identifier',
          type: 'string',
          defaultValue: 'localhost',
          required: true
        }
      ],
      widgets: [
        {
          type: WidgetType.METRIC_CHART,
          title: 'Memory Usage',
          description: 'Memory utilization over time',
          config: {
            chartType: ChartType.AREA,
            metricName: 'system_memory_heap_used_bytes',
            format: 'bytes'
          },
          dataSources: ['metrics']
        },
        {
          type: WidgetType.GAUGE,
          title: 'CPU Usage',
          description: 'Current CPU utilization',
          config: {
            metricName: 'system_process_cpu_usage_percent',
            thresholds: [
              { value: 50, color: 'green', label: 'Normal' },
              { value: 70, color: 'yellow', label: 'High' },
              { value: 90, color: 'red', label: 'Critical' }
            ],
            format: 'percentage'
          },
          dataSources: ['metrics']
        },
        {
          type: WidgetType.METRIC_CHART,
          title: 'GC Activity',
          description: 'Garbage collection frequency and duration',
          config: {
            chartType: ChartType.BAR,
            metricName: 'gc_collections_total',
            aggregation: 'count'
          },
          dataSources: ['metrics']
        }
      ]
    };

    // Business Metrics Dashboard Template
    const businessTemplate: DashboardTemplate = {
      id: 'business-metrics',
      name: 'Business Metrics',
      description: 'Business KPI and conversion tracking',
      category: 'business',
      useCases: ['business analytics', 'conversion tracking', 'user behavior'],
      variables: [
        {
          name: 'user_segment',
          description: 'User segment to analyze',
          type: 'string',
          defaultValue: 'all',
          required: false
        }
      ],
      widgets: [
        {
          type: WidgetType.METRIC_CHART,
          title: 'Agent Executions',
          description: 'Total agent executions by type',
          config: {
            chartType: ChartType.BAR,
            metricName: 'agent_execution_total',
            aggregation: 'sum'
          },
          dataSources: ['metrics']
        },
        {
          type: WidgetType.TABLE,
          title: 'Conversion Funnel',
          description: 'User progression through funnel steps',
          config: {
            metricName: 'conversion_funnel_step',
            aggregation: 'count'
          },
          dataSources: ['metrics']
        },
        {
          type: WidgetType.PIE,
          title: 'User Sessions',
          description: 'Active user sessions by region',
          config: {
            chartType: ChartType.PIE,
            metricName: 'user_sessions_active',
            aggregation: 'sum'
          },
          dataSources: ['metrics']
        }
      ]
    };

    this.templates.set(performanceTemplate.id, performanceTemplate);
    this.templates.set(systemTemplate.id, systemTemplate);
    this.templates.set(businessTemplate.id, businessTemplate);

    this.emit('templates-loaded', { count: this.templates.size });
  }

  /**
   * Create dashboard from template
   */
  createDashboardFromTemplate(
    templateId: string, 
    name: string,
    variables: Record<string, any> = {},
    customization: Partial<Dashboard> = {}
  ): Dashboard {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate required variables
    for (const variable of template.variables) {
      if (variable.required && !(variable.name in variables)) {
        throw new Error(`Required variable missing: ${variable.name}`);
      }
    }

    const dashboardId = `dashboard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create widgets with positions
    const widgets: DashboardWidget[] = template.widgets.map((widget, index) => {
      const gridX = (index % 3) * 4; // 3 columns
      const gridY = Math.floor(index / 3) * 3; // Each widget is 3 units tall
      
      return {
        ...widget,
        id: `widget-${index + 1}`,
        position: {
          x: gridX,
          y: gridY,
          width: 4,
          height: 3
        }
      };
    });

    const dashboard: Dashboard = {
      id: dashboardId,
      name,
      description: template.description,
      category: template.category,
      tags: template.useCases,
      widgets,
      layout: {
        autoFit: true,
        gridSize: 12,
        margin: 8
      },
      settings: {
        refreshInterval: 30000,
        timeRange: variables.time_range || '1h',
        timezone: 'UTC',
        enableAutoRefresh: true,
        showLegend: true
      },
      permissions: {
        viewers: ['*'], // Public by default
        editors: [],
        owners: ['admin']
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: '1.0.0',
      ...customization
    };

    this.dashboards.set(dashboardId, dashboard);
    this.setupDashboardRefresh(dashboard);

    this.emit('dashboard-created', { 
      dashboardId, 
      templateId, 
      name,
      widgetCount: widgets.length 
    });

    return dashboard;
  }

  /**
   * Create custom dashboard
   */
  createCustomDashboard(config: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>): Dashboard {
    const dashboardId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const dashboard: Dashboard = {
      ...config,
      id: dashboardId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.dashboards.set(dashboardId, dashboard);
    this.setupDashboardRefresh(dashboard);

    this.emit('dashboard-created', { 
      dashboardId, 
      type: 'custom',
      name: dashboard.name,
      widgetCount: dashboard.widgets.length 
    });

    return dashboard;
  }

  /**
   * Update dashboard
   */
  updateDashboard(dashboardId: string, updates: Partial<Dashboard>): Dashboard {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard not found: ${dashboardId}`);
    }

    const updatedDashboard: Dashboard = {
      ...dashboard,
      ...updates,
      updatedAt: Date.now()
    };

    this.dashboards.set(dashboardId, updatedDashboard);
    
    // Update refresh interval if changed
    if (updates.settings?.refreshInterval) {
      this.setupDashboardRefresh(updatedDashboard);
    }

    this.emit('dashboard-updated', { dashboardId, updates });
    return updatedDashboard;
  }

  /**
   * Add widget to dashboard
   */
  addWidget(dashboardId: string, widget: Omit<DashboardWidget, 'id'>): DashboardWidget {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard not found: ${dashboardId}`);
    }

    const widgetId = `widget-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const newWidget: DashboardWidget = {
      ...widget,
      id: widgetId
    };

    dashboard.widgets.push(newWidget);
    dashboard.updatedAt = Date.now();

    this.emit('widget-added', { dashboardId, widgetId, type: widget.type });
    return newWidget;
  }

  /**
   * Remove widget from dashboard
   */
  removeWidget(dashboardId: string, widgetId: string): boolean {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard not found: ${dashboardId}`);
    }

    const initialLength = dashboard.widgets.length;
    dashboard.widgets = dashboard.widgets.filter(w => w.id !== widgetId);
    
    if (dashboard.widgets.length < initialLength) {
      dashboard.updatedAt = Date.now();
      this.emit('widget-removed', { dashboardId, widgetId });
      return true;
    }

    return false;
  }

  /**
   * Get dashboard by ID
   */
  getDashboard(dashboardId: string): Dashboard | undefined {
    return this.dashboards.get(dashboardId);
  }

  /**
   * Get all dashboards
   */
  getAllDashboards(): Dashboard[] {
    return Array.from(this.dashboards.values());
  }

  /**
   * Get dashboards by category
   */
  getDashboardsByCategory(category: string): Dashboard[] {
    return Array.from(this.dashboards.values())
      .filter(dashboard => dashboard.category === category);
  }

  /**
   * Search dashboards
   */
  searchDashboards(query: string): Dashboard[] {
    const lowercaseQuery = query.toLowerCase();
    return Array.from(this.dashboards.values())
      .filter(dashboard => 
        dashboard.name.toLowerCase().includes(lowercaseQuery) ||
        dashboard.description.toLowerCase().includes(lowercaseQuery) ||
        dashboard.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
      );
  }

  /**
   * Get available templates
   */
  getTemplates(): DashboardTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Setup dashboard auto-refresh
   */
  private setupDashboardRefresh(dashboard: Dashboard): void {
    // Clear existing interval
    const existingInterval = this.refreshIntervals.get(dashboard.id);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Setup new interval if auto-refresh is enabled
    if (dashboard.settings.enableAutoRefresh && dashboard.settings.refreshInterval > 0) {
      const interval = setInterval(() => {
        this.refreshDashboardData(dashboard.id);
      }, dashboard.settings.refreshInterval);

      this.refreshIntervals.set(dashboard.id, interval);
    }
  }

  /**
   * Refresh dashboard data
   */
  private refreshDashboardData(dashboardId: string): void {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return;

    // In a real implementation, this would fetch fresh data from data sources
    this.emit('dashboard-refreshed', { 
      dashboardId, 
      timestamp: Date.now(),
      widgetCount: dashboard.widgets.length 
    });
  }

  /**
   * Export dashboard to different formats
   */
  exportDashboard(dashboardId: string, format: 'grafana' | 'json' | 'prometheus' = 'json'): DashboardExport {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard not found: ${dashboardId}`);
    }

    const exportData: DashboardExport = {
      version: '1.0.0',
      dashboard,
      exportedAt: Date.now(),
      exportedBy: 'dashboard-manager',
      format
    };

    this.emit('dashboard-exported', { dashboardId, format });
    return exportData;
  }

  /**
   * Import dashboard from export
   */
  importDashboard(exportData: DashboardExport, newName?: string): Dashboard {
    const dashboard = { ...exportData.dashboard };
    
    if (newName) {
      dashboard.name = newName;
    }

    // Generate new ID to avoid conflicts
    const newId = `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    dashboard.id = newId;
    dashboard.createdAt = Date.now();
    dashboard.updatedAt = Date.now();

    this.dashboards.set(newId, dashboard);
    this.setupDashboardRefresh(dashboard);

    this.emit('dashboard-imported', { 
      dashboardId: newId, 
      originalId: exportData.dashboard.id,
      format: exportData.format 
    });

    return dashboard;
  }

  /**
   * Generate Grafana-compatible dashboard JSON
   */
  generateGrafanaDashboard(dashboardId: string): any {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard not found: ${dashboardId}`);
    }

    // Convert widgets to Grafana panels
    const panels = dashboard.widgets.map((widget, index) => ({
      id: index + 1,
      title: widget.title,
      type: this.mapWidgetTypeToGrafana(widget.type),
      gridPos: {
        h: widget.position.height,
        w: widget.position.width,
        x: widget.position.x,
        y: widget.position.y
      },
      targets: widget.dataSources.map(dataSource => ({
        expr: widget.config.metricName || '',
        refId: 'A',
        datasource: dataSource
      })),
      options: {
        legend: { displayMode: 'visible' },
        tooltip: { mode: 'single' }
      },
      fieldConfig: {
        defaults: {
          unit: widget.config.unit || 'short',
          thresholds: {
            steps: widget.config.thresholds || []
          }
        }
      }
    }));

    return {
      dashboard: {
        id: null,
        title: dashboard.name,
        description: dashboard.description,
        tags: dashboard.tags,
        timezone: dashboard.settings.timezone,
        refresh: `${dashboard.settings.refreshInterval / 1000}s`,
        time: {
          from: `now-${dashboard.settings.timeRange}`,
          to: 'now'
        },
        panels,
        templating: {
          list: []
        },
        annotations: {
          list: []
        },
        schemaVersion: 30,
        version: 1,
        links: []
      },
      meta: {
        type: 'db',
        canSave: true,
        canEdit: true,
        canAdmin: true,
        canStar: true,
        slug: dashboard.id,
        url: `/d/${dashboard.id}/${dashboard.name}`,
        expires: '0001-01-01T00:00:00Z',
        created: new Date(dashboard.createdAt).toISOString(),
        updated: new Date(dashboard.updatedAt).toISOString(),
        updatedBy: 'dashboard-manager',
        createdBy: 'dashboard-manager',
        version: 1
      }
    };
  }

  /**
   * Map widget type to Grafana panel type
   */
  private mapWidgetTypeToGrafana(widgetType: WidgetType): string {
    switch (widgetType) {
      case WidgetType.METRIC_CHART:
        return 'timeseries';
      case WidgetType.GAUGE:
        return 'gauge';
      case WidgetType.TABLE:
        return 'table';
      case WidgetType.TEXT:
        return 'text';
      case WidgetType.HEATMAP:
        return 'heatmap';
      case WidgetType.UPTIME:
        return 'stat';
      default:
        return 'timeseries';
    }
  }

  /**
   * Delete dashboard
   */
  deleteDashboard(dashboardId: string): boolean {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      return false;
    }

    // Clear refresh interval
    const interval = this.refreshIntervals.get(dashboardId);
    if (interval) {
      clearInterval(interval);
      this.refreshIntervals.delete(dashboardId);
    }

    // Clear cache
    this.dashboardCache.delete(dashboardId);

    // Remove dashboard
    const deleted = this.dashboards.delete(dashboardId);
    
    if (deleted) {
      this.emit('dashboard-deleted', { dashboardId, name: dashboard.name });
    }

    return deleted;
  }

  /**
   * Get dashboard statistics
   */
  getStatistics(): {
    totalDashboards: number;
    dashboardsByCategory: Record<string, number>;
    totalWidgets: number;
    widgetsByType: Record<string, number>;
    averageWidgetsPerDashboard: number;
  } {
    const dashboards = Array.from(this.dashboards.values());
    const dashboardsByCategory: Record<string, number> = {};
    const widgetsByType: Record<string, number> = {};
    let totalWidgets = 0;

    for (const dashboard of dashboards) {
      // Count by category
      dashboardsByCategory[dashboard.category] = (dashboardsByCategory[dashboard.category] || 0) + 1;
      
      // Count widgets
      totalWidgets += dashboard.widgets.length;
      
      // Count by widget type
      for (const widget of dashboard.widgets) {
        widgetsByType[widget.type] = (widgetsByType[widget.type] || 0) + 1;
      }
    }

    return {
      totalDashboards: dashboards.length,
      dashboardsByCategory,
      totalWidgets,
      widgetsByType,
      averageWidgetsPerDashboard: dashboards.length > 0 ? totalWidgets / dashboards.length : 0
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Clear all refresh intervals
    for (const interval of this.refreshIntervals.values()) {
      clearInterval(interval);
    }
    
    this.refreshIntervals.clear();
    this.dashboardCache.clear();
    this.dashboards.clear();
    this.templates.clear();

    this.emit('destroyed');
  }
}