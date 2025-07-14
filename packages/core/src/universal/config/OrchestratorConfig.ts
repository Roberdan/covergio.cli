/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AgentFactoryConfig {
  maxAgents: number;
  defaultTimeout: number;
  retryAttempts: number;
  healthCheckInterval: number;
}

export interface WorkflowConfig {
  maxConcurrentWorkflows: number;
  stepTimeout: number;
  checkpointInterval: number;
  enableRollback: boolean;
}

export interface EventSystemConfig {
  eventStore: {
    type: 'memory' | 'file' | 'database';
    connection?: string;
    retention?: {
      maxAge: number;
      maxCount: number;
    };
  };
  publisher: {
    batchSize: number;
    flushInterval: number;
  };
}

export interface PerformanceConfig {
  metrics: {
    enabled: boolean;
    collectInterval: number;
    retention: number;
  };
  cache: {
    enabled: boolean;
    maxSize: number;
    ttl: number;
  };
  concurrency: {
    maxConcurrentRequests: number;
    queueSize: number;
  };
}

export interface SecurityConfig {
  authentication: {
    enabled: boolean;
    providers: string[];
  };
  authorization: {
    enabled: boolean;
    defaultRole: string;
  };
  encryption: {
    enabled: boolean;
    algorithm: string;
    keyRotation: number;
  };
}

export interface OrchestratorConfig {
  orchestrator: {
    id: string;
    name: string;
    version: string;
    environment: 'development' | 'staging' | 'production';
  };
  agents: AgentFactoryConfig;
  workflow: WorkflowConfig;
  events: EventSystemConfig;
  performance: PerformanceConfig;
  security: SecurityConfig;
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'text';
    outputs: string[];
  };
  features: {
    fallbackToGemini: boolean;
    experimentalFeatures: string[];
  };
}

export class OrchestratorConfigManager {
  private config: OrchestratorConfig;

  constructor(config?: Partial<OrchestratorConfig>) {
    this.config = this.mergeWithDefaults(config || {});
  }

  private mergeWithDefaults(userConfig: Partial<OrchestratorConfig>): OrchestratorConfig {
    const defaults: OrchestratorConfig = {
      orchestrator: {
        id: 'universal-orchestrator',
        name: 'Convergio Universal Orchestrator',
        version: '1.0.0',
        environment: 'development',
      },
      agents: {
        maxAgents: 10,
        defaultTimeout: 30000,
        retryAttempts: 3,
        healthCheckInterval: 60000,
      },
      workflow: {
        maxConcurrentWorkflows: 5,
        stepTimeout: 120000,
        checkpointInterval: 10000,
        enableRollback: true,
      },
      events: {
        eventStore: {
          type: 'memory',
          retention: {
            maxAge: 86400000, // 24 hours
            maxCount: 10000,
          },
        },
        publisher: {
          batchSize: 100,
          flushInterval: 1000,
        },
      },
      performance: {
        metrics: {
          enabled: true,
          collectInterval: 5000,
          retention: 3600000, // 1 hour
        },
        cache: {
          enabled: true,
          maxSize: 1000,
          ttl: 300000, // 5 minutes
        },
        concurrency: {
          maxConcurrentRequests: 20,
          queueSize: 100,
        },
      },
      security: {
        authentication: {
          enabled: false,
          providers: [],
        },
        authorization: {
          enabled: false,
          defaultRole: 'user',
        },
        encryption: {
          enabled: false,
          algorithm: 'AES-256-GCM',
          keyRotation: 86400000, // 24 hours
        },
      },
      logging: {
        level: 'info',
        format: 'text',
        outputs: ['console'],
      },
      features: {
        fallbackToGemini: true,
        experimentalFeatures: [],
      },
    };

    return this.deepMerge(defaults, userConfig);
  }

  private deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
    const output = { ...target };
    
    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        output[key] = this.deepMerge((target[key] as Record<string, unknown>) || {}, source[key] as Record<string, unknown>);
      } else {
        output[key] = source[key];
      }
    }
    
    return output;
  }

  getConfig(): OrchestratorConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<OrchestratorConfig>): void {
    this.config = this.deepMerge(this.config, updates);
  }

  validate(): boolean {
    const config = this.config;
    
    // Validate required fields
    if (!config.orchestrator.id || !config.orchestrator.name) {
      return false;
    }
    
    // Validate numeric constraints
    if (config.agents.maxAgents <= 0 || config.workflow.maxConcurrentWorkflows <= 0) {
      return false;
    }
    
    // Validate timeouts are positive
    if (config.agents.defaultTimeout <= 0 || config.workflow.stepTimeout <= 0) {
      return false;
    }
    
    return true;
  }

  static fromEnv(): OrchestratorConfigManager {
    const envConfig: Record<string, unknown> = {};

    if (process.env.NODE_ENV) {
      envConfig.orchestrator = {
        environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
      };
    }

    if (process.env.LOG_LEVEL) {
      envConfig.logging = {
        level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
      };
    }

    if (process.env.MAX_AGENTS) {
      envConfig.agents = {
        maxAgents: parseInt(process.env.MAX_AGENTS, 10),
      };
    }

    return new OrchestratorConfigManager(envConfig);
  }
}