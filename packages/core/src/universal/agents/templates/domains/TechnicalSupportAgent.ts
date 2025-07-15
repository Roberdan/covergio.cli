/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseAgent } from '../../BaseAgent.js';
import { 
  AgentConfig, 
  AgentRequest, 
  AgentResponse, 
  PersonalityTrait 
} from '../../types.js';
import { DomainAgentTemplate } from '../AgentTemplateSystem.js';

/**
 * Technical support specific request types
 */
export interface TechnicalSupportRequest extends AgentRequest {
  issueCategory: 'software' | 'hardware' | 'network' | 'security' | 'performance' | 'integration' | 'deployment';
  severity: 'low' | 'medium' | 'high' | 'critical';
  systemInfo?: {
    os: string;
    version: string;
    browser?: string;
    device_type: 'desktop' | 'mobile' | 'tablet' | 'server';
    environment: 'production' | 'staging' | 'development' | 'testing';
  };
  errorDetails?: {
    error_code?: string;
    error_message?: string;
    stack_trace?: string;
    log_files?: string[];
    reproduction_steps?: string[];
  };
  userLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  urgency: boolean;
  previousAttempts?: string[];
}

/**
 * Technical support response types
 */
export interface TechnicalSupportResponse extends AgentResponse {
  solution: {
    primary_solution: string;
    step_by_step_instructions: string[];
    alternative_solutions: string[];
    prevention_measures: string[];
  };
  diagnostics: {
    root_cause_analysis: string;
    diagnostic_steps_performed: string[];
    system_health_check: string;
    performance_impact: string;
  };
  escalation: {
    requires_escalation: boolean;
    escalation_reason?: string;
    specialist_type?: string;
    estimated_resolution_time?: string;
  };
  followUp: {
    verification_steps: string[];
    monitoring_recommendations: string[];
    next_check_in: string;
    related_resources: string[];
  };
}

/**
 * Specialized technical support agent implementation
 */
export class TechnicalSupportAgent extends BaseAgent {
  private knowledgeBase: Map<string, TechnicalSolution> = new Map();
  private diagnosticTools: Map<string, DiagnosticTool> = new Map();
  private escalationRules: Map<string, EscalationRule> = new Map();
  private solutionTemplates: Map<string, SolutionTemplate> = new Map();

  constructor(config: AgentConfig) {
    super(config);
    this.initializeKnowledgeBase();
    this.initializeDiagnosticTools();
    this.initializeEscalationRules();
    this.initializeSolutionTemplates();
  }

  /**
   * Execute technical support task
   */
  protected async executeTask(request: AgentRequest): Promise<AgentResponse> {
    const tsRequest = request as TechnicalSupportRequest;
    
    // Validate technical support request
    const validation = await this.validateTechnicalRequest(tsRequest);
    if (!validation.valid) {
      return this.createErrorResponse(validation.errors);
    }

    // Perform initial diagnostics
    const diagnostics = await this.performDiagnostics(tsRequest);
    
    // Search for known solutions
    const knownSolutions = await this.searchKnownSolutions(tsRequest, diagnostics);
    
    // Generate comprehensive solution
    const solution = await this.generateSolution(tsRequest, diagnostics, knownSolutions);
    
    // Determine escalation needs
    const escalationAssessment = await this.assessEscalationNeeds(tsRequest, diagnostics, solution);
    
    // Create follow-up plan
    const followUpPlan = await this.createFollowUpPlan(tsRequest, solution);
    
    return this.createTechnicalResponse(tsRequest, solution, diagnostics, escalationAssessment, followUpPlan);
  }

  /**
   * Validate technical support request
   */
  private async validateTechnicalRequest(request: TechnicalSupportRequest): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check issue category
    const supportedCategories = ['software', 'hardware', 'network', 'security', 'performance', 'integration', 'deployment'];
    if (!supportedCategories.includes(request.issueCategory)) {
      errors.push(`Unsupported issue category: ${request.issueCategory}`);
    }

    // Check severity level
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(request.severity)) {
      errors.push(`Invalid severity level: ${request.severity}`);
    }

    // Validate user level
    const validUserLevels = ['beginner', 'intermediate', 'advanced', 'expert'];
    if (!validUserLevels.includes(request.userLevel)) {
      errors.push(`Invalid user level: ${request.userLevel}`);
    }

    // Check for critical issues that need immediate attention
    if (request.severity === 'critical' && !request.urgency) {
      warnings.push('Critical issues typically require urgent attention');
    }

    // Validate system information if provided
    if (request.systemInfo) {
      if (!request.systemInfo.os) {
        warnings.push('Operating system information would help with troubleshooting');
      }
      if (!request.systemInfo.environment) {
        warnings.push('Environment information (production/staging) would help with diagnosis');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Perform initial diagnostics
   */
  private async performDiagnostics(request: TechnicalSupportRequest): Promise<DiagnosticResults> {
    const results: DiagnosticResults = {
      probable_causes: [],
      system_status: 'unknown',
      compatibility_issues: [],
      performance_metrics: {},
      security_concerns: [],
      diagnostic_confidence: 0
    };

    // Run category-specific diagnostics
    const diagnosticTool = this.diagnosticTools.get(request.issueCategory);
    if (diagnosticTool) {
      const toolResults = await diagnosticTool.analyze(request);
      results.probable_causes = toolResults.probable_causes;
      results.system_status = toolResults.system_status;
      results.diagnostic_confidence = toolResults.confidence;
    }

    // Analyze error details if provided
    if (request.errorDetails) {
      results.probable_causes.push(...this.analyzeErrorDetails(request.errorDetails));
    }

    // Check system compatibility
    if (request.systemInfo) {
      results.compatibility_issues = this.checkCompatibility(request.systemInfo);
    }

    // Assess security implications
    if (request.issueCategory === 'security' || request.errorDetails?.error_message?.includes('security')) {
      results.security_concerns = this.assessSecurityRisks(request);
    }

    // Performance analysis
    if (request.issueCategory === 'performance') {
      results.performance_metrics = this.analyzePerformance(request);
    }

    return results;
  }

  /**
   * Search for known solutions
   */
  private async searchKnownSolutions(
    request: TechnicalSupportRequest, 
    diagnostics: DiagnosticResults
  ): Promise<TechnicalSolution[]> {
    const solutions: TechnicalSolution[] = [];

    // Search by error code/message
    if (request.errorDetails?.error_code) {
      const solution = this.knowledgeBase.get(`error_${request.errorDetails.error_code}`);
      if (solution) {
        solutions.push(solution);
      }
    }

    // Search by probable causes
    for (const cause of diagnostics.probable_causes) {
      const solution = this.knowledgeBase.get(cause.toLowerCase().replace(/\s+/g, '_'));
      if (solution) {
        solutions.push(solution);
      }
    }

    // Search by category and system combination
    const categoryKey = `${request.issueCategory}_${request.systemInfo?.os || 'generic'}`;
    const categorySolution = this.knowledgeBase.get(categoryKey);
    if (categorySolution) {
      solutions.push(categorySolution);
    }

    // Remove duplicates and sort by relevance
    return this.deduplicateAndRankSolutions(solutions, request, diagnostics);
  }

  /**
   * Generate comprehensive solution
   */
  private async generateSolution(
    request: TechnicalSupportRequest,
    diagnostics: DiagnosticResults,
    knownSolutions: TechnicalSolution[]
  ): Promise<SolutionGeneration> {
    const solution: SolutionGeneration = {
      primary_solution: '',
      step_by_step_instructions: [],
      alternative_solutions: [],
      prevention_measures: [],
      confidence_score: 0,
      estimated_time: '',
      difficulty_level: request.userLevel
    };

    if (knownSolutions.length > 0) {
      // Use best known solution as primary
      const bestSolution = knownSolutions[0];
      solution.primary_solution = bestSolution.description;
      solution.step_by_step_instructions = this.adaptInstructionsToUserLevel(
        bestSolution.steps, 
        request.userLevel
      );
      
      // Add alternative solutions
      solution.alternative_solutions = knownSolutions.slice(1, 3).map(sol => sol.description);
      
      // Generate prevention measures
      solution.prevention_measures = this.generatePreventionMeasures(bestSolution, request);
      
      solution.confidence_score = bestSolution.success_rate;
    } else {
      // Generate custom solution based on diagnostics
      solution.primary_solution = this.generateCustomSolution(request, diagnostics);
      solution.step_by_step_instructions = this.generateCustomInstructions(request, diagnostics);
      solution.alternative_solutions = this.generateAlternativeApproaches(request, diagnostics);
      solution.prevention_measures = this.generateGenericPrevention(request);
      solution.confidence_score = Math.max(0.3, diagnostics.diagnostic_confidence);
    }

    // Estimate resolution time
    solution.estimated_time = this.estimateResolutionTime(request, solution);

    return solution;
  }

  /**
   * Assess escalation needs
   */
  private async assessEscalationNeeds(
    request: TechnicalSupportRequest,
    diagnostics: DiagnosticResults,
    solution: SolutionGeneration
  ): Promise<EscalationAssessment> {
    const assessment: EscalationAssessment = {
      requires_escalation: false,
      escalation_reason: '',
      specialist_type: '',
      estimated_resolution_time: solution.estimated_time,
      escalation_priority: 'normal'
    };

    // Check escalation rules
    for (const rule of this.escalationRules.values()) {
      if (this.matchesEscalationRule(rule, request, diagnostics, solution)) {
        assessment.requires_escalation = true;
        assessment.escalation_reason = rule.reason;
        assessment.specialist_type = rule.specialist_type;
        assessment.escalation_priority = rule.priority;
        break;
      }
    }

    // Additional escalation checks
    if (solution.confidence_score < 0.5) {
      assessment.requires_escalation = true;
      assessment.escalation_reason = 'Low confidence in proposed solution';
      assessment.specialist_type = 'senior_technical_specialist';
    }

    if (request.severity === 'critical' && diagnostics.security_concerns.length > 0) {
      assessment.requires_escalation = true;
      assessment.escalation_reason = 'Critical security issue requires specialist attention';
      assessment.specialist_type = 'security_specialist';
      assessment.escalation_priority = 'urgent';
    }

    return assessment;
  }

  /**
   * Create follow-up plan
   */
  private async createFollowUpPlan(
    request: TechnicalSupportRequest,
    solution: SolutionGeneration
  ): Promise<FollowUpPlan> {
    const plan: FollowUpPlan = {
      verification_steps: [],
      monitoring_recommendations: [],
      next_check_in: '',
      related_resources: [],
      success_metrics: []
    };

    // Generate verification steps
    plan.verification_steps = this.generateVerificationSteps(request, solution);

    // Create monitoring recommendations
    plan.monitoring_recommendations = this.generateMonitoringRecommendations(request);

    // Determine next check-in time
    plan.next_check_in = this.calculateNextCheckIn(request.severity);

    // Add related resources
    plan.related_resources = this.findRelatedResources(request);

    // Define success metrics
    plan.success_metrics = this.defineSuccessMetrics(request);

    return plan;
  }

  /**
   * Create technical response
   */
  private createTechnicalResponse(
    request: TechnicalSupportRequest,
    solution: SolutionGeneration,
    diagnostics: DiagnosticResults,
    escalation: EscalationAssessment,
    followUp: FollowUpPlan
  ): TechnicalSupportResponse {
    const responseContent = this.formatTechnicalResponse(solution, diagnostics, escalation);

    return {
      type: 'text',
      content: responseContent,
      solution: {
        primary_solution: solution.primary_solution,
        step_by_step_instructions: solution.step_by_step_instructions,
        alternative_solutions: solution.alternative_solutions,
        prevention_measures: solution.prevention_measures
      },
      diagnostics: {
        root_cause_analysis: this.generateRootCauseAnalysis(diagnostics),
        diagnostic_steps_performed: this.listDiagnosticSteps(request, diagnostics),
        system_health_check: diagnostics.system_status,
        performance_impact: this.assessPerformanceImpact(request, diagnostics)
      },
      escalation: {
        requires_escalation: escalation.requires_escalation,
        escalation_reason: escalation.escalation_reason,
        specialist_type: escalation.specialist_type,
        estimated_resolution_time: escalation.estimated_resolution_time
      },
      followUp: {
        verification_steps: followUp.verification_steps,
        monitoring_recommendations: followUp.monitoring_recommendations,
        next_check_in: followUp.next_check_in,
        related_resources: followUp.related_resources
      },
      context: request.context || {
        sessionId: '',
        executionId: '',
        timestamp: new Date(),
        environment: { name: 'production' }
      }
    };
  }

  /**
   * Helper methods for analysis
   */
  private analyzeErrorDetails(errorDetails: any): string[] {
    const causes: string[] = [];

    if (errorDetails.error_code) {
      causes.push(`Error code ${errorDetails.error_code} indicates specific system failure`);
    }

    if (errorDetails.error_message) {
      // Common error patterns
      if (errorDetails.error_message.includes('timeout')) {
        causes.push('Network or system timeout issue');
      }
      if (errorDetails.error_message.includes('permission')) {
        causes.push('Insufficient permissions or access rights');
      }
      if (errorDetails.error_message.includes('memory')) {
        causes.push('Memory allocation or out-of-memory issue');
      }
      if (errorDetails.error_message.includes('connection')) {
        causes.push('Network connectivity problem');
      }
    }

    if (errorDetails.stack_trace) {
      causes.push('Stack trace analysis reveals application code issue');
    }

    return causes;
  }

  private checkCompatibility(systemInfo: any): string[] {
    const issues: string[] = [];

    // Example compatibility checks
    if (systemInfo.os === 'Windows' && systemInfo.version && systemInfo.version < '10') {
      issues.push('Older Windows version may have compatibility limitations');
    }

    if (systemInfo.browser === 'Internet Explorer') {
      issues.push('Internet Explorer is deprecated and may cause compatibility issues');
    }

    if (systemInfo.environment === 'production' && systemInfo.device_type === 'mobile') {
      issues.push('Mobile production environment may have specific configuration requirements');
    }

    return issues;
  }

  private assessSecurityRisks(request: TechnicalSupportRequest): string[] {
    const concerns: string[] = [];

    if (request.errorDetails?.error_message?.includes('unauthorized')) {
      concerns.push('Potential unauthorized access attempt detected');
    }

    if (request.issueCategory === 'security') {
      concerns.push('Security-related issue requires careful handling');
    }

    if (request.systemInfo?.environment === 'production') {
      concerns.push('Production environment security implications');
    }

    return concerns;
  }

  private analyzePerformance(request: TechnicalSupportRequest): Record<string, any> {
    return {
      potential_bottlenecks: ['Memory usage', 'Network latency', 'CPU utilization'],
      optimization_opportunities: ['Caching', 'Database queries', 'Resource compression'],
      monitoring_points: ['Response times', 'Error rates', 'Resource consumption']
    };
  }

  private deduplicateAndRankSolutions(
    solutions: TechnicalSolution[], 
    request: TechnicalSupportRequest,
    diagnostics: DiagnosticResults
  ): TechnicalSolution[] {
    // Remove duplicates by ID
    const uniqueSolutions = solutions.filter((solution, index, self) => 
      index === self.findIndex(s => s.id === solution.id)
    );

    // Rank by relevance and success rate
    return uniqueSolutions.sort((a, b) => {
      const scoreA = a.success_rate * this.calculateRelevanceScore(a, request, diagnostics);
      const scoreB = b.success_rate * this.calculateRelevanceScore(b, request, diagnostics);
      return scoreB - scoreA;
    });
  }

  private calculateRelevanceScore(
    solution: TechnicalSolution, 
    request: TechnicalSupportRequest,
    diagnostics: DiagnosticResults
  ): number {
    let score = 0.5; // Base score

    // Category match
    if (solution.category === request.issueCategory) score += 0.3;

    // System match
    if (solution.applicable_systems.includes(request.systemInfo?.os || '')) score += 0.2;

    // Severity appropriateness
    if (solution.complexity <= request.userLevel) score += 0.2;

    return Math.min(1, score);
  }

  private adaptInstructionsToUserLevel(steps: string[], userLevel: string): string[] {
    const levelMultipliers = {
      'beginner': 1.5,
      'intermediate': 1.2,
      'advanced': 1.0,
      'expert': 0.8
    };

    const multiplier = levelMultipliers[userLevel as keyof typeof levelMultipliers] || 1.0;

    if (userLevel === 'beginner') {
      // Add more detailed explanations for beginners
      return steps.map(step => 
        `${step}\n   (Detailed: ${this.addBeginnerDetails(step)})`
      );
    }

    if (userLevel === 'expert') {
      // Simplify for experts
      return steps.map(step => step.split('.')[0]); // Just the main action
    }

    return steps;
  }

  private addBeginnerDetails(step: string): string {
    // Add contextual help for beginners
    if (step.includes('restart')) {
      return 'To restart, go to Start menu > Power > Restart';
    }
    if (step.includes('command line')) {
      return 'Press Windows key + R, type cmd, press Enter';
    }
    return 'Follow the step carefully and check for confirmation messages';
  }

  private generatePreventionMeasures(solution: TechnicalSolution, request: TechnicalSupportRequest): string[] {
    const measures = [...solution.prevention_tips];

    // Add generic prevention based on category
    switch (request.issueCategory) {
      case 'software':
        measures.push('Keep software updated to latest version');
        measures.push('Regular backup of configuration settings');
        break;
      case 'hardware':
        measures.push('Regular hardware maintenance and cleaning');
        measures.push('Monitor system temperatures and performance');
        break;
      case 'network':
        measures.push('Monitor network traffic and bandwidth usage');
        measures.push('Maintain firewall and security configurations');
        break;
      case 'security':
        measures.push('Regular security audits and vulnerability scans');
        measures.push('Keep security software and definitions updated');
        break;
    }

    return measures;
  }

  private generateCustomSolution(request: TechnicalSupportRequest, diagnostics: DiagnosticResults): string {
    return `Based on the ${request.issueCategory} issue analysis, the recommended approach is to ${this.getGenericSolutionApproach(request.issueCategory)}. The diagnostic results indicate ${diagnostics.probable_causes[0] || 'a system-related issue'} which can typically be resolved through systematic troubleshooting.`;
  }

  private getGenericSolutionApproach(category: string): string {
    const approaches = {
      'software': 'reinstall or update the affected software component',
      'hardware': 'check hardware connections and component functionality',
      'network': 'verify network configuration and connectivity',
      'security': 'review and update security settings and permissions',
      'performance': 'optimize system resources and configuration',
      'integration': 'verify API connections and data flow',
      'deployment': 'review deployment configuration and environment setup'
    };

    return approaches[category as keyof typeof approaches] || 'systematic troubleshooting';
  }

  private generateCustomInstructions(request: TechnicalSupportRequest, diagnostics: DiagnosticResults): string[] {
    const template = this.solutionTemplates.get(request.issueCategory);
    if (template) {
      return template.generic_steps.map(step => 
        step.replace('{issue}', request.input).replace('{cause}', diagnostics.probable_causes[0] || 'unknown')
      );
    }

    return [
      'Identify the specific problem symptoms',
      'Gather relevant system information',
      'Apply the recommended solution',
      'Test to verify the issue is resolved',
      'Document the solution for future reference'
    ];
  }

  private generateAlternativeApproaches(request: TechnicalSupportRequest, diagnostics: DiagnosticResults): string[] {
    return [
      'Try a system restart to reset temporary issues',
      'Check for recent system or software changes',
      'Run built-in diagnostic tools',
      'Consult vendor documentation for specific guidance'
    ];
  }

  private generateGenericPrevention(request: TechnicalSupportRequest): string[] {
    return [
      'Implement regular monitoring and maintenance',
      'Keep all systems and software updated',
      'Maintain proper documentation and change logs',
      'Establish backup and recovery procedures'
    ];
  }

  private estimateResolutionTime(request: TechnicalSupportRequest, solution: SolutionGeneration): string {
    const severityTimeMap = {
      'low': '2-4 hours',
      'medium': '4-8 hours', 
      'high': '1-2 business days',
      'critical': 'Immediate - within 1 hour'
    };

    const baseTime = severityTimeMap[request.severity];
    
    if (solution.confidence_score < 0.5) {
      return `${baseTime} (may require additional investigation)`;
    }

    return baseTime;
  }

  private matchesEscalationRule(
    rule: EscalationRule,
    request: TechnicalSupportRequest,
    diagnostics: DiagnosticResults,
    solution: SolutionGeneration
  ): boolean {
    return rule.condition_evaluator(request, diagnostics, solution);
  }

  private generateVerificationSteps(request: TechnicalSupportRequest, solution: SolutionGeneration): string[] {
    return [
      'Test the system functionality that was previously failing',
      'Monitor system performance for stability',
      'Verify that error messages no longer appear',
      'Check related system components for proper operation',
      'Document the successful resolution'
    ];
  }

  private generateMonitoringRecommendations(request: TechnicalSupportRequest): string[] {
    const recommendations = ['Set up automated monitoring for the affected system'];

    switch (request.issueCategory) {
      case 'performance':
        recommendations.push('Monitor CPU, memory, and disk usage trends');
        recommendations.push('Set up performance baseline metrics');
        break;
      case 'security':
        recommendations.push('Enable security event logging');
        recommendations.push('Set up intrusion detection alerts');
        break;
      case 'network':
        recommendations.push('Monitor network traffic patterns');
        recommendations.push('Set up connectivity health checks');
        break;
    }

    return recommendations;
  }

  private calculateNextCheckIn(severity: string): string {
    const checkInMap = {
      'critical': '2 hours',
      'high': '24 hours',
      'medium': '3 days',
      'low': '1 week'
    };

    return checkInMap[severity as keyof typeof checkInMap] || '3 days';
  }

  private findRelatedResources(request: TechnicalSupportRequest): string[] {
    return [
      `${request.issueCategory} troubleshooting guide`,
      'System documentation and user manuals',
      'Community forums and knowledge base',
      'Vendor support resources',
      'Best practices documentation'
    ];
  }

  private defineSuccessMetrics(request: TechnicalSupportRequest): string[] {
    return [
      'Error conditions no longer occur',
      'System performance returns to normal',
      'User can complete intended tasks',
      'No related issues emerge',
      'Solution remains stable over time'
    ];
  }

  private formatTechnicalResponse(
    solution: SolutionGeneration,
    diagnostics: DiagnosticResults,
    escalation: EscalationAssessment
  ): string {
    let response = `## Technical Analysis\n\n`;
    response += `Based on the diagnostic analysis, I've identified the following:\n\n`;
    response += `**Root Cause**: ${diagnostics.probable_causes[0] || 'System-related issue requiring investigation'}\n\n`;
    response += `**Recommended Solution**: ${solution.primary_solution}\n\n`;
    response += `**Confidence Level**: ${Math.round(solution.confidence_score * 100)}%\n\n`;
    
    if (escalation.requires_escalation) {
      response += `**Escalation Required**: ${escalation.escalation_reason}\n\n`;
    }

    return response;
  }

  private generateRootCauseAnalysis(diagnostics: DiagnosticResults): string {
    if (diagnostics.probable_causes.length > 0) {
      return `Primary cause identified as: ${diagnostics.probable_causes[0]}. Contributing factors include: ${diagnostics.probable_causes.slice(1).join(', ')}`;
    }
    return 'Root cause analysis indicates a complex system interaction requiring further investigation.';
  }

  private listDiagnosticSteps(request: TechnicalSupportRequest, diagnostics: DiagnosticResults): string[] {
    return [
      `Analyzed ${request.issueCategory} category issue`,
      'Reviewed system information and error details',
      'Performed compatibility assessment',
      'Evaluated security implications',
      `Assessed system status: ${diagnostics.system_status}`
    ];
  }

  private assessPerformanceImpact(request: TechnicalSupportRequest, diagnostics: DiagnosticResults): string {
    if (request.issueCategory === 'performance') {
      return 'Direct performance impact detected - optimization required';
    }
    if (request.severity === 'critical') {
      return 'Critical issue may have significant performance implications';
    }
    return 'Minimal performance impact expected from this issue';
  }

  private createErrorResponse(errors: string[]): AgentResponse {
    return {
      type: 'error',
      content: `Technical support analysis failed: ${errors.join(', ')}`,
      context: {
        sessionId: '',
        executionId: '',
        timestamp: new Date(),
        environment: { name: 'production' }
      }
    };
  }

  /**
   * Initialize knowledge base
   */
  private initializeKnowledgeBase(): void {
    this.knowledgeBase.set('software_windows', {
      id: 'sw_win_001',
      category: 'software',
      description: 'Windows software compatibility and installation issues',
      steps: [
        'Run Windows compatibility troubleshooter',
        'Check system requirements and compatibility',
        'Try running as administrator',
        'Update Windows and drivers',
        'Reinstall the software if necessary'
      ],
      success_rate: 0.85,
      complexity: 'intermediate',
      applicable_systems: ['Windows'],
      prevention_tips: ['Regular system updates', 'Verify compatibility before installation']
    });

    this.knowledgeBase.set('network_connectivity', {
      id: 'net_con_001',
      category: 'network',
      description: 'Network connectivity troubleshooting',
      steps: [
        'Check physical network connections',
        'Restart network adapters',
        'Flush DNS cache',
        'Test connectivity with ping and traceroute',
        'Check firewall and security settings'
      ],
      success_rate: 0.78,
      complexity: 'beginner',
      applicable_systems: ['Windows', 'macOS', 'Linux'],
      prevention_tips: ['Regular network monitoring', 'Maintain network documentation']
    });

    this.knowledgeBase.set('performance_slow', {
      id: 'perf_slow_001',
      category: 'performance',
      description: 'System performance optimization',
      steps: [
        'Check system resource usage',
        'Identify resource-heavy processes',
        'Clean temporary files and cache',
        'Update drivers and software',
        'Consider hardware upgrades if necessary'
      ],
      success_rate: 0.72,
      complexity: 'intermediate',
      applicable_systems: ['Windows', 'macOS', 'Linux'],
      prevention_tips: ['Regular maintenance', 'Monitor resource usage', 'Schedule cleanup tasks']
    });
  }

  /**
   * Initialize diagnostic tools
   */
  private initializeDiagnosticTools(): void {
    this.diagnosticTools.set('software', {
      name: 'Software Diagnostic Tool',
      analyze: async (request: TechnicalSupportRequest) => ({
        probable_causes: ['Software compatibility issue', 'Corrupted installation', 'Missing dependencies'],
        system_status: 'requires_attention',
        confidence: 0.8
      })
    });

    this.diagnosticTools.set('hardware', {
      name: 'Hardware Diagnostic Tool',
      analyze: async (request: TechnicalSupportRequest) => ({
        probable_causes: ['Hardware failure', 'Connection issue', 'Driver problem'],
        system_status: 'hardware_check_needed',
        confidence: 0.75
      })
    });

    this.diagnosticTools.set('network', {
      name: 'Network Diagnostic Tool',
      analyze: async (request: TechnicalSupportRequest) => ({
        probable_causes: ['Network connectivity issue', 'DNS problem', 'Firewall blocking'],
        system_status: 'network_unstable',
        confidence: 0.85
      })
    });
  }

  /**
   * Initialize escalation rules
   */
  private initializeEscalationRules(): void {
    this.escalationRules.set('critical_security', {
      name: 'Critical Security Issue',
      condition_evaluator: (request, diagnostics, solution) => 
        request.severity === 'critical' && request.issueCategory === 'security',
      reason: 'Critical security issue requires immediate specialist attention',
      specialist_type: 'security_specialist',
      priority: 'urgent'
    });

    this.escalationRules.set('low_confidence', {
      name: 'Low Solution Confidence',
      condition_evaluator: (request, diagnostics, solution) => 
        solution.confidence_score < 0.4,
      reason: 'Low confidence in proposed solution requires expert review',
      specialist_type: 'senior_technical_specialist',
      priority: 'normal'
    });

    this.escalationRules.set('complex_integration', {
      name: 'Complex Integration Issue',
      condition_evaluator: (request, diagnostics, solution) => 
        request.issueCategory === 'integration' && request.severity !== 'low',
      reason: 'Complex integration issues require specialized expertise',
      specialist_type: 'integration_specialist',
      priority: 'high'
    });
  }

  /**
   * Initialize solution templates
   */
  private initializeSolutionTemplates(): void {
    this.solutionTemplates.set('software', {
      category: 'software',
      generic_steps: [
        'Identify the specific software causing {issue}',
        'Check for known issues with the software version',
        'Attempt standard troubleshooting for {cause}',
        'Consider software reinstallation if needed',
        'Verify the solution resolves the problem'
      ]
    });

    this.solutionTemplates.set('hardware', {
      category: 'hardware',
      generic_steps: [
        'Safely power down and inspect hardware connections',
        'Check for visible damage or loose connections',
        'Test hardware components individually',
        'Update or reinstall device drivers',
        'Contact vendor if hardware replacement is needed'
      ]
    });

    this.solutionTemplates.set('network', {
      category: 'network',
      generic_steps: [
        'Test basic network connectivity',
        'Check network configuration settings',
        'Restart network equipment in proper sequence',
        'Verify firewall and security settings',
        'Contact network administrator if issues persist'
      ]
    });
  }
}

/**
 * Supporting interfaces
 */
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

interface DiagnosticResults {
  probable_causes: string[];
  system_status: string;
  compatibility_issues: string[];
  performance_metrics: Record<string, any>;
  security_concerns: string[];
  diagnostic_confidence: number;
}

interface TechnicalSolution {
  id: string;
  category: string;
  description: string;
  steps: string[];
  success_rate: number;
  complexity: string;
  applicable_systems: string[];
  prevention_tips: string[];
}

interface DiagnosticTool {
  name: string;
  analyze: (request: TechnicalSupportRequest) => Promise<{
    probable_causes: string[];
    system_status: string;
    confidence: number;
  }>;
}

interface EscalationRule {
  name: string;
  condition_evaluator: (
    request: TechnicalSupportRequest, 
    diagnostics: DiagnosticResults, 
    solution: SolutionGeneration
  ) => boolean;
  reason: string;
  specialist_type: string;
  priority: string;
}

interface SolutionTemplate {
  category: string;
  generic_steps: string[];
}

interface SolutionGeneration {
  primary_solution: string;
  step_by_step_instructions: string[];
  alternative_solutions: string[];
  prevention_measures: string[];
  confidence_score: number;
  estimated_time: string;
  difficulty_level: string;
}

interface EscalationAssessment {
  requires_escalation: boolean;
  escalation_reason: string;
  specialist_type: string;
  estimated_resolution_time: string;
  escalation_priority: string;
}

interface FollowUpPlan {
  verification_steps: string[];
  monitoring_recommendations: string[];
  next_check_in: string;
  related_resources: string[];
  success_metrics: string[];
}

/**
 * Technical support agent template
 */
export const TechnicalSupportTemplate: DomainAgentTemplate = {
  id: 'technical-support:specialist',
  domain: 'technical-support',
  role: 'specialist',
  description: 'Specialized agent for technical troubleshooting, system diagnostics, and solution implementation',
  defaultCapabilities: [
    'system-diagnostics',
    'troubleshooting',
    'solution-implementation',
    'escalation-management',
    'technical-documentation'
  ],
  defaultPersonalityTraits: [
    { name: 'systematic', value: 0.9, description: 'Systematic approach to problem-solving', category: 'analytical' },
    { name: 'thorough', value: 0.8, description: 'Thorough investigation of issues', category: 'analytical' },
    { name: 'patient', value: 0.8, description: 'Patient with complex troubleshooting', category: 'social' },
    { name: 'technical', value: 0.9, description: 'Strong technical expertise', category: 'analytical' },
    { name: 'solution-focused', value: 0.8, description: 'Focused on finding practical solutions', category: 'analytical' }
  ],
  defaultTools: [
    'diagnostic-suite',
    'knowledge-base',
    'escalation-system',
    'monitoring-tools',
    'documentation-generator'
  ],
  configSchema: {
    type: 'object',
    properties: {
      escalationThreshold: { type: 'number', minimum: 0, maximum: 1 },
      diagnosticDepth: { type: 'string', enum: ['basic', 'standard', 'comprehensive'] },
      userLevelAdjustment: { type: 'boolean' },
      securityPriority: { type: 'boolean' }
    }
  },
  examples: [
    'Diagnose software installation issues',
    'Troubleshoot network connectivity problems',
    'Resolve performance bottlenecks',
    'Handle security incidents'
  ],
  documentation: 'Technical support agent specialized in system diagnostics, troubleshooting, and solution implementation. Includes automatic escalation and comprehensive follow-up.',
  
  domainSpecific: {
    knowledgeBase: [
      'system-troubleshooting-guides',
      'diagnostic-procedures',
      'solution-database',
      'escalation-protocols',
      'vendor-documentation'
    ],
    specializedTools: [
      'system-diagnostics',
      'performance-analyzer',
      'security-scanner',
      'compatibility-checker',
      'solution-recommender'
    ],
    communicationPatterns: [
      {
        name: 'technical-explanation',
        description: 'Clear technical explanation adapted to user level',
        triggers: ['how', 'why', 'technical', 'explain'],
        responseTemplate: 'The technical issue is caused by {cause}. Here\'s how we can resolve it.',
        tone: 'technical',
        context: ['troubleshooting', 'explanation']
      },
      {
        name: 'step-by-step-guidance',
        description: 'Detailed step-by-step instructions',
        triggers: ['steps', 'instructions', 'guide'],
        responseTemplate: 'Follow these steps carefully: {steps}',
        tone: 'technical',
        context: ['guidance', 'implementation']
      }
    ],
    behaviorRules: [
      {
        name: 'diagnostic-first',
        description: 'Always perform diagnostics before proposing solutions',
        condition: 'request.issueCategory !== null',
        action: 'perform_comprehensive_diagnostics',
        priority: 1,
        active: true
      },
      {
        name: 'escalation-check',
        description: 'Check escalation criteria for all critical issues',
        condition: 'request.severity === "critical"',
        action: 'evaluate_escalation_needs',
        priority: 1,
        active: true
      }
    ],
    validationRules: [
      {
        field: 'issueCategory',
        rule: 'value && ["software", "hardware", "network", "security", "performance", "integration", "deployment"].includes(value)',
        message: 'Issue category must be one of: software, hardware, network, security, performance, integration, deployment',
        severity: 'error'
      }
    ]
  },
  
  inheritance: {
    baseTemplate: undefined,
    mixins: ['diagnostic-mixin', 'escalation-mixin']
  },
  
  customization: {
    configurableFields: [
      {
        name: 'escalationThreshold',
        type: 'number',
        description: 'Confidence threshold below which escalation is triggered (0-1)',
        defaultValue: 0.5,
        required: false,
        validation: { min: 0, max: 1 }
      },
      {
        name: 'diagnosticDepth',
        type: 'string',
        description: 'Level of diagnostic analysis to perform',
        defaultValue: 'standard',
        required: false,
        options: ['basic', 'standard', 'comprehensive']
      },
      {
        name: 'userLevelAdjustment',
        type: 'boolean',
        description: 'Adjust instructions based on user technical level',
        defaultValue: true,
        required: false
      }
    ],
    presets: [
      {
        name: 'enterprise-support',
        description: 'Optimized for enterprise technical support',
        configuration: {
          escalationThreshold: 0.7,
          diagnosticDepth: 'comprehensive',
          userLevelAdjustment: false
        },
        tags: ['enterprise', 'professional']
      },
      {
        name: 'user-friendly',
        description: 'Optimized for end-user support with simplified explanations',
        configuration: {
          escalationThreshold: 0.6,
          diagnosticDepth: 'standard',
          userLevelAdjustment: true
        },
        tags: ['user-friendly', 'simplified']
      }
    ]
  },
  
  metadata: {
    author: 'Convergio Team',
    version: '1.0.0',
    category: 'technical-support',
    tags: ['support', 'diagnostics', 'troubleshooting', 'technical'],
    lastUpdated: new Date(),
    usageCount: 0
  }
};