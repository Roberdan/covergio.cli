/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { 
  AgentTemplate, 
  AgentConfig, 
  PersonalityTrait, 
  ValidationResult, 
  ValidationError,
  ValidationWarning
} from '../types.js';

/**
 * Extended agent template with domain-specific features
 */
export interface DomainAgentTemplate extends AgentTemplate {
  domainSpecific: {
    knowledgeBase: string[];
    specializedTools: string[];
    communicationPatterns: CommunicationPattern[];
    behaviorRules: BehaviorRule[];
    validationRules: ValidationRule[];
  };
  inheritance: {
    baseTemplate?: string;
    mixins?: string[];
  };
  customization: {
    configurableFields: ConfigurableField[];
    presets: TemplatePreset[];
  };
  metadata: {
    author: string;
    version: string;
    category: string;
    tags: string[];
    lastUpdated: Date;
    usageCount: number;
  };
}

/**
 * Communication pattern for domain-specific interactions
 */
export interface CommunicationPattern {
  name: string;
  description: string;
  triggers: string[];
  responseTemplate: string;
  tone: 'formal' | 'casual' | 'friendly' | 'professional' | 'technical';
  context: string[];
}

/**
 * Behavior rule for domain-specific actions
 */
export interface BehaviorRule {
  name: string;
  description: string;
  condition: string;
  action: string;
  priority: number;
  active: boolean;
}

/**
 * Validation rule for domain-specific requirements
 */
export interface ValidationRule {
  field: string;
  rule: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Configurable field for template customization
 */
export interface ConfigurableField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  defaultValue: any;
  required: boolean;
  options?: any[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    custom?: (value: any) => boolean;
  };
}

/**
 * Template preset for quick configuration
 */
export interface TemplatePreset {
  name: string;
  description: string;
  configuration: Record<string, any>;
  tags: string[];
}

/**
 * Template composition result
 */
export interface TemplateComposition {
  template: DomainAgentTemplate;
  appliedMixins: string[];
  overrides: Record<string, any>;
  warnings: string[];
}

/**
 * Template validation context
 */
export interface TemplateValidationContext {
  domain: string;
  role: string;
  requiredCapabilities: string[];
  customConfig: Record<string, any>;
}

/**
 * Agent template system for managing domain-specific templates
 */
export class AgentTemplateSystem extends EventEmitter {
  private templates = new Map<string, DomainAgentTemplate>();
  private mixins = new Map<string, Partial<DomainAgentTemplate>>();
  private presets = new Map<string, TemplatePreset>();

  constructor() {
    super();
    this.initializeBuiltInTemplates();
  }

  /**
   * Register a new domain template
   */
  registerTemplate(template: DomainAgentTemplate): void {
    const templateId = this.getTemplateId(template.domain, template.role);
    
    // Validate template structure
    const validation = this.validateTemplate(template);
    if (!validation.valid) {
      throw new Error(`Invalid template: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    this.templates.set(templateId, template);
    this.emit('template-registered', { templateId, template });
  }

  /**
   * Get template by domain and role
   */
  getTemplate(domain: string, role: string): DomainAgentTemplate | null {
    const templateId = this.getTemplateId(domain, role);
    return this.templates.get(templateId) || null;
  }

  /**
   * Get all templates for a domain
   */
  getTemplatesForDomain(domain: string): DomainAgentTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.domain === domain);
  }

  /**
   * Search templates by criteria
   */
  searchTemplates(criteria: {
    domain?: string;
    category?: string;
    tags?: string[];
    capabilities?: string[];
  }): DomainAgentTemplate[] {
    return Array.from(this.templates.values()).filter(template => {
      if (criteria.domain && template.domain !== criteria.domain) return false;
      if (criteria.category && template.metadata.category !== criteria.category) return false;
      if (criteria.tags && !criteria.tags.some(tag => template.metadata.tags.includes(tag))) return false;
      if (criteria.capabilities && !criteria.capabilities.some(cap => template.defaultCapabilities.includes(cap))) return false;
      return true;
    });
  }

  /**
   * Create agent configuration from template
   */
  createAgentConfig(
    templateId: string, 
    customization: Record<string, any> = {}
  ): AgentConfig {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Apply template composition (inheritance and mixins)
    const composition = this.composeTemplate(template);
    
    // Apply customization
    const config = this.applyCustomization(composition.template, customization);
    
    // Validate final configuration
    const validation = this.validateConfiguration(config, composition.template);
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    return config;
  }

  /**
   * Register a mixin for template composition
   */
  registerMixin(name: string, mixin: Partial<DomainAgentTemplate>): void {
    this.mixins.set(name, mixin);
    this.emit('mixin-registered', { name, mixin });
  }

  /**
   * Register a preset for quick configuration
   */
  registerPreset(name: string, preset: TemplatePreset): void {
    this.presets.set(name, preset);
    this.emit('preset-registered', { name, preset });
  }

  /**
   * Get available presets for a template
   */
  getPresetsForTemplate(templateId: string): TemplatePreset[] {
    const template = this.templates.get(templateId);
    if (!template) return [];
    
    return template.customization.presets.concat(
      Array.from(this.presets.values())
        .filter(preset => preset.tags.includes(template.domain) || preset.tags.includes(template.metadata.category))
    );
  }

  /**
   * Clone and customize a template
   */
  cloneTemplate(
    sourceTemplateId: string, 
    newDomain: string, 
    newRole: string, 
    customization: Partial<DomainAgentTemplate>
  ): DomainAgentTemplate {
    const sourceTemplate = this.templates.get(sourceTemplateId);
    if (!sourceTemplate) {
      throw new Error(`Source template not found: ${sourceTemplateId}`);
    }

    const clonedTemplate: DomainAgentTemplate = {
      ...JSON.parse(JSON.stringify(sourceTemplate)),
      id: this.getTemplateId(newDomain, newRole),
      domain: newDomain,
      role: newRole,
      inheritance: {
        baseTemplate: sourceTemplateId,
        mixins: sourceTemplate.inheritance.mixins || []
      },
      metadata: {
        ...sourceTemplate.metadata,
        version: '1.0.0',
        lastUpdated: new Date(),
        usageCount: 0
      },
      ...customization
    };

    return clonedTemplate;
  }

  /**
   * Update template usage statistics
   */
  updateUsageStats(templateId: string): void {
    const template = this.templates.get(templateId);
    if (template) {
      template.metadata.usageCount++;
      template.metadata.lastUpdated = new Date();
      this.emit('template-used', { templateId, usageCount: template.metadata.usageCount });
    }
  }

  /**
   * Export template as JSON
   */
  exportTemplate(templateId: string): string {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    
    return JSON.stringify(template, null, 2);
  }

  /**
   * Import template from JSON
   */
  importTemplate(templateJson: string): void {
    const template: DomainAgentTemplate = JSON.parse(templateJson);
    this.registerTemplate(template);
  }

  /**
   * Get template system statistics
   */
  getStatistics(): {
    totalTemplates: number;
    templatesByDomain: Record<string, number>;
    templatesByCategory: Record<string, number>;
    mostUsedTemplates: Array<{ id: string; usageCount: number }>;
    totalMixins: number;
    totalPresets: number;
  } {
    const templates = Array.from(this.templates.values());
    
    return {
      totalTemplates: templates.length,
      templatesByDomain: templates.reduce((acc, template) => {
        acc[template.domain] = (acc[template.domain] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      templatesByCategory: templates.reduce((acc, template) => {
        acc[template.metadata.category] = (acc[template.metadata.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      mostUsedTemplates: templates
        .sort((a, b) => b.metadata.usageCount - a.metadata.usageCount)
        .slice(0, 10)
        .map(template => ({ id: template.id, usageCount: template.metadata.usageCount })),
      totalMixins: this.mixins.size,
      totalPresets: this.presets.size
    };
  }

  /**
   * Compose template with inheritance and mixins
   */
  private composeTemplate(template: DomainAgentTemplate): TemplateComposition {
    const composition: TemplateComposition = {
      template: JSON.parse(JSON.stringify(template)),
      appliedMixins: [],
      overrides: {},
      warnings: []
    };

    // Apply base template if specified
    if (template.inheritance.baseTemplate) {
      const baseTemplate = this.templates.get(template.inheritance.baseTemplate);
      if (baseTemplate) {
        composition.template = this.mergeTemplates(baseTemplate, composition.template);
      } else {
        composition.warnings.push(`Base template not found: ${template.inheritance.baseTemplate}`);
      }
    }

    // Apply mixins
    if (template.inheritance.mixins) {
      for (const mixinName of template.inheritance.mixins) {
        const mixin = this.mixins.get(mixinName);
        if (mixin) {
          composition.template = this.mergeTemplates(composition.template, mixin as DomainAgentTemplate);
          composition.appliedMixins.push(mixinName);
        } else {
          composition.warnings.push(`Mixin not found: ${mixinName}`);
        }
      }
    }

    return composition;
  }

  /**
   * Merge two templates
   */
  private mergeTemplates(base: DomainAgentTemplate, override: Partial<DomainAgentTemplate>): DomainAgentTemplate {
    const merged: DomainAgentTemplate = JSON.parse(JSON.stringify(base));

    // Merge arrays by concatenating and removing duplicates
    if (override.defaultCapabilities) {
      merged.defaultCapabilities = [...new Set([...merged.defaultCapabilities, ...override.defaultCapabilities])];
    }
    
    if (override.defaultTools) {
      merged.defaultTools = [...new Set([...merged.defaultTools, ...override.defaultTools])];
    }

    if (override.defaultPersonalityTraits) {
      // Merge personality traits, override existing ones
      const traitMap = new Map(merged.defaultPersonalityTraits.map(trait => [trait.name, trait]));
      override.defaultPersonalityTraits.forEach(trait => traitMap.set(trait.name, trait));
      merged.defaultPersonalityTraits = Array.from(traitMap.values());
    }

    // Merge domain-specific features
    if (override.domainSpecific) {
      merged.domainSpecific = {
        ...merged.domainSpecific,
        ...override.domainSpecific,
        knowledgeBase: [...new Set([...merged.domainSpecific.knowledgeBase, ...(override.domainSpecific.knowledgeBase || [])])],
        specializedTools: [...new Set([...merged.domainSpecific.specializedTools, ...(override.domainSpecific.specializedTools || [])])]
      };
    }

    // Merge other properties
    Object.keys(override).forEach(key => {
      if (key !== 'defaultCapabilities' && key !== 'defaultTools' && key !== 'defaultPersonalityTraits' && key !== 'domainSpecific') {
        (merged as any)[key] = (override as any)[key];
      }
    });

    return merged;
  }

  /**
   * Apply customization to template
   */
  private applyCustomization(template: DomainAgentTemplate, customization: Record<string, any>): AgentConfig {
    const config: AgentConfig = {
      domain: template.domain,
      role: template.role,
      capabilities: [...template.defaultCapabilities],
      personalityTraits: [...template.defaultPersonalityTraits],
      tools: [...template.defaultTools],
      customSettings: { ...customization }
    };

    // Apply configurable fields
    template.customization.configurableFields.forEach(field => {
      if (customization[field.name] !== undefined) {
        switch (field.name) {
          case 'capabilities':
            config.capabilities = customization[field.name];
            break;
          case 'personalityTraits':
            config.personalityTraits = customization[field.name];
            break;
          case 'tools':
            config.tools = customization[field.name];
            break;
          default:
            config.customSettings![field.name] = customization[field.name];
        }
      }
    });

    return config;
  }

  /**
   * Validate template structure
   */
  private validateTemplate(template: DomainAgentTemplate): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Required fields
    if (!template.id) errors.push({ field: 'id', message: 'Template ID is required' });
    if (!template.domain) errors.push({ field: 'domain', message: 'Domain is required' });
    if (!template.role) errors.push({ field: 'role', message: 'Role is required' });
    if (!template.description) errors.push({ field: 'description', message: 'Description is required' });

    // Domain-specific validation
    if (template.domainSpecific) {
      if (!template.domainSpecific.knowledgeBase || !Array.isArray(template.domainSpecific.knowledgeBase)) {
        errors.push({ field: 'domainSpecific.knowledgeBase', message: 'Knowledge base must be an array' });
      }
      
      if (!template.domainSpecific.specializedTools || !Array.isArray(template.domainSpecific.specializedTools)) {
        errors.push({ field: 'domainSpecific.specializedTools', message: 'Specialized tools must be an array' });
      }
    }

    // Inheritance validation
    if (template.inheritance.baseTemplate && template.inheritance.baseTemplate === template.id) {
      errors.push({ field: 'inheritance.baseTemplate', message: 'Template cannot inherit from itself' });
    }

    // Metadata validation
    if (!template.metadata.author) warnings.push({ field: 'metadata.author', message: 'Author is recommended' });
    if (!template.metadata.version) warnings.push({ field: 'metadata.version', message: 'Version is recommended' });

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate configuration against template
   */
  private validateConfiguration(config: AgentConfig, template: DomainAgentTemplate): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Apply validation rules
    template.domainSpecific.validationRules.forEach(rule => {
      const fieldValue = this.getFieldValue(config, rule.field);
      if (!this.evaluateRule(fieldValue, rule.rule)) {
        const error = { field: rule.field, message: rule.message };
        if (rule.severity === 'error') {
          errors.push(error);
        } else {
          warnings.push(error);
        }
      }
    });

    // Validate configurable fields
    template.customization.configurableFields.forEach(field => {
      const value = config.customSettings?.[field.name];
      
      if (field.required && (value === undefined || value === null)) {
        errors.push({ field: field.name, message: `${field.name} is required` });
      }
      
      if (value !== undefined && field.validation) {
        if (field.validation.min !== undefined && value < field.validation.min) {
          errors.push({ field: field.name, message: `${field.name} must be >= ${field.validation.min}` });
        }
        
        if (field.validation.max !== undefined && value > field.validation.max) {
          errors.push({ field: field.name, message: `${field.name} must be <= ${field.validation.max}` });
        }
        
        if (field.validation.pattern && !new RegExp(field.validation.pattern).test(value)) {
          errors.push({ field: field.name, message: `${field.name} does not match required pattern` });
        }
        
        if (field.validation.custom && !field.validation.custom(value)) {
          errors.push({ field: field.name, message: `${field.name} failed custom validation` });
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get field value from configuration
   */
  private getFieldValue(config: AgentConfig, fieldPath: string): any {
    const path = fieldPath.split('.');
    let value: any = config;
    
    for (const segment of path) {
      if (value && typeof value === 'object') {
        value = value[segment];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Evaluate validation rule
   */
  private evaluateRule(value: any, rule: string): boolean {
    // Simple rule evaluation (can be extended with a proper expression parser)
    try {
      return new Function('value', `return ${rule}`)(value);
    } catch {
      return false;
    }
  }

  /**
   * Get template ID
   */
  private getTemplateId(domain: string, role: string): string {
    return `${domain}:${role}`;
  }

  /**
   * Initialize built-in templates
   */
  private initializeBuiltInTemplates(): void {
    // Register templates from registry
    this.registerTemplatesFromRegistry();
    
    // Register common mixins
    this.registerCommonMixins();
    this.registerCommonPresets();
  }

  /**
   * Register templates from domain template registry
   */
  private registerTemplatesFromRegistry(): void {
    // Import templates synchronously to avoid async issues
    try {
      // Import directly from the registry
      import('./domains/index.js').then(module => {
        for (const [templateId, template] of module.DOMAIN_TEMPLATE_REGISTRY.entries()) {
          this.registerTemplate(template);
        }
      }).catch(error => {
        console.warn('Failed to load domain templates:', error);
      });
    } catch (error) {
      console.warn('Error importing domain templates:', error);
    }
  }

  /**
   * Manually register domain templates (for testing and direct usage)
   */
  registerDomainTemplates(templateRegistry: Map<string, any>): void {
    for (const [templateId, template] of templateRegistry.entries()) {
      this.registerTemplate(template);
    }
  }

  /**
   * Register common mixins for template composition
   */
  private registerCommonMixins(): void {
    // Communication mixin
    this.registerMixin('communication-mixin', {
      defaultPersonalityTraits: [
        { name: 'communicative', value: 0.8, description: 'Excellent communication skills', category: 'social' },
        { name: 'responsive', value: 0.8, description: 'Quick and responsive', category: 'social' }
      ],
      domainSpecific: {
        knowledgeBase: ['communication-best-practices'],
        specializedTools: ['response-optimizer'],
        communicationPatterns: [],
        behaviorRules: [],
        validationRules: []
      }
    });

    // Empathy mixin
    this.registerMixin('empathy-mixin', {
      defaultPersonalityTraits: [
        { name: 'empathetic', value: 0.9, description: 'High empathy and understanding', category: 'social' },
        { name: 'supportive', value: 0.8, description: 'Supportive and encouraging', category: 'social' }
      ],
      domainSpecific: {
        knowledgeBase: ['emotional-intelligence'],
        specializedTools: ['sentiment-analyzer'],
        communicationPatterns: [],
        behaviorRules: [],
        validationRules: []
      }
    });

    // Analytical mixin
    this.registerMixin('analytical-mixin', {
      defaultPersonalityTraits: [
        { name: 'analytical', value: 0.9, description: 'Strong analytical capabilities', category: 'analytical' },
        { name: 'logical', value: 0.8, description: 'Logical reasoning approach', category: 'analytical' }
      ],
      domainSpecific: {
        knowledgeBase: ['analytical-frameworks'],
        specializedTools: ['data-analyzer'],
        communicationPatterns: [],
        behaviorRules: [],
        validationRules: []
      }
    });

    // Creative mixin
    this.registerMixin('creative-mixin', {
      defaultPersonalityTraits: [
        { name: 'creative', value: 0.9, description: 'Highly creative and innovative', category: 'creative' },
        { name: 'imaginative', value: 0.8, description: 'Rich imagination and ideation', category: 'creative' }
      ],
      domainSpecific: {
        knowledgeBase: ['creative-techniques'],
        specializedTools: ['idea-generator'],
        communicationPatterns: [],
        behaviorRules: [],
        validationRules: []
      }
    });

    // Diagnostic mixin
    this.registerMixin('diagnostic-mixin', {
      defaultPersonalityTraits: [
        { name: 'diagnostic', value: 0.9, description: 'Excellent diagnostic skills', category: 'analytical' },
        { name: 'systematic', value: 0.8, description: 'Systematic problem-solving', category: 'methodical' }
      ],
      domainSpecific: {
        knowledgeBase: ['diagnostic-procedures'],
        specializedTools: ['diagnostic-toolkit'],
        communicationPatterns: [],
        behaviorRules: [],
        validationRules: []
      }
    });

    // Escalation mixin
    this.registerMixin('escalation-mixin', {
      domainSpecific: {
        knowledgeBase: ['escalation-protocols'],
        specializedTools: ['escalation-manager'],
        communicationPatterns: [],
        behaviorRules: [
          {
            name: 'auto-escalation',
            description: 'Automatic escalation for critical issues',
            condition: 'issue.severity === "critical"',
            action: 'trigger_escalation',
            priority: 1,
            active: true
          }
        ],
        validationRules: []
      }
    });

    // Visualization mixin
    this.registerMixin('visualization-mixin', {
      domainSpecific: {
        knowledgeBase: ['visualization-best-practices'],
        specializedTools: ['chart-generator', 'dashboard-builder'],
        communicationPatterns: [],
        behaviorRules: [],
        validationRules: []
      }
    });

    // Content mixin
    this.registerMixin('content-mixin', {
      defaultPersonalityTraits: [
        { name: 'articulate', value: 0.8, description: 'Clear and articulate communication', category: 'social' }
      ],
      domainSpecific: {
        knowledgeBase: ['content-guidelines', 'style-guides'],
        specializedTools: ['content-optimizer', 'style-checker'],
        communicationPatterns: [],
        behaviorRules: [],
        validationRules: []
      }
    });
  }

  /**
   * Register common presets for quick template configuration
   */
  private registerCommonPresets(): void {
    // Enterprise preset
    this.registerPreset('enterprise-standard', {
      name: 'Enterprise Standard',
      description: 'Standard configuration for enterprise environments',
      configuration: {
        responseStyle: 'formal',
        escalationThreshold: 0.7,
        enableAdvancedFeatures: true,
        securityLevel: 'high'
      },
      tags: ['enterprise', 'formal', 'secure']
    });

    // Startup preset
    this.registerPreset('startup-agile', {
      name: 'Startup Agile',
      description: 'Agile configuration for startup environments',
      configuration: {
        responseStyle: 'casual',
        escalationThreshold: 0.5,
        enableAdvancedFeatures: false,
        securityLevel: 'medium'
      },
      tags: ['startup', 'agile', 'flexible']
    });

    // Educational preset
    this.registerPreset('educational-friendly', {
      name: 'Educational Friendly',
      description: 'User-friendly configuration for educational contexts',
      configuration: {
        responseStyle: 'friendly',
        explanationLevel: 'detailed',
        enableAdvancedFeatures: false,
        userLevelAdjustment: true
      },
      tags: ['educational', 'friendly', 'detailed']
    });

    // High-performance preset
    this.registerPreset('high-performance', {
      name: 'High Performance',
      description: 'Optimized for high-performance environments',
      configuration: {
        responseStyle: 'efficient',
        escalationThreshold: 0.8,
        enableAdvancedFeatures: true,
        cachingEnabled: true
      },
      tags: ['performance', 'efficient', 'optimized']
    });
  }
}

/**
 * Template system events
 */
export interface TemplateSystemEvents {
  'template-registered': { templateId: string; template: DomainAgentTemplate };
  'mixin-registered': { name: string; mixin: Partial<DomainAgentTemplate> };
  'preset-registered': { name: string; preset: TemplatePreset };
  'template-used': { templateId: string; usageCount: number };
}

/**
 * Type the EventEmitter properly
 */
export interface AgentTemplateSystem {
  on<K extends keyof TemplateSystemEvents>(event: K, listener: (data: TemplateSystemEvents[K]) => void): this;
  emit<K extends keyof TemplateSystemEvents>(event: K, data: TemplateSystemEvents[K]): boolean;
}