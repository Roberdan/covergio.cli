/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Agent specification schema for defining required expertise and capabilities
 */
export interface AgentSpecification {
  /** Unique identifier for the agent specification */
  id: string;
  /** Domain the agent specializes in */
  domain: string;
  /** Role/title of the agent */
  role: string;
  /** Required capabilities and skills */
  capabilities: Capability[];
  /** Personality traits that affect agent behavior */
  personalityTraits: PersonalityTrait[];
  /** Tools and resources the agent has access to */
  tools: ToolDefinition[];
  /** Confidence level in agent's ability to handle the task */
  confidence: number;
  /** Metadata about the specification */
  metadata: AgentSpecificationMetadata;
}

/**
 * Capability definition for agent skills and expertise
 */
export interface Capability {
  /** Unique identifier for the capability */
  id: string;
  /** Human-readable name of the capability */
  name: string;
  /** Category the capability belongs to */
  category: CapabilityCategory;
  /** Level of expertise required */
  level: ExpertiseLevel;
  /** Importance of this capability for the task */
  importance: ImportanceLevel;
  /** Alternative capabilities that could substitute */
  alternatives?: string[];
  /** Prerequisites for this capability */
  prerequisites?: string[];
  /** Keywords associated with this capability */
  keywords: string[];
  /** Description of what this capability enables */
  description: string;
}

/**
 * Categories of capabilities
 */
export type CapabilityCategory = 
  | 'technical'
  | 'creative'
  | 'analytical'
  | 'communication'
  | 'domain-specific'
  | 'tool-usage'
  | 'problem-solving'
  | 'project-management';

/**
 * Levels of expertise
 */
export type ExpertiseLevel = 
  | 'beginner'
  | 'intermediate' 
  | 'advanced'
  | 'expert'
  | 'master';

/**
 * Importance levels for capabilities
 */
export type ImportanceLevel = 
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'optional';

/**
 * Personality traits that affect agent behavior
 */
export interface PersonalityTrait {
  /** Name of the trait */
  name: string;
  /** Strength of the trait (0-1) */
  strength: number;
  /** How this trait affects agent behavior */
  description: string;
  /** Category of the trait */
  category: PersonalityCategory;
}

/**
 * Categories of personality traits
 */
export type PersonalityCategory = 
  | 'analytical'
  | 'creative'
  | 'social'
  | 'methodical'
  | 'adaptive'
  | 'collaborative';

/**
 * Tool definition for agent capabilities
 */
export interface ToolDefinition {
  /** Unique identifier for the tool */
  id: string;
  /** Human-readable name */
  name: string;
  /** What the tool does */
  description: string;
  /** Category of tool */
  category: ToolCategory;
  /** Parameters the tool accepts */
  parameters: ToolParameter[];
  /** Access level required to use the tool */
  accessLevel: AccessLevel;
  /** Dependencies this tool has */
  dependencies?: string[];
}

/**
 * Categories of tools
 */
export type ToolCategory = 
  | 'analysis'
  | 'generation'
  | 'communication'
  | 'data-processing'
  | 'integration'
  | 'visualization'
  | 'testing'
  | 'deployment';

/**
 * Tool parameter definition
 */
export interface ToolParameter {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  /** Whether parameter is required */
  required: boolean;
  /** Default value if any */
  defaultValue?: any;
  /** Description of the parameter */
  description: string;
  /** Validation rules */
  validation?: ParameterValidation;
}

/**
 * Parameter validation rules
 */
export interface ParameterValidation {
  /** Minimum value/length */
  min?: number;
  /** Maximum value/length */
  max?: number;
  /** Regular expression pattern */
  pattern?: string;
  /** Allowed values */
  enum?: any[];
}

/**
 * Access levels for tools and capabilities
 */
export type AccessLevel = 
  | 'public'
  | 'restricted'
  | 'confidential'
  | 'admin-only';

/**
 * Metadata for agent specifications
 */
export interface AgentSpecificationMetadata {
  /** When the specification was created */
  createdAt: Date;
  /** When it was last updated */
  updatedAt: Date;
  /** Version of the specification */
  version: string;
  /** Who created/updated the specification */
  author?: string;
  /** Tags for categorization */
  tags: string[];
  /** Additional custom metadata */
  custom?: Record<string, any>;
}

/**
 * Input for expertise identification
 */
export interface ExpertiseIdentificationInput {
  /** Task or request to analyze */
  task: string;
  /** Context about the task */
  context: TaskContext;
  /** Options for identification */
  options?: ExpertiseIdentificationOptions;
}

/**
 * Context about the task
 */
export interface TaskContext {
  /** Domain the task belongs to */
  domain?: string;
  /** Complexity level */
  complexity?: 'simple' | 'medium' | 'complex' | 'expert';
  /** Time constraints */
  timeLimit?: number;
  /** Available resources */
  resources?: string[];
  /** Team constraints */
  teamSize?: number;
  /** Budget constraints */
  budget?: number;
  /** Quality requirements */
  qualityLevel?: 'basic' | 'standard' | 'high' | 'premium';
  /** Risk tolerance */
  riskTolerance?: 'low' | 'medium' | 'high';
  /** Stakeholder information */
  stakeholders?: string[];
}

/**
 * Options for expertise identification
 */
export interface ExpertiseIdentificationOptions {
  /** Maximum number of agents to suggest */
  maxAgents?: number;
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Whether to include fallback suggestions */
  includeFallbacks?: boolean;
  /** Preferred agent types */
  preferredTypes?: string[];
  /** Excluded agent types */
  excludedTypes?: string[];
  /** Whether to optimize for speed vs quality */
  optimizeFor?: 'speed' | 'quality' | 'cost' | 'reliability';
}

/**
 * Result of expertise identification
 */
export interface ExpertiseIdentificationResult {
  /** Input that was analyzed */
  input: ExpertiseIdentificationInput;
  /** Agent specifications that match the requirements */
  specifications: AgentSpecification[];
  /** Analysis of the task requirements */
  analysis: ExpertiseAnalysis;
  /** Confidence in the recommendations */
  confidence: number;
  /** Alternative suggestions */
  alternatives?: AgentSpecification[];
  /** Reasoning for the recommendations */
  reasoning: string;
  /** Metadata about the identification process */
  metadata: ExpertiseIdentificationMetadata;
}

/**
 * Analysis of expertise requirements
 */
export interface ExpertiseAnalysis {
  /** Identified domains */
  domains: string[];
  /** Required capabilities */
  requiredCapabilities: Capability[];
  /** Optional capabilities */
  optionalCapabilities: Capability[];
  /** Complexity assessment */
  complexity: ComplexityAssessment;
  /** Risk factors */
  riskFactors: RiskFactor[];
  /** Resource requirements */
  resourceRequirements: ResourceRequirement[];
  /** Timeline considerations */
  timeline: TimelineConsideration[];
}

/**
 * Complexity assessment
 */
export interface ComplexityAssessment {
  /** Overall complexity level */
  overall: 'simple' | 'medium' | 'complex' | 'expert';
  /** Factors contributing to complexity */
  factors: ComplexityFactor[];
  /** Score (0-10) */
  score: number;
  /** Reasoning */
  reasoning: string;
}

/**
 * Complexity factor
 */
export interface ComplexityFactor {
  /** Name of the factor */
  name: string;
  /** Impact on complexity */
  impact: 'low' | 'medium' | 'high';
  /** Weight in overall calculation */
  weight: number;
  /** Description */
  description: string;
}

/**
 * Risk factor
 */
export interface RiskFactor {
  /** Type of risk */
  type: 'technical' | 'business' | 'operational' | 'strategic';
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Probability of occurrence */
  probability: 'low' | 'medium' | 'high';
  /** Description of the risk */
  description: string;
  /** Mitigation strategies */
  mitigation?: string[];
}

/**
 * Resource requirement
 */
export interface ResourceRequirement {
  /** Type of resource */
  type: 'human' | 'computational' | 'storage' | 'network' | 'external';
  /** Amount needed */
  amount: number;
  /** Unit of measurement */
  unit: string;
  /** Priority level */
  priority: ImportanceLevel;
  /** Description */
  description: string;
}

/**
 * Timeline consideration
 */
export interface TimelineConsideration {
  /** Type of consideration */
  type: 'dependency' | 'constraint' | 'milestone' | 'deadline';
  /** Impact on timeline */
  impact: 'blocking' | 'delaying' | 'accelerating' | 'neutral';
  /** Description */
  description: string;
  /** Estimated time impact (in milliseconds) */
  timeImpact?: number;
}

/**
 * Metadata for expertise identification
 */
export interface ExpertiseIdentificationMetadata {
  /** Processing time in milliseconds */
  processingTime: number;
  /** Number of specifications evaluated */
  specificationsEvaluated: number;
  /** Algorithm version used */
  algorithmVersion: string;
  /** Timestamp of analysis */
  timestamp: Date;
  /** Configuration used */
  configuration?: Record<string, any>;
}

/**
 * Agent matching criteria
 */
export interface AgentMatchingCriteria {
  /** Required capabilities */
  requiredCapabilities: string[];
  /** Optional capabilities */
  optionalCapabilities?: string[];
  /** Domain preferences */
  domains?: string[];
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Maximum number of matches */
  maxMatches?: number;
  /** Weighting for different criteria */
  weights?: MatchingWeights;
}

/**
 * Weighting for matching criteria
 */
export interface MatchingWeights {
  /** Weight for capability match */
  capabilities: number;
  /** Weight for domain match */
  domain: number;
  /** Weight for experience level */
  experience: number;
  /** Weight for personality fit */
  personality: number;
  /** Weight for tool availability */
  tools: number;
}

/**
 * Agent matching result
 */
export interface AgentMatchingResult {
  /** Agent specification */
  specification: AgentSpecification;
  /** Match score (0-1) */
  score: number;
  /** Breakdown of scoring */
  scoreBreakdown: ScoreBreakdown;
  /** Reasons for the match */
  matchReasons: string[];
  /** Potential concerns */
  concerns?: string[];
  /** Recommendation level */
  recommendation: 'highly-recommended' | 'recommended' | 'suitable' | 'fallback';
}

/**
 * Breakdown of matching score
 */
export interface ScoreBreakdown {
  /** Score for capability match */
  capabilities: number;
  /** Score for domain match */
  domain: number;
  /** Score for experience level */
  experience: number;
  /** Score for personality fit */
  personality: number;
  /** Score for tool availability */
  tools: number;
  /** Overall weighted score */
  total: number;
}

/**
 * Configuration for expertise identification system
 */
export interface ExpertiseIdentificationConfig {
  /** Timeout for identification process */
  timeout: number;
  /** Whether to use caching */
  enableCaching: boolean;
  /** Cache timeout in milliseconds */
  cacheTimeout: number;
  /** Whether to use AI assistance */
  useAI: boolean;
  /** AI model configuration */
  aiConfig?: {
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  /** Default weights for matching */
  defaultWeights: MatchingWeights;
  /** Fallback strategies */
  fallbackStrategies: FallbackStrategy[];
}

/**
 * Fallback strategy configuration
 */
export interface FallbackStrategy {
  /** Name of the strategy */
  name: string;
  /** When to trigger this strategy */
  trigger: 'no-matches' | 'low-confidence' | 'timeout' | 'error';
  /** Action to take */
  action: 'broaden-criteria' | 'suggest-alternatives' | 'request-human' | 'default-agent';
  /** Configuration for the action */
  config?: Record<string, any>;
}

/**
 * Events emitted by the expertise identification system
 */
export interface ExpertiseIdentificationEvents {
  'identification-started': { input: ExpertiseIdentificationInput };
  'identification-completed': { result: ExpertiseIdentificationResult };
  'identification-failed': { error: Error; input: ExpertiseIdentificationInput };
  'cache-hit': { key: string };
  'cache-miss': { key: string };
  'fallback-triggered': { strategy: FallbackStrategy; reason: string };
  'ai-analysis-started': { input: ExpertiseIdentificationInput };
  'ai-analysis-completed': { analysis: ExpertiseAnalysis };
}