/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { v4 as uuidv4 } from 'uuid';
import { MemoryDebugger } from './interfaces.js';
import { MemoryDebugInfo } from './types.js';
import { MemoryItem } from '../types.js';
import { MemoryStore } from '../interfaces.js';

/**
 * Default implementation of memory debugger
 */
export class DefaultMemoryDebugger implements MemoryDebugger {
  private memoryStore: MemoryStore;
  private debugSessions = new Map<string, DebugSession>();
  private accessTraces = new Map<string, AccessTrace[]>();

  constructor(memoryStore: MemoryStore) {
    this.memoryStore = memoryStore;
  }

  /**
   * Get detailed memory information
   */
  async getMemoryDebugInfo(memoryId: string): Promise<MemoryDebugInfo> {
    try {
      const memory = await this.memoryStore.retrieve(memoryId);
      if (!memory) {
        throw new Error(`Memory ${memoryId} not found`);
      }

      // Get access history
      const accessHistory = this.accessTraces.get(memoryId) || [];

      // Get modification history (simulated)
      const modificationHistory = this.generateModificationHistory(memory);

      // Analyze relationships
      const relationships = await this.analyzeMemoryRelationships(memory);

      // Calculate performance metrics
      const performance = await this.calculatePerformanceMetrics(memory);

      // Check health indicators
      const health = await this.checkMemoryHealth(memory);

      return {
        memory,
        accessHistory: accessHistory.map(trace => ({
          accessedAt: trace.timestamp,
          accessedBy: trace.agent,
          operation: trace.operation
        })),
        modificationHistory,
        relationships,
        performance,
        health
      };

    } catch (error) {
      throw new Error(`Failed to get memory debug info: ${(error as Error).message}`);
    }
  }

  /**
   * Trace memory access path
   */
  async traceMemoryAccess(memoryId: string): Promise<Array<{
    timestamp: Date;
    operation: string;
    agent: string;
    details: any;
  }>> {
    try {
      const traces = this.accessTraces.get(memoryId) || [];
      return traces.map(trace => ({
        timestamp: trace.timestamp,
        operation: trace.operation,
        agent: trace.agent,
        details: trace.details
      }));

    } catch (error) {
      throw new Error(`Failed to trace memory access: ${(error as Error).message}`);
    }
  }

  /**
   * Find memory inconsistencies
   */
  async findInconsistencies(agentId?: string): Promise<Array<{
    memoryId: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    suggestions: string[];
  }>> {
    const inconsistencies: Array<{
      memoryId: string;
      issue: string;
      severity: 'low' | 'medium' | 'high';
      description: string;
      suggestions: string[];
    }> = [];

    try {
      const searchResult = await this.memoryStore.search(agentId ? { agentId } : {});
      const memories = searchResult.items;

      for (const memory of memories) {
        const issues = await this.checkMemoryConsistency(memory);
        inconsistencies.push(...issues);
      }

      return inconsistencies;

    } catch (error) {
      throw new Error(`Failed to find inconsistencies: ${(error as Error).message}`);
    }
  }

  /**
   * Analyze memory relationships
   */
  async analyzeRelationships(memoryId: string): Promise<{
    directRelations: string[];
    indirectRelations: string[];
    orphanedMemories: string[];
    relationshipStrength: Map<string, number>;
  }> {
    try {
      const memory = await this.memoryStore.retrieve(memoryId);
      if (!memory) {
        throw new Error(`Memory ${memoryId} not found`);
      }

      const directRelations = memory.relationships || [];
      const indirectRelations = await this.findIndirectRelations(memoryId, directRelations);
      const orphanedMemories = await this.findOrphanedMemories();
      const relationshipStrength = await this.calculateRelationshipStrengths(memoryId);

      return {
        directRelations,
        indirectRelations,
        orphanedMemories,
        relationshipStrength
      };

    } catch (error) {
      throw new Error(`Failed to analyze relationships: ${(error as Error).message}`);
    }
  }

  /**
   * Get memory dependency graph
   */
  async getDependencyGraph(memoryId: string): Promise<{
    dependencies: string[];
    dependents: string[];
    graph: any;
  }> {
    try {
      const memory = await this.memoryStore.retrieve(memoryId);
      if (!memory) {
        throw new Error(`Memory ${memoryId} not found`);
      }

      const dependencies = await this.findDependencies(memoryId);
      const dependents = await this.findDependents(memoryId);
      const graph = await this.buildDependencyGraph(memoryId, dependencies, dependents);

      return {
        dependencies,
        dependents,
        graph
      };

    } catch (error) {
      throw new Error(`Failed to get dependency graph: ${(error as Error).message}`);
    }
  }

  /**
   * Validate memory data
   */
  async validateMemoryData(memoryId: string): Promise<{
    valid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    try {
      const memory = await this.memoryStore.retrieve(memoryId);
      if (!memory) {
        issues.push('Memory not found');
        return { valid: false, issues, suggestions };
      }

      // Validate structure
      if (!memory.id) {
        issues.push('Missing memory ID');
        suggestions.push('Regenerate memory with valid ID');
      }

      if (!memory.type) {
        issues.push('Missing memory type');
        suggestions.push('Assign a valid memory type');
      }

      if (!memory.agentId) {
        issues.push('Missing agent ID');
        suggestions.push('Associate memory with a valid agent');
      }

      if (!memory.content) {
        issues.push('Missing memory content');
        suggestions.push('Ensure memory has valid content');
      }

      if (!memory.metadata) {
        issues.push('Missing memory metadata');
        suggestions.push('Add metadata with creation time and access count');
      }

      // Validate relationships
      if (memory.relationships) {
        for (const relatedId of memory.relationships) {
          try {
            const relatedMemory = await this.memoryStore.retrieve(relatedId);
            if (!relatedMemory) {
              issues.push(`Related memory ${relatedId} not found`);
              suggestions.push(`Remove invalid relationship to ${relatedId}`);
            }
          } catch {
            issues.push(`Cannot access related memory ${relatedId}`);
            suggestions.push(`Verify relationship to ${relatedId}`);
          }
        }
      }

      // Validate embeddings
      if (memory.embeddings) {
        if (!Array.isArray(memory.embeddings) || memory.embeddings.length === 0) {
          issues.push('Invalid embeddings format');
          suggestions.push('Regenerate embeddings for memory');
        }
      }

      return {
        valid: issues.length === 0,
        issues,
        suggestions
      };

    } catch (error) {
      issues.push(`Validation failed: ${(error as Error).message}`);
      return { valid: false, issues, suggestions };
    }
  }

  /**
   * Start debug session
   */
  async startDebugSession(agentId?: string): Promise<{
    sessionId: string;
    startedAt: Date;
    configuration: any;
  }> {
    const sessionId = uuidv4();
    const startedAt = new Date();
    
    const session: DebugSession = {
      id: sessionId,
      agentId,
      startedAt,
      configuration: {
        traceAccess: true,
        trackModifications: true,
        validateConsistency: true,
        monitorPerformance: true
      },
      findings: []
    };

    this.debugSessions.set(sessionId, session);

    return {
      sessionId,
      startedAt,
      configuration: session.configuration
    };
  }

  /**
   * End debug session
   */
  async endDebugSession(sessionId: string): Promise<{
    sessionId: string;
    duration: number;
    findings: any[];
  }> {
    const session = this.debugSessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session ${sessionId} not found`);
    }

    const endedAt = new Date();
    const duration = endedAt.getTime() - session.startedAt.getTime();

    // Compile findings
    const findings = [...session.findings];

    // Remove session
    this.debugSessions.delete(sessionId);

    return {
      sessionId,
      duration,
      findings
    };
  }

  /**
   * Track memory access for debugging
   */
  trackAccess(memoryId: string, operation: string, agent: string, details: any): void {
    if (!this.accessTraces.has(memoryId)) {
      this.accessTraces.set(memoryId, []);
    }

    const trace: AccessTrace = {
      timestamp: new Date(),
      operation,
      agent,
      details
    };

    this.accessTraces.get(memoryId)!.push(trace);

    // Keep only recent traces (last 100)
    const traces = this.accessTraces.get(memoryId)!;
    if (traces.length > 100) {
      this.accessTraces.set(memoryId, traces.slice(-100));
    }
  }

  /**
   * Generate modification history (simulated)
   */
  private generateModificationHistory(memory: MemoryItem): Array<{
    modifiedAt: Date;
    modifiedBy: string;
    changes: Record<string, any>;
  }> {
    // In a real implementation, this would track actual modifications
    return [
      {
        modifiedAt: memory.metadata?.createdAt as Date || new Date(),
        modifiedBy: memory.agentId,
        changes: {
          operation: 'created',
          fields: ['id', 'type', 'content', 'metadata']
        }
      }
    ];
  }

  /**
   * Analyze memory relationships
   */
  private async analyzeMemoryRelationships(memory: MemoryItem): Promise<{
    related: string[];
    references: string[];
    referencedBy: string[];
  }> {
    const related = memory.relationships || [];
    const references: string[] = [];
    const referencedBy: string[] = [];

    // Find memories that reference this memory
    try {
      const searchResult = await this.memoryStore.search({});
      const allMemories = searchResult.items;

      for (const otherMemory of allMemories) {
        if (otherMemory.id !== memory.id && otherMemory.relationships) {
          if (otherMemory.relationships.includes(memory.id)) {
            referencedBy.push(otherMemory.id);
          }
        }
      }

      // Find memories referenced by this memory
      for (const relatedId of related) {
        references.push(relatedId);
      }

    } catch (error) {
      console.warn('Failed to analyze relationships:', error);
    }

    return { related, references, referencedBy };
  }

  /**
   * Calculate performance metrics
   */
  private async calculatePerformanceMetrics(memory: MemoryItem): Promise<{
    retrievalTime: number;
    storageSize: number;
    compressionRatio: number;
  }> {
    const storageSize = JSON.stringify(memory).length;
    
    return {
      retrievalTime: 50, // Simulated retrieval time in ms
      storageSize,
      compressionRatio: 0.7 // Simulated compression ratio
    };
  }

  /**
   * Check memory health
   */
  private async checkMemoryHealth(memory: MemoryItem): Promise<{
    integrity: boolean;
    consistency: boolean;
    accessibility: boolean;
  }> {
    const integrity = !!(memory.id && memory.type && memory.content);
    const consistency = this.checkDataConsistency(memory);
    const accessibility = true; // Memory was successfully retrieved

    return {
      integrity,
      consistency,
      accessibility
    };
  }

  /**
   * Check memory consistency
   */
  private async checkMemoryConsistency(memory: MemoryItem): Promise<Array<{
    memoryId: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    suggestions: string[];
  }>> {
    const issues: Array<{
      memoryId: string;
      issue: string;
      severity: 'low' | 'medium' | 'high';
      description: string;
      suggestions: string[];
    }> = [];

    // Check for orphaned relationships
    if (memory.relationships) {
      for (const relatedId of memory.relationships) {
        try {
          const relatedMemory = await this.memoryStore.retrieve(relatedId);
          if (!relatedMemory) {
            issues.push({
              memoryId: memory.id,
              issue: 'Orphaned relationship',
              severity: 'medium',
              description: `Memory references non-existent memory ${relatedId}`,
              suggestions: ['Remove invalid relationship', 'Restore missing memory']
            });
          }
        } catch {
          issues.push({
            memoryId: memory.id,
            issue: 'Inaccessible relationship',
            severity: 'high',
            description: `Cannot access related memory ${relatedId}`,
            suggestions: ['Check memory store integrity', 'Remove invalid relationship']
          });
        }
      }
    }

    // Check for missing metadata
    if (!memory.metadata) {
      issues.push({
        memoryId: memory.id,
        issue: 'Missing metadata',
        severity: 'low',
        description: 'Memory lacks metadata information',
        suggestions: ['Add metadata with creation time and access count']
      });
    }

    return issues;
  }

  /**
   * Check data consistency
   */
  private checkDataConsistency(memory: MemoryItem): boolean {
    // Basic consistency checks
    if (!memory.id || !memory.type || !memory.agentId) {
      return false;
    }

    // Check if embeddings are valid
    if (memory.embeddings && (!Array.isArray(memory.embeddings) || memory.embeddings.length === 0)) {
      return false;
    }

    return true;
  }

  /**
   * Find indirect relations
   */
  private async findIndirectRelations(memoryId: string, directRelations: string[]): Promise<string[]> {
    const indirectRelations = new Set<string>();

    for (const directId of directRelations) {
      try {
        const directMemory = await this.memoryStore.retrieve(directId);
        if (directMemory && directMemory.relationships) {
          for (const indirectId of directMemory.relationships) {
            if (indirectId !== memoryId && !directRelations.includes(indirectId)) {
              indirectRelations.add(indirectId);
            }
          }
        }
      } catch {
        // Memory not accessible
      }
    }

    return Array.from(indirectRelations);
  }

  /**
   * Find orphaned memories
   */
  private async findOrphanedMemories(): Promise<string[]> {
    const orphaned: string[] = [];

    try {
      const searchResult = await this.memoryStore.search({});
      const memories = searchResult.items;

      for (const memory of memories) {
        if (!memory.relationships || memory.relationships.length === 0) {
          // Check if this memory is referenced by others
          const isReferenced = memories.some(other => 
            other.id !== memory.id && 
            other.relationships && 
            other.relationships.includes(memory.id)
          );

          if (!isReferenced) {
            orphaned.push(memory.id);
          }
        }
      }

    } catch (error) {
      console.warn('Failed to find orphaned memories:', error);
    }

    return orphaned;
  }

  /**
   * Calculate relationship strengths
   */
  private async calculateRelationshipStrengths(memoryId: string): Promise<Map<string, number>> {
    const strengths = new Map<string, number>();

    try {
      const memory = await this.memoryStore.retrieve(memoryId);
      if (memory && memory.relationships) {
        for (const relatedId of memory.relationships) {
          // Calculate strength based on various factors
          const strength = this.calculateRelationshipStrength(memory, relatedId);
          strengths.set(relatedId, strength);
        }
      }

    } catch (error) {
      console.warn('Failed to calculate relationship strengths:', error);
    }

    return strengths;
  }

  /**
   * Calculate individual relationship strength
   */
  private calculateRelationshipStrength(memory: MemoryItem, relatedId: string): number {
    // Simplified strength calculation
    // In reality, this would consider multiple factors
    return Math.random() * 0.5 + 0.5; // Random value between 0.5 and 1.0
  }

  /**
   * Find dependencies
   */
  private async findDependencies(memoryId: string): Promise<string[]> {
    const memory = await this.memoryStore.retrieve(memoryId);
    return memory?.relationships || [];
  }

  /**
   * Find dependents
   */
  private async findDependents(memoryId: string): Promise<string[]> {
    const dependents: string[] = [];

    try {
      const searchResult = await this.memoryStore.search({});
      const memories = searchResult.items;

      for (const memory of memories) {
        if (memory.relationships && memory.relationships.includes(memoryId)) {
          dependents.push(memory.id);
        }
      }

    } catch (error) {
      console.warn('Failed to find dependents:', error);
    }

    return dependents;
  }

  /**
   * Build dependency graph
   */
  private async buildDependencyGraph(memoryId: string, dependencies: string[], dependents: string[]): Promise<any> {
    const nodes = [{ id: memoryId, label: memoryId, type: 'main' }];
    const edges: any[] = [];

    // Add dependency nodes and edges
    for (const depId of dependencies) {
      nodes.push({ id: depId, label: depId, type: 'dependency' });
      edges.push({ from: memoryId, to: depId, label: 'depends on' });
    }

    // Add dependent nodes and edges
    for (const depId of dependents) {
      nodes.push({ id: depId, label: depId, type: 'dependent' });
      edges.push({ from: depId, to: memoryId, label: 'depends on' });
    }

    return { nodes, edges };
  }
}

/**
 * Debug session interface
 */
interface DebugSession {
  id: string;
  agentId?: string;
  startedAt: Date;
  configuration: any;
  findings: any[];
}

/**
 * Access trace interface
 */
interface AccessTrace {
  timestamp: Date;
  operation: string;
  agent: string;
  details: any;
}