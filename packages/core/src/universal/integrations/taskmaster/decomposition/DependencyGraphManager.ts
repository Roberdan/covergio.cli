/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  DependencyGraph, 
  DependencyNode, 
  ValidationError, 
  ValidationWarning 
} from './types.js';
import { 
  TaskDecomposition, 
  SubtaskDefinition, 
  DependencyDefinition 
} from '../types.js';

/**
 * Manages dependency graphs for task decomposition
 */
export class DependencyGraphManager {
  private graphs = new Map<string, DependencyGraph>();

  /**
   * Build a dependency graph from decomposition
   */
  buildGraph(decomposition: TaskDecomposition): DependencyGraph {
    const graph: DependencyGraph = {
      nodes: new Map(),
      edges: decomposition.dependencies || [],
      levels: [],
      criticalPath: [],
      parallelGroups: []
    };

    // Create nodes for each subtask
    for (const subtask of decomposition.subtasks) {
      const node: DependencyNode = {
        id: subtask.id,
        subtask,
        dependencies: subtask.dependencies || [],
        dependents: [],
        level: 0,
        canRunInParallel: subtask.canRunInParallel,
        criticalPath: false
      };
      graph.nodes.set(subtask.id, node);
    }

    // Build dependency relationships
    this.buildDependencyRelationships(graph);

    // Calculate levels (topological sort)
    this.calculateLevels(graph);

    // Identify critical path
    this.identifyCriticalPath(graph);

    // Identify parallel groups
    this.identifyParallelGroups(graph);

    return graph;
  }

  /**
   * Validate dependency graph for issues
   */
  validateGraph(graph: DependencyGraph): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for circular dependencies
    const circularDeps = this.detectCircularDependencies(graph);
    for (const cycle of circularDeps) {
      errors.push({
        type: 'circular-dependency',
        message: `Circular dependency detected: ${cycle.join(' -> ')}`,
        severity: 'error',
        fix: 'Remove one of the dependencies in the cycle'
      });
    }

    // Check for missing dependencies
    for (const [nodeId, node] of graph.nodes) {
      for (const depId of node.dependencies) {
        if (!graph.nodes.has(depId)) {
          errors.push({
            type: 'missing-dependency',
            message: `Subtask '${nodeId}' depends on non-existent subtask '${depId}'`,
            subtaskId: nodeId,
            dependencyId: depId,
            severity: 'error',
            fix: 'Add the missing subtask or remove the dependency'
          });
        }
      }
    }

    // Check for isolated nodes
    for (const [nodeId, node] of graph.nodes) {
      if (node.dependencies.length === 0 && node.dependents.length === 0 && graph.nodes.size > 1) {
        warnings.push({
          type: 'performance',
          message: `Subtask '${nodeId}' has no dependencies or dependents`,
          subtaskId: nodeId,
          impact: 'low',
          recommendation: 'Consider if this subtask should be integrated with others'
        });
      }
    }

    // Check for overly complex dependencies
    for (const [nodeId, node] of graph.nodes) {
      if (node.dependencies.length > 5) {
        warnings.push({
          type: 'complexity',
          message: `Subtask '${nodeId}' has too many dependencies (${node.dependencies.length})`,
          subtaskId: nodeId,
          impact: 'medium',
          recommendation: 'Consider breaking down this subtask or reducing dependencies'
        });
      }
    }

    // Check for long critical paths
    if (graph.criticalPath.length > 10) {
      warnings.push({
        type: 'timeline',
        message: `Critical path is very long (${graph.criticalPath.length} tasks)`,
        impact: 'high',
        recommendation: 'Consider parallelizing some tasks or reducing the critical path'
      });
    }

    return { errors, warnings };
  }

  /**
   * Optimize dependency graph
   */
  optimizeGraph(graph: DependencyGraph): DependencyGraph {
    const optimized = this.cloneGraph(graph);

    // Identify optimization opportunities
    this.optimizeParallelism(optimized);
    this.optimizeCriticalPath(optimized);
    this.optimizeResourceUsage(optimized);

    return optimized;
  }

  /**
   * Get execution order for subtasks
   */
  getExecutionOrder(graph: DependencyGraph): string[][] {
    return graph.levels.filter(level => level.length > 0);
  }

  /**
   * Check if subtask can be executed
   */
  canExecute(graph: DependencyGraph, subtaskId: string, completedTasks: Set<string>): boolean {
    const node = graph.nodes.get(subtaskId);
    if (!node) return false;

    // Check if all dependencies are completed
    for (const depId of node.dependencies) {
      if (!completedTasks.has(depId)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get next executable subtasks
   */
  getNextExecutable(graph: DependencyGraph, completedTasks: Set<string>, runningTasks: Set<string>): string[] {
    const executable: string[] = [];

    for (const [subtaskId, node] of graph.nodes) {
      if (completedTasks.has(subtaskId) || runningTasks.has(subtaskId)) {
        continue;
      }

      if (this.canExecute(graph, subtaskId, completedTasks)) {
        executable.push(subtaskId);
      }
    }

    return executable;
  }

  /**
   * Calculate estimated completion time
   */
  calculateEstimatedTime(graph: DependencyGraph): number {
    let maxTime = 0;

    for (const level of graph.levels) {
      let levelTime = 0;
      
      for (const subtaskId of level) {
        const node = graph.nodes.get(subtaskId);
        if (node) {
          levelTime = Math.max(levelTime, node.subtask.estimatedDuration);
        }
      }
      
      maxTime += levelTime;
    }

    return maxTime;
  }

  /**
   * Get graph statistics
   */
  getGraphStatistics(graph: DependencyGraph): {
    totalNodes: number;
    totalEdges: number;
    maxLevel: number;
    criticalPathLength: number;
    parallelism: number;
    complexity: number;
  } {
    const parallelism = Math.max(...graph.levels.map(level => level.length));
    const complexity = graph.edges.length / Math.max(1, graph.nodes.size);

    return {
      totalNodes: graph.nodes.size,
      totalEdges: graph.edges.length,
      maxLevel: graph.levels.length,
      criticalPathLength: graph.criticalPath.length,
      parallelism,
      complexity
    };
  }

  private buildDependencyRelationships(graph: DependencyGraph): void {
    // Build dependents list for each node
    for (const [nodeId, node] of graph.nodes) {
      for (const depId of node.dependencies) {
        const depNode = graph.nodes.get(depId);
        if (depNode) {
          depNode.dependents.push(nodeId);
        }
      }
    }
  }

  private calculateLevels(graph: DependencyGraph): void {
    const levels: string[][] = [];
    const visited = new Set<string>();
    const inDegree = new Map<string, number>();

    // Calculate in-degree for each node
    for (const [nodeId, node] of graph.nodes) {
      inDegree.set(nodeId, node.dependencies.length);
    }

    // Process nodes level by level
    let currentLevel = 0;
    
    while (visited.size < graph.nodes.size) {
      const currentLevelNodes: string[] = [];
      
      // Find nodes with no unresolved dependencies
      for (const [nodeId, degree] of inDegree) {
        if (degree === 0 && !visited.has(nodeId)) {
          currentLevelNodes.push(nodeId);
          visited.add(nodeId);
          
          const node = graph.nodes.get(nodeId);
          if (node) {
            node.level = currentLevel;
          }
        }
      }
      
      if (currentLevelNodes.length === 0) {
        // Circular dependency detected
        break;
      }
      
      levels.push(currentLevelNodes);
      
      // Reduce in-degree for dependent nodes
      for (const nodeId of currentLevelNodes) {
        const node = graph.nodes.get(nodeId);
        if (node) {
          for (const dependentId of node.dependents) {
            const currentDegree = inDegree.get(dependentId) || 0;
            inDegree.set(dependentId, currentDegree - 1);
          }
        }
      }
      
      currentLevel++;
    }

    graph.levels = levels;
  }

  private identifyCriticalPath(graph: DependencyGraph): void {
    const criticalPath: string[] = [];
    const nodeTimes = new Map<string, number>();

    // Calculate earliest start time for each node
    for (const level of graph.levels) {
      for (const nodeId of level) {
        const node = graph.nodes.get(nodeId);
        if (!node) continue;

        let earliestStart = 0;
        for (const depId of node.dependencies) {
          const depTime = nodeTimes.get(depId) || 0;
          const depNode = graph.nodes.get(depId);
          if (depNode) {
            earliestStart = Math.max(earliestStart, depTime + depNode.subtask.estimatedDuration);
          }
        }

        nodeTimes.set(nodeId, earliestStart);
      }
    }

    // Find the longest path
    let maxEndTime = 0;
    let lastNode = '';
    
    for (const [nodeId, startTime] of nodeTimes) {
      const node = graph.nodes.get(nodeId);
      if (node) {
        const endTime = startTime + node.subtask.estimatedDuration;
        if (endTime > maxEndTime) {
          maxEndTime = endTime;
          lastNode = nodeId;
        }
      }
    }

    // Trace back the critical path
    if (lastNode) {
      this.traceCriticalPath(graph, lastNode, nodeTimes, criticalPath);
    }

    graph.criticalPath = criticalPath.reverse();

    // Mark nodes on critical path
    for (const nodeId of graph.criticalPath) {
      const node = graph.nodes.get(nodeId);
      if (node) {
        node.criticalPath = true;
      }
    }
  }

  private traceCriticalPath(
    graph: DependencyGraph, 
    nodeId: string, 
    nodeTimes: Map<string, number>, 
    path: string[]
  ): void {
    path.push(nodeId);
    
    const node = graph.nodes.get(nodeId);
    if (!node) return;

    const nodeTime = nodeTimes.get(nodeId) || 0;
    
    // Find the dependency that determines the critical path
    for (const depId of node.dependencies) {
      const depTime = nodeTimes.get(depId) || 0;
      const depNode = graph.nodes.get(depId);
      
      if (depNode && depTime + depNode.subtask.estimatedDuration === nodeTime) {
        this.traceCriticalPath(graph, depId, nodeTimes, path);
        break;
      }
    }
  }

  private identifyParallelGroups(graph: DependencyGraph): void {
    const parallelGroups: string[][] = [];
    
    for (const level of graph.levels) {
      if (level.length > 1) {
        // Group nodes that can run in parallel
        const groups: string[][] = [];
        const processed = new Set<string>();
        
        for (const nodeId of level) {
          if (processed.has(nodeId)) continue;
          
          const group = [nodeId];
          processed.add(nodeId);
          
          // Find other nodes in the same level that can run in parallel
          for (const otherId of level) {
            if (otherId !== nodeId && !processed.has(otherId)) {
              const node = graph.nodes.get(nodeId);
              const otherNode = graph.nodes.get(otherId);
              
              if (node && otherNode && node.canRunInParallel && otherNode.canRunInParallel) {
                group.push(otherId);
                processed.add(otherId);
              }
            }
          }
          
          if (group.length > 1) {
            groups.push(group);
          }
        }
        
        parallelGroups.push(...groups);
      }
    }
    
    graph.parallelGroups = parallelGroups;
  }

  private detectCircularDependencies(graph: DependencyGraph): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const [nodeId] of graph.nodes) {
      if (!visited.has(nodeId)) {
        const path: string[] = [];
        this.detectCycleDFS(graph, nodeId, visited, recursionStack, path, cycles);
      }
    }

    return cycles;
  }

  private detectCycleDFS(
    graph: DependencyGraph,
    nodeId: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[],
    cycles: string[][]
  ): void {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const node = graph.nodes.get(nodeId);
    if (node) {
      for (const depId of node.dependencies) {
        if (!visited.has(depId)) {
          this.detectCycleDFS(graph, depId, visited, recursionStack, path, cycles);
        } else if (recursionStack.has(depId)) {
          // Found a cycle
          const cycleStart = path.indexOf(depId);
          const cycle = path.slice(cycleStart);
          cycle.push(depId);
          cycles.push(cycle);
        }
      }
    }

    recursionStack.delete(nodeId);
    path.pop();
  }

  private optimizeParallelism(graph: DependencyGraph): void {
    // Look for opportunities to increase parallelism
    for (const [nodeId, node] of graph.nodes) {
      if (!node.canRunInParallel) {
        // Check if this node can be made parallel
        const hasConflictingDependencies = this.hasResourceConflicts(graph, nodeId);
        if (!hasConflictingDependencies) {
          node.canRunInParallel = true;
          node.subtask.canRunInParallel = true;
        }
      }
    }
  }

  private optimizeCriticalPath(graph: DependencyGraph): void {
    // Look for opportunities to reduce the critical path
    for (const nodeId of graph.criticalPath) {
      const node = graph.nodes.get(nodeId);
      if (node) {
        // Check if any dependencies can be removed or parallelized
        const unnecessaryDeps = this.findUnnecessaryDependencies(graph, nodeId);
        for (const depId of unnecessaryDeps) {
          const depIndex = node.dependencies.indexOf(depId);
          if (depIndex > -1) {
            node.dependencies.splice(depIndex, 1);
            node.subtask.dependencies = node.dependencies;
          }
        }
      }
    }
  }

  private optimizeResourceUsage(graph: DependencyGraph): void {
    // Optimize resource usage across parallel tasks
    for (const group of graph.parallelGroups) {
      this.balanceResourceUsage(graph, group);
    }
  }

  private hasResourceConflicts(graph: DependencyGraph, nodeId: string): boolean {
    const node = graph.nodes.get(nodeId);
    if (!node) return false;

    // Check for resource conflicts with other nodes at the same level
    const level = node.level;
    
    for (const [otherId, otherNode] of graph.nodes) {
      if (otherId !== nodeId && otherNode.level === level) {
        if (this.hasResourceOverlap(node.subtask, otherNode.subtask)) {
          return true;
        }
      }
    }

    return false;
  }

  private hasResourceOverlap(subtask1: SubtaskDefinition, subtask2: SubtaskDefinition): boolean {
    const resources1 = subtask1.resources || [];
    const resources2 = subtask2.resources || [];
    
    return resources1.some(resource => resources2.includes(resource));
  }

  private findUnnecessaryDependencies(graph: DependencyGraph, nodeId: string): string[] {
    const node = graph.nodes.get(nodeId);
    if (!node) return [];

    const unnecessary: string[] = [];
    
    for (const depId of node.dependencies) {
      // Check if this dependency is transitively covered by other dependencies
      if (this.isTransitiveDependency(graph, nodeId, depId)) {
        unnecessary.push(depId);
      }
    }

    return unnecessary;
  }

  private isTransitiveDependency(graph: DependencyGraph, nodeId: string, depId: string): boolean {
    const node = graph.nodes.get(nodeId);
    if (!node) return false;

    // Check if depId is reachable through other dependencies
    for (const otherDepId of node.dependencies) {
      if (otherDepId !== depId && this.isReachable(graph, otherDepId, depId)) {
        return true;
      }
    }

    return false;
  }

  private isReachable(graph: DependencyGraph, fromId: string, toId: string): boolean {
    const visited = new Set<string>();
    const queue = [fromId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (currentId === toId) return true;
      
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const node = graph.nodes.get(currentId);
      if (node) {
        queue.push(...node.dependencies);
      }
    }

    return false;
  }

  private balanceResourceUsage(graph: DependencyGraph, group: string[]): void {
    // Balance resource usage across parallel tasks
    const resources = new Map<string, string[]>();
    
    for (const nodeId of group) {
      const node = graph.nodes.get(nodeId);
      if (node && node.subtask.resources) {
        for (const resource of node.subtask.resources) {
          if (!resources.has(resource)) {
            resources.set(resource, []);
          }
          resources.get(resource)!.push(nodeId);
        }
      }
    }

    // Identify overused resources and rebalance
    for (const [resource, users] of resources) {
      if (users.length > 1) {
        // Try to reduce resource contention
        this.redistributeResource(graph, resource, users);
      }
    }
  }

  private redistributeResource(graph: DependencyGraph, resource: string, users: string[]): void {
    // Simple strategy: try to sequence tasks using the same resource
    for (let i = 1; i < users.length; i++) {
      const currentNode = graph.nodes.get(users[i]);
      const previousNode = graph.nodes.get(users[i - 1]);
      
      if (currentNode && previousNode && !currentNode.dependencies.includes(users[i - 1])) {
        currentNode.dependencies.push(users[i - 1]);
        currentNode.subtask.dependencies = currentNode.dependencies;
        previousNode.dependents.push(users[i]);
      }
    }
  }

  private cloneGraph(graph: DependencyGraph): DependencyGraph {
    const cloned: DependencyGraph = {
      nodes: new Map(),
      edges: [...graph.edges],
      levels: graph.levels.map(level => [...level]),
      criticalPath: [...graph.criticalPath],
      parallelGroups: graph.parallelGroups.map(group => [...group])
    };

    // Deep clone nodes
    for (const [nodeId, node] of graph.nodes) {
      cloned.nodes.set(nodeId, {
        id: node.id,
        subtask: { ...node.subtask },
        dependencies: [...node.dependencies],
        dependents: [...node.dependents],
        level: node.level,
        canRunInParallel: node.canRunInParallel,
        criticalPath: node.criticalPath
      });
    }

    return cloned;
  }
}