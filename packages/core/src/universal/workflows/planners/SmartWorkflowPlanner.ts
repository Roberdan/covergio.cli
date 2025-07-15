/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  IWorkflowPlanner, 
  PlanningContext, 
  PlanningResult, 
  ValidationResult,
  ValidationError,
  PlannerCapabilities,
  PlanningConstraints
} from '../interfaces/IWorkflowPlanner.js';
import { WorkflowPlan, WorkflowStep, AgentInstance } from '../../types/common.js';

export class SmartWorkflowPlanner implements IWorkflowPlanner {
  private stepTemplates: Map<string, StepTemplate> = new Map();
  private domainStrategies: Map<string, PlanningStrategy> = new Map();
  private lastCalculatedConfidence: number = 0;

  constructor() {
    this.initializeTemplates();
    this.initializeStrategies();
  }

  async createPlan(context: PlanningContext): Promise<PlanningResult> {
    const { analysis, availableAgents, constraints } = context;
    
    // Select planning strategy based on complexity and domain
    const strategy = this.selectPlanningStrategy(analysis);
    
    // Generate initial plan
    const initialPlan = await strategy.generatePlan(context);
    
    // Apply constraints and optimizations
    const optimizedPlan = await this.optimizePlan(initialPlan, constraints);
    
    // Calculate confidence and cost
    const confidence = this.calculatePlanConfidence(optimizedPlan, availableAgents);
    this.lastCalculatedConfidence = confidence;
    const estimatedCost = this.estimatePlanCost(optimizedPlan, constraints.budget);
    
    // Generate alternative plans
    const alternatives = await this.generateAlternativePlans(context, optimizedPlan);
    
    // Collect warnings
    const warnings = this.generatePlanWarnings(optimizedPlan, constraints);

    return {
      plan: optimizedPlan,
      confidence,
      estimatedCost,
      alternatives,
      warnings,
    };
  }

  async optimizePlan(plan: WorkflowPlan, constraints: PlanningConstraints): Promise<WorkflowPlan> {
    let optimizedPlan = { ...plan };
    
    // Apply step consolidation
    optimizedPlan = this.consolidateSteps(optimizedPlan);
    
    // Apply parallel execution optimization
    optimizedPlan = this.optimizeParallelExecution(optimizedPlan);
    
    // Apply resource optimization
    optimizedPlan = this.optimizeResourceUsage(optimizedPlan, constraints);
    
    // Apply duration optimization
    optimizedPlan = this.optimizeDuration(optimizedPlan, constraints);
    
    return optimizedPlan;
  }

  async validatePlan(plan: WorkflowPlan, availableAgents: AgentInstance[]): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Validate step dependencies
    const dependencyErrors = this.validateDependencies(plan);
    errors.push(...dependencyErrors);

    // Validate agent availability
    const agentErrors = this.validateAgentAvailability(plan, availableAgents);
    errors.push(...agentErrors);

    // Validate step configurations
    const configErrors = this.validateStepConfigurations(plan);
    errors.push(...configErrors);

    // Generate warnings for potential issues
    warnings.push(...this.generateValidationWarnings(plan));

    // Generate optimization suggestions
    suggestions.push(...this.generateOptimizationSuggestions(plan));

    return {
      isValid: errors.filter(e => e.severity === 'error').length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  getCapabilities(): PlannerCapabilities {
    return {
      supportedComplexity: ['simple', 'medium', 'complex'],
      supportedDomains: [
        'code-generation',
        'documentation', 
        'testing',
        'data-analysis',
        'project-management',
        'infrastructure'
      ],
      maxStepsSupported: 50,
      supportsParallelExecution: true,
      supportsConditionalLogic: true,
      supportsRollback: true,
    };
  }

  private initializeTemplates(): void {
    // Code generation templates
    this.stepTemplates.set('code-generation', {
      id: 'code-generation',
      name: 'Code Generation',
      requiredCapabilities: ['text-generation', 'code-assistance'],
      estimatedDuration: 300000, // 5 minutes
      dependencies: [],
      parallel: false,
    });

    // Testing templates
    this.stepTemplates.set('testing', {
      id: 'testing',
      name: 'Testing',
      requiredCapabilities: ['code-assistance', 'quality-assurance'],
      estimatedDuration: 180000, // 3 minutes
      dependencies: ['code-generation'],
      parallel: false,
    });

    // Documentation templates
    this.stepTemplates.set('documentation', {
      id: 'documentation',
      name: 'Documentation',
      requiredCapabilities: ['text-generation', 'content-creation'],
      estimatedDuration: 240000, // 4 minutes
      dependencies: ['code-generation'],
      parallel: true,
    });
  }

  private initializeStrategies(): void {
    this.domainStrategies.set('code-generation', new CodeGenerationStrategy());
    this.domainStrategies.set('documentation', new DocumentationStrategy());
    this.domainStrategies.set('testing', new TestingStrategy());
    this.domainStrategies.set('general', new GeneralStrategy());
  }

  private selectPlanningStrategy(analysis: RequestAnalysis): PlanningStrategy {
    const primaryDomain = analysis.domains[0] || 'general';
    return this.domainStrategies.get(primaryDomain) || this.domainStrategies.get('general')!;
  }

  private calculatePlanConfidence(plan: WorkflowPlan, availableAgents: AgentInstance[]): number {
    let totalConfidence = 0;
    let validSteps = 0;

    for (const step of plan.steps) {
      const requiredCapabilities = step.configuration.requiredCapabilities || [];
      const availableForStep = availableAgents.filter(agent => 
        requiredCapabilities.every(cap => 
          agent.capabilities.some(agentCap => agentCap.name === cap)
        )
      );

      if (availableForStep.length > 0) {
        // Higher confidence with more available agents
        const confidence = Math.min(1, availableForStep.length / 3) * 0.8 + 0.2;
        totalConfidence += confidence;
        validSteps++;
      }
    }

    return validSteps > 0 ? totalConfidence / validSteps : 0;
  }

  private estimatePlanCost(plan: WorkflowPlan, budget?: { maxCost: number; costPerMinute: number }): number {
    if (!budget) return 0;
    
    const totalDurationMinutes = plan.estimatedTotalDuration / 60000;
    return totalDurationMinutes * budget.costPerMinute;
  }

  private async generateAlternativePlans(
    context: PlanningContext, 
    primaryPlan: WorkflowPlan
  ): Promise<WorkflowPlan[]> {
    const alternatives: WorkflowPlan[] = [];
    
    // Generate sequential alternative if primary is parallel
    if (this.hasParallelSteps(primaryPlan)) {
      const sequentialPlan = this.convertToSequential(primaryPlan);
      alternatives.push(sequentialPlan);
    }
    
    // Generate simplified alternative
    const simplifiedPlan = this.simplifyPlan(primaryPlan);
    if (simplifiedPlan.steps.length < primaryPlan.steps.length) {
      alternatives.push(simplifiedPlan);
    }
    
    return alternatives.slice(0, 3); // Return up to 3 alternatives
  }

  private generatePlanWarnings(plan: WorkflowPlan, constraints: PlanningConstraints): string[] {
    const warnings: string[] = [];
    
    if (plan.steps.length > constraints.maxSteps) {
      warnings.push(`Plan has ${plan.steps.length} steps, exceeding maximum of ${constraints.maxSteps}`);
    }
    
    if (plan.estimatedTotalDuration > constraints.maxDuration) {
      warnings.push(`Estimated duration ${plan.estimatedTotalDuration}ms exceeds maximum of ${constraints.maxDuration}ms`);
    }

    // Add warning when no agents are available
    if (this.lastCalculatedConfidence === 0) {
      warnings.push('No suitable agents available for plan execution');
    }
    
    return warnings;
  }

  private consolidateSteps(plan: WorkflowPlan): WorkflowPlan {
    const consolidatedSteps: WorkflowStep[] = [];
    const processed = new Set<string>();
    
    for (const step of plan.steps) {
      if (processed.has(step.id)) continue;
      
      // Find steps that can be consolidated with this one
      const similarSteps = plan.steps.filter(s => 
        !processed.has(s.id) && 
        this.canConsolidate(step, s)
      );
      
      if (similarSteps.length > 1) {
        const consolidatedStep = this.mergeSteps(similarSteps);
        consolidatedSteps.push(consolidatedStep);
        similarSteps.forEach(s => processed.add(s.id));
      } else {
        consolidatedSteps.push(step);
        processed.add(step.id);
      }
    }
    
    return {
      ...plan,
      steps: consolidatedSteps,
      estimatedTotalDuration: consolidatedSteps.reduce((sum, step) => sum + step.estimatedDuration, 0),
    };
  }

  private optimizeParallelExecution(plan: WorkflowPlan): WorkflowPlan {
    const optimizedSteps = [...plan.steps];
    
    // Find steps that can run in parallel
    for (let i = 0; i < optimizedSteps.length; i++) {
      const step = optimizedSteps[i];
      
      for (let j = i + 1; j < optimizedSteps.length; j++) {
        const laterStep = optimizedSteps[j];
        
        if (this.canRunInParallel(step, laterStep)) {
          laterStep.parallel = true;
        }
      }
    }
    
    return { ...plan, steps: optimizedSteps };
  }

  private optimizeResourceUsage(plan: WorkflowPlan, constraints: PlanningConstraints): WorkflowPlan {
    // Optimize agent assignments to minimize resource conflicts
    const optimizedSteps = plan.steps.map(step => ({
      ...step,
      configuration: {
        ...step.configuration,
        preferredAgentTypes: this.selectOptimalAgentTypes(step, constraints),
      },
    }));
    
    return { ...plan, steps: optimizedSteps };
  }

  private optimizeDuration(plan: WorkflowPlan, constraints: PlanningConstraints): WorkflowPlan {
    if (plan.estimatedTotalDuration <= constraints.maxDuration) {
      return plan;
    }
    
    // Try to reduce duration by parallelizing more steps
    const optimizedSteps = plan.steps.map(step => {
      if (!step.parallel && this.canBeParallelized(step, plan)) {
        return { ...step, parallel: true };
      }
      return step;
    });
    
    return {
      ...plan,
      steps: optimizedSteps,
      estimatedTotalDuration: this.calculateParallelDuration(optimizedSteps),
    };
  }

  private validateDependencies(plan: WorkflowPlan): ValidationError[] {
    const errors: ValidationError[] = [];
    const stepIds = new Set(plan.steps.map(s => s.id));
    
    for (const step of plan.steps) {
      for (const depId of step.dependencies) {
        if (!stepIds.has(depId)) {
          errors.push({
            stepId: step.id,
            message: `Dependency '${depId}' not found in workflow`,
            severity: 'error',
            fixSuggestion: `Remove dependency or add step with id '${depId}'`,
          });
        }
      }
    }
    
    return errors;
  }

  private validateAgentAvailability(plan: WorkflowPlan, availableAgents: AgentInstance[]): ValidationError[] {
    const errors: ValidationError[] = [];
    
    for (const step of plan.steps) {
      const requiredCapabilities = step.configuration.requiredCapabilities || [];
      const availableForStep = availableAgents.filter(agent => 
        requiredCapabilities.every(cap => 
          agent.capabilities.some(agentCap => agentCap.name === cap)
        )
      );
      
      if (availableForStep.length === 0) {
        errors.push({
          stepId: step.id,
          message: `No agents available with required capabilities: ${requiredCapabilities.join(', ')}`,
          severity: 'error',
          fixSuggestion: 'Add agents with required capabilities or modify step requirements',
        });
      }
    }
    
    return errors;
  }

  private validateStepConfigurations(plan: WorkflowPlan): ValidationError[] {
    const errors: ValidationError[] = [];
    
    for (const step of plan.steps) {
      if (!step.configuration.action) {
        errors.push({
          stepId: step.id,
          message: 'Step configuration missing required action',
          severity: 'error',
          fixSuggestion: 'Add action to step configuration',
        });
      }
      
      if (step.estimatedDuration <= 0) {
        errors.push({
          stepId: step.id,
          message: 'Step has invalid estimated duration',
          severity: 'warning',
          fixSuggestion: 'Set positive estimated duration',
        });
      }
    }
    
    return errors;
  }

  private generateValidationWarnings(plan: WorkflowPlan): string[] {
    const warnings: string[] = [];
    
    if (plan.steps.length > 20) {
      warnings.push('Workflow has many steps, consider breaking into smaller workflows');
    }
    
    const longSteps = plan.steps.filter(s => s.estimatedDuration > 600000); // > 10 minutes
    if (longSteps.length > 0) {
      warnings.push(`${longSteps.length} steps have long estimated duration`);
    }
    
    return warnings;
  }

  private generateOptimizationSuggestions(plan: WorkflowPlan): string[] {
    const suggestions: string[] = [];
    
    const parallelizableSteps = plan.steps.filter(s => !s.parallel && this.canBeParallelized(s, plan));
    if (parallelizableSteps.length > 0) {
      suggestions.push(`${parallelizableSteps.length} steps could be parallelized for better performance`);
    }
    
    return suggestions;
  }

  // Helper methods
  private hasParallelSteps(plan: WorkflowPlan): boolean {
    return plan.steps.some(step => step.parallel);
  }

  private convertToSequential(plan: WorkflowPlan): WorkflowPlan {
    const sequentialSteps = plan.steps.map(step => ({ ...step, parallel: false }));
    return {
      ...plan,
      id: `${plan.id}-sequential`,
      name: `${plan.name} (Sequential)`,
      steps: sequentialSteps,
      estimatedTotalDuration: sequentialSteps.reduce((sum, step) => sum + step.estimatedDuration, 0),
    };
  }

  private simplifyPlan(plan: WorkflowPlan): WorkflowPlan {
    // Remove optional steps and combine similar ones
    const essentialSteps = plan.steps.filter(step => 
      !step.configuration.optional
    );
    
    return {
      ...plan,
      id: `${plan.id}-simplified`,
      name: `${plan.name} (Simplified)`,
      steps: essentialSteps,
      estimatedTotalDuration: essentialSteps.reduce((sum, step) => sum + step.estimatedDuration, 0),
    };
  }

  private canConsolidate(step1: WorkflowStep, step2: WorkflowStep): boolean {
    return step1.type === step2.type && 
           JSON.stringify(step1.configuration.requiredCapabilities) === 
           JSON.stringify(step2.configuration.requiredCapabilities);
  }

  private mergeSteps(steps: WorkflowStep[]): WorkflowStep {
    const firstStep = steps[0];
    return {
      ...firstStep,
      id: `${firstStep.id}-consolidated`,
      name: `${firstStep.name} (Consolidated)`,
      estimatedDuration: Math.max(...steps.map(s => s.estimatedDuration)),
      configuration: {
        ...firstStep.configuration,
        actions: steps.map(s => s.configuration.action).filter(Boolean),
      },
    };
  }

  private canRunInParallel(step1: WorkflowStep, step2: WorkflowStep): boolean {
    return !step2.dependencies.includes(step1.id) &&
           !step1.dependencies.includes(step2.id);
  }

  private selectOptimalAgentTypes(step: WorkflowStep, constraints: PlanningConstraints): string[] {
    const requiredCapabilities = step.configuration.requiredCapabilities || [];
    return constraints.allowedAgentTypes.filter(type => 
      requiredCapabilities.some(cap => this.agentTypeHasCapability(type, cap))
    );
  }

  private canBeParallelized(step: WorkflowStep, plan: WorkflowPlan): boolean {
    // Check if step has no dependencies or all dependencies can run in parallel
    return step.dependencies.length === 0 || 
           step.dependencies.every(depId => {
             const depStep = plan.steps.find(s => s.id === depId);
             return depStep?.parallel || false;
           });
  }

  private calculateParallelDuration(steps: WorkflowStep[]): number {
    const sequentialSteps = steps.filter(s => !s.parallel);
    const parallelSteps = steps.filter(s => s.parallel);
    
    const sequentialDuration = sequentialSteps.reduce((sum, step) => sum + step.estimatedDuration, 0);
    const maxParallelDuration = Math.max(...parallelSteps.map(s => s.estimatedDuration), 0);
    
    return sequentialDuration + maxParallelDuration;
  }

  private agentTypeHasCapability(agentType: string, capability: string): boolean {
    // This would normally query agent type definitions
    const agentCapabilities: Record<string, string[]> = {
      'gemini': ['text-generation', 'analysis', 'code-assistance'],
      'task-master': ['task-analysis', 'project-management'],
      'analysis': ['data-processing', 'analysis'],
    };
    
    return agentCapabilities[agentType]?.includes(capability) || false;
  }
}

// Strategy interfaces and implementations
interface StepTemplate {
  id: string;
  name: string;
  requiredCapabilities: string[];
  estimatedDuration: number;
  dependencies: string[];
  parallel: boolean;
}

interface PlanningStrategy {
  generatePlan(context: PlanningContext): Promise<WorkflowPlan>;
}

class CodeGenerationStrategy implements PlanningStrategy {
  async generatePlan(context: PlanningContext): Promise<WorkflowPlan> {
    const { request, analysis } = context;
    const steps: WorkflowStep[] = [];
    
    // Add analysis step
    steps.push({
      id: 'analyze-requirements',
      name: 'Analyze Requirements',
      type: 'analysis',
      description: 'Analyze code generation requirements',
      estimatedDuration: 60000,
      dependencies: [],
      parallel: false,
      configuration: {
        action: 'analyze',
        requiredCapabilities: ['analysis'],
        parameters: { input: request.userInput },
      },
    });
    
    // Add code generation step
    steps.push({
      id: 'generate-code',
      name: 'Generate Code',
      type: 'generation',
      description: 'Generate the requested code',
      estimatedDuration: 300000,
      dependencies: ['analyze-requirements'],
      parallel: false,
      configuration: {
        action: 'generate',
        requiredCapabilities: ['text-generation', 'code-assistance'],
        parameters: { type: 'code', complexity: analysis.complexity },
      },
    });
    
    // Add testing step (parallel)
    steps.push({
      id: 'generate-tests',
      name: 'Generate Tests',
      type: 'testing',
      description: 'Generate unit tests for the code',
      estimatedDuration: 180000,
      dependencies: ['generate-code'],
      parallel: true,
      configuration: {
        action: 'test',
        requiredCapabilities: ['code-assistance', 'quality-assurance'],
        optional: true,
      },
    });
    
    return {
      id: `workflow-${Date.now()}`,
      name: 'Code Generation Workflow',
      description: `Generate ${analysis.intent}`,
      steps,
      estimatedTotalDuration: 360000, // 6 minutes (parallel execution)
      priority: analysis.priority,
      metadata: {
        strategy: 'code-generation',
        complexity: analysis.complexity,
        domains: analysis.domains,
      },
    };
  }
}

class DocumentationStrategy implements PlanningStrategy {
  async generatePlan(context: PlanningContext): Promise<WorkflowPlan> {
    const { request, analysis } = context;
    const steps: WorkflowStep[] = [];
    
    steps.push({
      id: 'analyze-content',
      name: 'Analyze Content',
      type: 'analysis',
      description: 'Analyze documentation requirements',
      estimatedDuration: 45000,
      dependencies: [],
      parallel: false,
      configuration: {
        action: 'analyze',
        requiredCapabilities: ['analysis'],
        parameters: { input: request.userInput },
      },
    });
    
    steps.push({
      id: 'create-documentation',
      name: 'Create Documentation',
      type: 'generation',
      description: 'Generate documentation content',
      estimatedDuration: 240000,
      dependencies: ['analyze-content'],
      parallel: false,
      configuration: {
        action: 'generate',
        requiredCapabilities: ['text-generation', 'content-creation'],
        parameters: { type: 'documentation', format: 'markdown' },
      },
    });
    
    return {
      id: `workflow-${Date.now()}`,
      name: 'Documentation Workflow',
      description: `Create documentation for ${analysis.intent}`,
      steps,
      estimatedTotalDuration: 285000,
      priority: analysis.priority,
      metadata: {
        strategy: 'documentation',
        complexity: analysis.complexity,
      },
    };
  }
}

class TestingStrategy implements PlanningStrategy {
  async generatePlan(context: PlanningContext): Promise<WorkflowPlan> {
    const { request, analysis } = context;
    const steps: WorkflowStep[] = [];
    
    steps.push({
      id: 'analyze-test-requirements',
      name: 'Analyze Test Requirements',
      type: 'analysis',
      description: 'Analyze testing requirements',
      estimatedDuration: 60000,
      dependencies: [],
      parallel: false,
      configuration: {
        action: 'analyze',
        requiredCapabilities: ['analysis', 'quality-assurance'],
        parameters: { input: request.userInput },
      },
    });
    
    steps.push({
      id: 'create-test-plan',
      name: 'Create Test Plan',
      type: 'planning',
      description: 'Create comprehensive test plan',
      estimatedDuration: 120000,
      dependencies: ['analyze-test-requirements'],
      parallel: false,
      configuration: {
        action: 'plan',
        requiredCapabilities: ['quality-assurance', 'project-management'],
      },
    });
    
    steps.push({
      id: 'generate-tests',
      name: 'Generate Tests',
      type: 'testing',
      description: 'Generate test code',
      estimatedDuration: 200000,
      dependencies: ['create-test-plan'],
      parallel: false,
      configuration: {
        action: 'generate',
        requiredCapabilities: ['code-assistance', 'quality-assurance'],
        parameters: { type: 'tests' },
      },
    });
    
    return {
      id: `workflow-${Date.now()}`,
      name: 'Testing Workflow',
      description: `Create tests for ${analysis.intent}`,
      steps,
      estimatedTotalDuration: 380000,
      priority: analysis.priority,
      metadata: {
        strategy: 'testing',
        complexity: analysis.complexity,
      },
    };
  }
}

class GeneralStrategy implements PlanningStrategy {
  async generatePlan(context: PlanningContext): Promise<WorkflowPlan> {
    const { request, analysis } = context;
    
    return {
      id: `workflow-${Date.now()}`,
      name: 'General Workflow',
      description: `Handle ${analysis.intent}`,
      steps: [{
        id: 'general-task',
        name: 'Handle Request',
        type: 'general',
        description: 'Process the general request',
        estimatedDuration: analysis.estimatedDuration,
        dependencies: [],
        parallel: false,
        configuration: {
          action: 'handle',
          requiredCapabilities: analysis.requiredCapabilities,
          parameters: { input: request.userInput },
        },
      }],
      estimatedTotalDuration: analysis.estimatedDuration,
      priority: analysis.priority,
      metadata: {
        strategy: 'general',
        complexity: analysis.complexity,
      },
    };
  }
}