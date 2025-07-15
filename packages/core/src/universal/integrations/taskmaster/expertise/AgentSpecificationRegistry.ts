/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import {
  AgentSpecification,
  Capability,
  PersonalityTrait,
  ToolDefinition,
  CapabilityCategory,
  ExpertiseLevel,
  ImportanceLevel
} from './types.js';

/**
 * Registry for managing agent specifications and capabilities
 */
export class AgentSpecificationRegistry extends EventEmitter {
  private specifications = new Map<string, AgentSpecification>();
  private capabilityIndex = new Map<string, Set<string>>(); // capability -> specification IDs
  private domainIndex = new Map<string, Set<string>>(); // domain -> specification IDs
  private roleIndex = new Map<string, Set<string>>(); // role -> specification IDs

  constructor() {
    super();
    this.initializeDefaultSpecifications();
  }

  /**
   * Register a new agent specification
   */
  register(specification: AgentSpecification): void {
    this.validateSpecification(specification);
    
    // Remove existing specification if updating
    if (this.specifications.has(specification.id)) {
      this.unregister(specification.id);
    }

    // Store the specification
    this.specifications.set(specification.id, specification);

    // Update indexes
    this.updateIndexes(specification);

    this.emit('specification-registered', { specification });
  }

  /**
   * Unregister an agent specification
   */
  unregister(id: string): boolean {
    const specification = this.specifications.get(id);
    if (!specification) {
      return false;
    }

    // Remove from indexes
    this.removeFromIndexes(specification);

    // Remove the specification
    this.specifications.delete(id);

    this.emit('specification-unregistered', { id });
    return true;
  }

  /**
   * Get a specific agent specification
   */
  get(id: string): AgentSpecification | undefined {
    return this.specifications.get(id);
  }

  /**
   * Get all agent specifications
   */
  getAll(): AgentSpecification[] {
    return Array.from(this.specifications.values());
  }

  /**
   * Find specifications by capability
   */
  findByCapability(capabilityId: string): AgentSpecification[] {
    const specIds = this.capabilityIndex.get(capabilityId) || new Set();
    return Array.from(specIds)
      .map(id => this.specifications.get(id))
      .filter((spec): spec is AgentSpecification => spec !== undefined);
  }

  /**
   * Find specifications by domain
   */
  findByDomain(domain: string): AgentSpecification[] {
    const specIds = this.domainIndex.get(domain) || new Set();
    return Array.from(specIds)
      .map(id => this.specifications.get(id))
      .filter((spec): spec is AgentSpecification => spec !== undefined);
  }

  /**
   * Find specifications by role
   */
  findByRole(role: string): AgentSpecification[] {
    const specIds = this.roleIndex.get(role) || new Set();
    return Array.from(specIds)
      .map(id => this.specifications.get(id))
      .filter((spec): spec is AgentSpecification => spec !== undefined);
  }

  /**
   * Find specifications by multiple criteria
   */
  findByCriteria(criteria: {
    capabilities?: string[];
    domains?: string[];
    roles?: string[];
    minConfidence?: number;
  }): AgentSpecification[] {
    let candidates = this.getAll();

    // Filter by capabilities
    if (criteria.capabilities && criteria.capabilities.length > 0) {
      candidates = candidates.filter(spec =>
        criteria.capabilities!.some(capId =>
          spec.capabilities.some(cap => cap.id === capId)
        )
      );
    }

    // Filter by domains
    if (criteria.domains && criteria.domains.length > 0) {
      candidates = candidates.filter(spec =>
        criteria.domains!.includes(spec.domain)
      );
    }

    // Filter by roles
    if (criteria.roles && criteria.roles.length > 0) {
      candidates = candidates.filter(spec =>
        criteria.roles!.includes(spec.role)
      );
    }

    // Filter by confidence
    if (criteria.minConfidence !== undefined) {
      candidates = candidates.filter(spec =>
        spec.confidence >= criteria.minConfidence!
      );
    }

    return candidates;
  }

  /**
   * Search specifications by text query
   */
  search(query: string): AgentSpecification[] {
    const lowercaseQuery = query.toLowerCase();
    
    return this.getAll().filter(spec => {
      // Search in basic fields
      if (spec.domain.toLowerCase().includes(lowercaseQuery) ||
          spec.role.toLowerCase().includes(lowercaseQuery)) {
        return true;
      }

      // Search in capabilities
      if (spec.capabilities.some(cap => 
        cap.name.toLowerCase().includes(lowercaseQuery) ||
        cap.description.toLowerCase().includes(lowercaseQuery) ||
        cap.keywords.some(keyword => keyword.includes(lowercaseQuery))
      )) {
        return true;
      }

      // Search in tools
      if (spec.tools.some(tool =>
        tool.name.toLowerCase().includes(lowercaseQuery) ||
        tool.description.toLowerCase().includes(lowercaseQuery)
      )) {
        return true;
      }

      // Search in metadata tags
      if (spec.metadata.tags.some(tag =>
        tag.toLowerCase().includes(lowercaseQuery)
      )) {
        return true;
      }

      return false;
    });
  }

  /**
   * Get all unique capabilities across all specifications
   */
  getAllCapabilities(): Capability[] {
    const capabilityMap = new Map<string, Capability>();
    
    this.getAll().forEach(spec => {
      spec.capabilities.forEach(cap => {
        if (!capabilityMap.has(cap.id)) {
          capabilityMap.set(cap.id, cap);
        }
      });
    });

    return Array.from(capabilityMap.values());
  }

  /**
   * Get all unique domains
   */
  getAllDomains(): string[] {
    const domains = new Set<string>();
    this.getAll().forEach(spec => domains.add(spec.domain));
    return Array.from(domains).sort();
  }

  /**
   * Get all unique roles
   */
  getAllRoles(): string[] {
    const roles = new Set<string>();
    this.getAll().forEach(spec => roles.add(spec.role));
    return Array.from(roles).sort();
  }

  /**
   * Get statistics about the registry
   */
  getStats() {
    const specifications = this.getAll();
    const capabilities = this.getAllCapabilities();
    const domains = this.getAllDomains();
    const roles = this.getAllRoles();

    return {
      totalSpecifications: specifications.length,
      totalCapabilities: capabilities.length,
      totalDomains: domains.length,
      totalRoles: roles.length,
      averageCapabilitiesPerSpec: capabilities.length / Math.max(1, specifications.length),
      averageConfidence: specifications.reduce((sum, spec) => sum + spec.confidence, 0) / Math.max(1, specifications.length),
      capabilityDistribution: this.getCapabilityDistribution(),
      domainDistribution: this.getDomainDistribution()
    };
  }

  /**
   * Validate an agent specification
   */
  private validateSpecification(specification: AgentSpecification): void {
    if (!specification.id || specification.id.trim().length === 0) {
      throw new Error('Agent specification must have a valid ID');
    }

    if (!specification.domain || specification.domain.trim().length === 0) {
      throw new Error('Agent specification must have a valid domain');
    }

    if (!specification.role || specification.role.trim().length === 0) {
      throw new Error('Agent specification must have a valid role');
    }

    if (!Array.isArray(specification.capabilities) || specification.capabilities.length === 0) {
      throw new Error('Agent specification must have at least one capability');
    }

    if (specification.confidence < 0 || specification.confidence > 1) {
      throw new Error('Agent specification confidence must be between 0 and 1');
    }

    // Validate capabilities
    specification.capabilities.forEach((capability, index) => {
      if (!capability.id || capability.id.trim().length === 0) {
        throw new Error(`Capability at index ${index} must have a valid ID`);
      }
      if (!capability.name || capability.name.trim().length === 0) {
        throw new Error(`Capability at index ${index} must have a valid name`);
      }
    });

    // Validate tools
    specification.tools.forEach((tool, index) => {
      if (!tool.id || tool.id.trim().length === 0) {
        throw new Error(`Tool at index ${index} must have a valid ID`);
      }
      if (!tool.name || tool.name.trim().length === 0) {
        throw new Error(`Tool at index ${index} must have a valid name`);
      }
    });
  }

  /**
   * Update indexes when adding a specification
   */
  private updateIndexes(specification: AgentSpecification): void {
    const specId = specification.id;

    // Update capability index
    specification.capabilities.forEach(capability => {
      if (!this.capabilityIndex.has(capability.id)) {
        this.capabilityIndex.set(capability.id, new Set());
      }
      this.capabilityIndex.get(capability.id)!.add(specId);
    });

    // Update domain index
    if (!this.domainIndex.has(specification.domain)) {
      this.domainIndex.set(specification.domain, new Set());
    }
    this.domainIndex.get(specification.domain)!.add(specId);

    // Update role index
    if (!this.roleIndex.has(specification.role)) {
      this.roleIndex.set(specification.role, new Set());
    }
    this.roleIndex.get(specification.role)!.add(specId);
  }

  /**
   * Remove from indexes when removing a specification
   */
  private removeFromIndexes(specification: AgentSpecification): void {
    const specId = specification.id;

    // Remove from capability index
    specification.capabilities.forEach(capability => {
      const capSet = this.capabilityIndex.get(capability.id);
      if (capSet) {
        capSet.delete(specId);
        if (capSet.size === 0) {
          this.capabilityIndex.delete(capability.id);
        }
      }
    });

    // Remove from domain index
    const domainSet = this.domainIndex.get(specification.domain);
    if (domainSet) {
      domainSet.delete(specId);
      if (domainSet.size === 0) {
        this.domainIndex.delete(specification.domain);
      }
    }

    // Remove from role index
    const roleSet = this.roleIndex.get(specification.role);
    if (roleSet) {
      roleSet.delete(specId);
      if (roleSet.size === 0) {
        this.roleIndex.delete(specification.role);
      }
    }
  }

  /**
   * Get capability distribution
   */
  private getCapabilityDistribution(): Record<CapabilityCategory, number> {
    const distribution: Record<CapabilityCategory, number> = {
      'technical': 0,
      'creative': 0,
      'analytical': 0,
      'communication': 0,
      'domain-specific': 0,
      'tool-usage': 0,
      'problem-solving': 0,
      'project-management': 0
    };

    this.getAllCapabilities().forEach(capability => {
      distribution[capability.category]++;
    });

    return distribution;
  }

  /**
   * Get domain distribution
   */
  private getDomainDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {};

    this.getAll().forEach(spec => {
      distribution[spec.domain] = (distribution[spec.domain] || 0) + 1;
    });

    return distribution;
  }

  /**
   * Initialize default agent specifications
   */
  private initializeDefaultSpecifications(): void {
    const defaultSpecs: AgentSpecification[] = [
      this.createWebDeveloperSpec(),
      this.createBackendDeveloperSpec(),
      this.createDataAnalystSpec(),
      this.createDevOpsEngineerSpec(),
      this.createUIUXDesignerSpec(),
      this.createProjectManagerSpec()
    ];

    defaultSpecs.forEach(spec => this.register(spec));
  }

  /**
   * Create web developer specification
   */
  private createWebDeveloperSpec(): AgentSpecification {
    return {
      id: 'web-developer',
      domain: 'web-development',
      role: 'Frontend Developer',
      capabilities: [
        {
          id: 'react-development',
          name: 'React Development',
          category: 'technical',
          level: 'advanced',
          importance: 'critical',
          keywords: ['react', 'jsx', 'hooks', 'components'],
          description: 'Building modern React applications with hooks and components'
        },
        {
          id: 'typescript',
          name: 'TypeScript',
          category: 'technical',
          level: 'advanced',
          importance: 'high',
          keywords: ['typescript', 'types', 'interfaces'],
          description: 'Strong typing and modern JavaScript development'
        },
        {
          id: 'css-styling',
          name: 'CSS and Styling',
          category: 'creative',
          level: 'advanced',
          importance: 'high',
          keywords: ['css', 'sass', 'tailwind', 'styling'],
          description: 'Modern CSS techniques and styling frameworks'
        }
      ],
      personalityTraits: [
        {
          name: 'detail-oriented',
          strength: 0.9,
          description: 'Pays close attention to UI details and user experience',
          category: 'methodical'
        },
        {
          name: 'creative',
          strength: 0.7,
          description: 'Enjoys creating visually appealing interfaces',
          category: 'creative'
        }
      ],
      tools: [
        {
          id: 'react-tools',
          name: 'React Development Tools',
          description: 'React DevTools, Create React App, Vite',
          category: 'generation',
          parameters: [],
          accessLevel: 'public'
        },
        {
          id: 'bundling-tools',
          name: 'Bundling Tools',
          description: 'Webpack, Vite, Parcel for building applications',
          category: 'data-processing',
          parameters: [],
          accessLevel: 'public'
        }
      ],
      confidence: 0.85,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0.0',
        tags: ['frontend', 'react', 'web', 'ui'],
        author: 'system'
      }
    };
  }

  /**
   * Create backend developer specification
   */
  private createBackendDeveloperSpec(): AgentSpecification {
    return {
      id: 'backend-developer',
      domain: 'backend-development',
      role: 'Backend Developer',
      capabilities: [
        {
          id: 'api-development',
          name: 'API Development',
          category: 'technical',
          level: 'advanced',
          importance: 'critical',
          keywords: ['api', 'rest', 'graphql', 'endpoints'],
          description: 'Building robust APIs and web services'
        },
        {
          id: 'database-design',
          name: 'Database Design',
          category: 'technical',
          level: 'advanced',
          importance: 'high',
          keywords: ['database', 'sql', 'nosql', 'schema'],
          description: 'Database design and optimization'
        },
        {
          id: 'nodejs',
          name: 'Node.js Development',
          category: 'technical',
          level: 'advanced',
          importance: 'high',
          keywords: ['nodejs', 'express', 'server'],
          description: 'Server-side JavaScript development'
        }
      ],
      personalityTraits: [
        {
          name: 'analytical',
          strength: 0.8,
          description: 'Approaches problems systematically',
          category: 'analytical'
        },
        {
          name: 'methodical',
          strength: 0.9,
          description: 'Follows best practices and coding standards',
          category: 'methodical'
        }
      ],
      tools: [
        {
          id: 'nodejs-tools',
          name: 'Node.js Tools',
          description: 'Express, Fastify, NestJS frameworks',
          category: 'generation',
          parameters: [],
          accessLevel: 'public'
        },
        {
          id: 'database-tools',
          name: 'Database Tools',
          description: 'PostgreSQL, MongoDB, Redis clients',
          category: 'data-processing',
          parameters: [],
          accessLevel: 'public'
        }
      ],
      confidence: 0.88,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0.0',
        tags: ['backend', 'api', 'server', 'database'],
        author: 'system'
      }
    };
  }

  /**
   * Create data analyst specification
   */
  private createDataAnalystSpec(): AgentSpecification {
    return {
      id: 'data-analyst',
      domain: 'data-science',
      role: 'Data Analyst',
      capabilities: [
        {
          id: 'data-analysis',
          name: 'Data Analysis',
          category: 'analytical',
          level: 'expert',
          importance: 'critical',
          keywords: ['analysis', 'statistics', 'insights'],
          description: 'Statistical analysis and data interpretation'
        },
        {
          id: 'python-programming',
          name: 'Python Programming',
          category: 'technical',
          level: 'advanced',
          importance: 'high',
          keywords: ['python', 'pandas', 'numpy'],
          description: 'Python for data science and analysis'
        },
        {
          id: 'data-visualization',
          name: 'Data Visualization',
          category: 'creative',
          level: 'advanced',
          importance: 'high',
          keywords: ['visualization', 'charts', 'graphs'],
          description: 'Creating meaningful data visualizations'
        }
      ],
      personalityTraits: [
        {
          name: 'analytical',
          strength: 0.95,
          description: 'Excels at finding patterns in data',
          category: 'analytical'
        },
        {
          name: 'curious',
          strength: 0.8,
          description: 'Naturally curious about data insights',
          category: 'adaptive'
        }
      ],
      tools: [
        {
          id: 'python-data-tools',
          name: 'Python Data Tools',
          description: 'Pandas, NumPy, SciPy, Matplotlib',
          category: 'analysis',
          parameters: [],
          accessLevel: 'public'
        },
        {
          id: 'visualization-tools',
          name: 'Visualization Tools',
          description: 'Plotly, Seaborn, D3.js for charts',
          category: 'visualization',
          parameters: [],
          accessLevel: 'public'
        }
      ],
      confidence: 0.82,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0.0',
        tags: ['data', 'analysis', 'python', 'visualization'],
        author: 'system'
      }
    };
  }

  /**
   * Create DevOps engineer specification
   */
  private createDevOpsEngineerSpec(): AgentSpecification {
    return {
      id: 'devops-engineer',
      domain: 'devops',
      role: 'DevOps Engineer',
      capabilities: [
        {
          id: 'container-orchestration',
          name: 'Container Orchestration',
          category: 'technical',
          level: 'expert',
          importance: 'critical',
          keywords: ['docker', 'kubernetes', 'containers'],
          description: 'Docker and Kubernetes expertise'
        },
        {
          id: 'ci-cd',
          name: 'CI/CD Pipelines',
          category: 'technical',
          level: 'advanced',
          importance: 'high',
          keywords: ['cicd', 'pipeline', 'automation'],
          description: 'Continuous integration and deployment'
        },
        {
          id: 'cloud-platforms',
          name: 'Cloud Platforms',
          category: 'technical',
          level: 'advanced',
          importance: 'high',
          keywords: ['aws', 'azure', 'gcp', 'cloud'],
          description: 'Multi-cloud platform expertise'
        }
      ],
      personalityTraits: [
        {
          name: 'systematic',
          strength: 0.9,
          description: 'Approaches infrastructure systematically',
          category: 'methodical'
        },
        {
          name: 'reliability-focused',
          strength: 0.95,
          description: 'Prioritizes system reliability and uptime',
          category: 'methodical'
        }
      ],
      tools: [
        {
          id: 'orchestration-tools',
          name: 'Orchestration Tools',
          description: 'Kubernetes, Docker Swarm, Helm',
          category: 'deployment',
          parameters: [],
          accessLevel: 'restricted'
        },
        {
          id: 'monitoring-tools',
          name: 'Monitoring Tools',
          description: 'Prometheus, Grafana, ELK Stack',
          category: 'analysis',
          parameters: [],
          accessLevel: 'restricted'
        }
      ],
      confidence: 0.87,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0.0',
        tags: ['devops', 'kubernetes', 'docker', 'cloud'],
        author: 'system'
      }
    };
  }

  /**
   * Create UI/UX designer specification
   */
  private createUIUXDesignerSpec(): AgentSpecification {
    return {
      id: 'ui-ux-designer',
      domain: 'design',
      role: 'UI/UX Designer',
      capabilities: [
        {
          id: 'user-experience-design',
          name: 'User Experience Design',
          category: 'creative',
          level: 'expert',
          importance: 'critical',
          keywords: ['ux', 'user-experience', 'usability'],
          description: 'Creating intuitive user experiences'
        },
        {
          id: 'visual-design',
          name: 'Visual Design',
          category: 'creative',
          level: 'advanced',
          importance: 'high',
          keywords: ['ui', 'visual', 'interface'],
          description: 'Creating visually appealing interfaces'
        },
        {
          id: 'prototyping',
          name: 'Prototyping',
          category: 'creative',
          level: 'advanced',
          importance: 'high',
          keywords: ['prototype', 'wireframe', 'mockup'],
          description: 'Creating interactive prototypes'
        }
      ],
      personalityTraits: [
        {
          name: 'creative',
          strength: 0.95,
          description: 'Highly creative and innovative',
          category: 'creative'
        },
        {
          name: 'empathetic',
          strength: 0.8,
          description: 'Understanding user needs and pain points',
          category: 'social'
        }
      ],
      tools: [
        {
          id: 'design-tools',
          name: 'Design Tools',
          description: 'Figma, Sketch, Adobe XD',
          category: 'generation',
          parameters: [],
          accessLevel: 'public'
        },
        {
          id: 'prototyping-tools',
          name: 'Prototyping Tools',
          description: 'InVision, Principle, Framer',
          category: 'generation',
          parameters: [],
          accessLevel: 'public'
        }
      ],
      confidence: 0.83,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0.0',
        tags: ['design', 'ux', 'ui', 'prototyping'],
        author: 'system'
      }
    };
  }

  /**
   * Create project manager specification
   */
  private createProjectManagerSpec(): AgentSpecification {
    return {
      id: 'project-manager',
      domain: 'project-management',
      role: 'Project Manager',
      capabilities: [
        {
          id: 'project-planning',
          name: 'Project Planning',
          category: 'project-management',
          level: 'expert',
          importance: 'critical',
          keywords: ['planning', 'roadmap', 'timeline'],
          description: 'Strategic project planning and roadmapping'
        },
        {
          id: 'team-coordination',
          name: 'Team Coordination',
          category: 'communication',
          level: 'advanced',
          importance: 'high',
          keywords: ['coordination', 'collaboration', 'team'],
          description: 'Coordinating cross-functional teams'
        },
        {
          id: 'risk-management',
          name: 'Risk Management',
          category: 'analytical',
          level: 'advanced',
          importance: 'high',
          keywords: ['risk', 'mitigation', 'planning'],
          description: 'Identifying and mitigating project risks'
        }
      ],
      personalityTraits: [
        {
          name: 'organized',
          strength: 0.95,
          description: 'Highly organized and detail-oriented',
          category: 'methodical'
        },
        {
          name: 'communicative',
          strength: 0.9,
          description: 'Excellent communication skills',
          category: 'social'
        }
      ],
      tools: [
        {
          id: 'project-management-tools',
          name: 'Project Management Tools',
          description: 'Jira, Asana, Monday.com',
          category: 'communication',
          parameters: [],
          accessLevel: 'public'
        },
        {
          id: 'collaboration-tools',
          name: 'Collaboration Tools',
          description: 'Slack, Microsoft Teams, Zoom',
          category: 'communication',
          parameters: [],
          accessLevel: 'public'
        }
      ],
      confidence: 0.80,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0.0',
        tags: ['project-management', 'coordination', 'planning'],
        author: 'system'
      }
    };
  }
}