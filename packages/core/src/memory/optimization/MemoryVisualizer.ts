/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { MemoryVisualizer } from './interfaces.js';
import { MemoryVisualizationData } from './types.js';
import { MemoryItem } from '../types.js';
import { MemoryStore } from '../interfaces.js';

/**
 * Default implementation of memory visualizer
 */
export class DefaultMemoryVisualizer implements MemoryVisualizer {
  private memoryStore: MemoryStore;

  constructor(memoryStore: MemoryStore) {
    this.memoryStore = memoryStore;
  }

  /**
   * Generate memory network graph
   */
  async generateNetworkGraph(agentId?: string): Promise<MemoryVisualizationData> {
    try {
      const searchResult = await this.memoryStore.search(agentId ? { agentId } : {});
      const memories = searchResult.items;

      // Create nodes and edges
      const nodes = memories.map(memory => ({
        id: memory.id,
        label: memory.type,
        group: memory.agentId,
        size: (memory.metadata?.accessCount || 0) + 5,
        color: this.getColorForType(memory.type),
        title: `${memory.type} - ${memory.agentId}`,
        metadata: {
          type: memory.type,
          agentId: memory.agentId,
          accessCount: memory.metadata?.accessCount || 0,
          createdAt: memory.metadata?.createdAt
        }
      }));

      const edges = this.generateEdges(memories);

      return {
        type: 'network',
        data: {
          nodes,
          edges,
          layout: {
            hierarchical: false,
            randomSeed: 42
          }
        },
        metadata: {
          title: 'Memory Network Graph',
          description: 'Visualization of memory relationships and connections',
          generatedAt: new Date(),
          agentIds: agentId ? [agentId] : Array.from(new Set(memories.map(m => m.agentId))),
          memoryCount: memories.length
        },
        config: {
          width: 1200,
          height: 800,
          interactive: true,
          theme: 'light',
          layout: 'force-directed'
        }
      };

    } catch (error) {
      throw new Error(`Failed to generate network graph: ${(error as Error).message}`);
    }
  }

  /**
   * Generate memory timeline
   */
  async generateTimeline(agentId?: string, timeRange?: {
    start: Date;
    end: Date;
  }): Promise<MemoryVisualizationData> {
    try {
      const searchResult = await this.memoryStore.search(agentId ? { agentId } : {});
      let memories = searchResult.items;

      // Filter by time range if provided
      if (timeRange) {
        memories = memories.filter(memory => {
          const createdAt = memory.metadata?.createdAt as Date;
          return createdAt && createdAt >= timeRange.start && createdAt <= timeRange.end;
        });
      }

      // Sort by creation time
      memories.sort((a, b) => {
        const aTime = (a.metadata?.createdAt as Date)?.getTime() || 0;
        const bTime = (b.metadata?.createdAt as Date)?.getTime() || 0;
        return aTime - bTime;
      });

      // Create timeline data
      const timelineData = memories.map(memory => ({
        id: memory.id,
        content: memory.type,
        start: memory.metadata?.createdAt || new Date(),
        group: memory.agentId,
        className: `memory-${memory.type}`,
        title: `${memory.type} - ${memory.agentId}`,
        metadata: {
          type: memory.type,
          agentId: memory.agentId,
          accessCount: memory.metadata?.accessCount || 0
        }
      }));

      // Create groups for agents
      const agentGroups = Array.from(new Set(memories.map(m => m.agentId))).map(agentId => ({
        id: agentId,
        content: agentId,
        order: agentId
      }));

      return {
        type: 'timeline',
        data: {
          items: timelineData,
          groups: agentGroups,
          options: {
            start: timeRange?.start,
            end: timeRange?.end,
            zoomable: true,
            moveable: true
          }
        },
        metadata: {
          title: 'Memory Timeline',
          description: 'Timeline view of memory creation and access patterns',
          generatedAt: new Date(),
          agentIds: agentId ? [agentId] : Array.from(new Set(memories.map(m => m.agentId))),
          memoryCount: memories.length
        },
        config: {
          width: 1200,
          height: 400,
          interactive: true,
          theme: 'light',
          layout: 'timeline'
        }
      };

    } catch (error) {
      throw new Error(`Failed to generate timeline: ${(error as Error).message}`);
    }
  }

  /**
   * Generate memory heatmap
   */
  async generateHeatmap(agentId?: string): Promise<MemoryVisualizationData> {
    try {
      const searchResult = await this.memoryStore.search(agentId ? { agentId } : {});
      const memories = searchResult.items;

      // Create heatmap data based on access patterns
      const heatmapData = this.generateHeatmapData(memories);

      return {
        type: 'heatmap',
        data: {
          matrix: heatmapData.matrix,
          xLabels: heatmapData.xLabels,
          yLabels: heatmapData.yLabels,
          colorScale: {
            min: 0,
            max: heatmapData.maxValue,
            colors: ['#f7fbff', '#08306b']
          }
        },
        metadata: {
          title: 'Memory Access Heatmap',
          description: 'Visualization of memory access patterns by type and agent',
          generatedAt: new Date(),
          agentIds: agentId ? [agentId] : Array.from(new Set(memories.map(m => m.agentId))),
          memoryCount: memories.length
        },
        config: {
          width: 800,
          height: 600,
          interactive: true,
          theme: 'light',
          layout: 'heatmap'
        }
      };

    } catch (error) {
      throw new Error(`Failed to generate heatmap: ${(error as Error).message}`);
    }
  }

  /**
   * Generate memory tree structure
   */
  async generateTreeStructure(agentId?: string): Promise<MemoryVisualizationData> {
    try {
      const searchResult = await this.memoryStore.search(agentId ? { agentId } : {});
      const memories = searchResult.items;

      // Create tree structure grouped by agents and types
      const treeData = this.generateTreeData(memories);

      return {
        type: 'tree',
        data: {
          name: 'Memory Structure',
          children: treeData,
          layout: {
            orientation: 'vertical',
            separation: 150
          }
        },
        metadata: {
          title: 'Memory Tree Structure',
          description: 'Hierarchical view of memory organization',
          generatedAt: new Date(),
          agentIds: agentId ? [agentId] : Array.from(new Set(memories.map(m => m.agentId))),
          memoryCount: memories.length
        },
        config: {
          width: 1000,
          height: 800,
          interactive: true,
          theme: 'light',
          layout: 'tree'
        }
      };

    } catch (error) {
      throw new Error(`Failed to generate tree structure: ${(error as Error).message}`);
    }
  }

  /**
   * Generate access pattern visualization
   */
  async generateAccessPatternVisualization(agentId?: string): Promise<MemoryVisualizationData> {
    try {
      const searchResult = await this.memoryStore.search(agentId ? { agentId } : {});
      const memories = searchResult.items;

      // Analyze access patterns
      const accessPatterns = this.analyzeAccessPatterns(memories);

      return {
        type: 'graph',
        data: {
          datasets: [
            {
              label: 'Access Count by Hour',
              data: accessPatterns.hourlyAccess,
              backgroundColor: 'rgba(54, 162, 235, 0.6)',
              borderColor: 'rgba(54, 162, 235, 1)',
              borderWidth: 1
            },
            {
              label: 'Memory Types',
              data: accessPatterns.typeDistribution,
              backgroundColor: [
                'rgba(255, 99, 132, 0.6)',
                'rgba(54, 162, 235, 0.6)',
                'rgba(255, 205, 86, 0.6)',
                'rgba(75, 192, 192, 0.6)',
                'rgba(153, 102, 255, 0.6)'
              ]
            }
          ],
          labels: accessPatterns.labels
        },
        metadata: {
          title: 'Memory Access Patterns',
          description: 'Analysis of memory access frequency and patterns',
          generatedAt: new Date(),
          agentIds: agentId ? [agentId] : Array.from(new Set(memories.map(m => m.agentId))),
          memoryCount: memories.length
        },
        config: {
          width: 800,
          height: 600,
          interactive: true,
          theme: 'light',
          layout: 'chart'
        }
      };

    } catch (error) {
      throw new Error(`Failed to generate access pattern visualization: ${(error as Error).message}`);
    }
  }

  /**
   * Generate custom visualization
   */
  async generateCustomVisualization(config: {
    type: string;
    data: any;
    options: any;
  }): Promise<MemoryVisualizationData> {
    try {
      return {
        type: config.type as any,
        data: config.data,
        metadata: {
          title: 'Custom Visualization',
          description: 'User-defined memory visualization',
          generatedAt: new Date(),
          agentIds: [],
          memoryCount: 0
        },
        config: {
          width: config.options.width || 800,
          height: config.options.height || 600,
          interactive: config.options.interactive || true,
          theme: config.options.theme || 'light',
          layout: config.options.layout || 'custom'
        }
      };

    } catch (error) {
      throw new Error(`Failed to generate custom visualization: ${(error as Error).message}`);
    }
  }

  /**
   * Export visualization
   */
  async exportVisualization(visualization: MemoryVisualizationData, format: 'png' | 'svg' | 'pdf' | 'json'): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `memory-visualization-${timestamp}.${format}`;

      if (format === 'json') {
        // Export as JSON
        const jsonData = JSON.stringify(visualization, null, 2);
        return jsonData;
      } else {
        // For image formats, we would need a rendering library
        // This is a placeholder implementation
        throw new Error(`Export format ${format} not implemented`);
      }

    } catch (error) {
      throw new Error(`Failed to export visualization: ${(error as Error).message}`);
    }
  }

  /**
   * Generate edges for network graph
   */
  private generateEdges(memories: MemoryItem[]): any[] {
    const edges: any[] = [];
    const memoryMap = new Map(memories.map(m => [m.id, m]));

    for (const memory of memories) {
      if (memory.relationships) {
        for (const relatedId of memory.relationships) {
          const relatedMemory = memoryMap.get(relatedId);
          if (relatedMemory) {
            edges.push({
              from: memory.id,
              to: relatedId,
              arrows: 'to',
              color: { color: '#848484' },
              width: 2
            });
          }
        }
      }
    }

    return edges;
  }

  /**
   * Get color for memory type
   */
  private getColorForType(type: string): string {
    const colors: Record<string, string> = {
      'conversation': '#ff6b6b',
      'task': '#4ecdc4',
      'context': '#45b7d1',
      'knowledge': '#96ceb4',
      'preference': '#feca57',
      'error': '#ff9ff3',
      'default': '#95a5a6'
    };

    return colors[type] || colors.default;
  }

  /**
   * Generate heatmap data
   */
  private generateHeatmapData(memories: MemoryItem[]): {
    matrix: number[][];
    xLabels: string[];
    yLabels: string[];
    maxValue: number;
  } {
    const agents = Array.from(new Set(memories.map(m => m.agentId)));
    const types = Array.from(new Set(memories.map(m => m.type)));

    const matrix: number[][] = [];
    let maxValue = 0;

    for (const agent of agents) {
      const row: number[] = [];
      for (const type of types) {
        const count = memories.filter(m => m.agentId === agent && m.type === type).length;
        row.push(count);
        maxValue = Math.max(maxValue, count);
      }
      matrix.push(row);
    }

    return {
      matrix,
      xLabels: types,
      yLabels: agents,
      maxValue
    };
  }

  /**
   * Generate tree data
   */
  private generateTreeData(memories: MemoryItem[]): any[] {
    const agentGroups = new Map<string, MemoryItem[]>();
    
    for (const memory of memories) {
      if (!agentGroups.has(memory.agentId)) {
        agentGroups.set(memory.agentId, []);
      }
      agentGroups.get(memory.agentId)!.push(memory);
    }

    const treeData: any[] = [];

    for (const [agentId, agentMemories] of Array.from(agentGroups.entries())) {
      const typeGroups = new Map<string, MemoryItem[]>();
      
      for (const memory of agentMemories) {
        if (!typeGroups.has(memory.type)) {
          typeGroups.set(memory.type, []);
        }
        typeGroups.get(memory.type)!.push(memory);
      }

      const agentNode = {
        name: agentId,
        children: []
      };

      for (const [type, typeMemories] of Array.from(typeGroups.entries())) {
        const typeNode = {
          name: type,
          children: typeMemories.map(memory => ({
            name: memory.id,
            value: memory.metadata?.accessCount || 0,
            metadata: {
              type: memory.type,
              agentId: memory.agentId,
              createdAt: memory.metadata?.createdAt
            }
          }))
        };
        agentNode.children.push(typeNode);
      }

      treeData.push(agentNode);
    }

    return treeData;
  }

  /**
   * Analyze access patterns
   */
  private analyzeAccessPatterns(memories: MemoryItem[]): {
    hourlyAccess: number[];
    typeDistribution: number[];
    labels: string[];
  } {
    const hourlyAccess = new Array(24).fill(0);
    const typeDistribution = new Map<string, number>();

    for (const memory of memories) {
      // Analyze hourly access patterns
      const lastAccessed = memory.metadata?.lastAccessedAt as Date;
      if (lastAccessed) {
        const hour = lastAccessed.getHours();
        hourlyAccess[hour]++;
      }

      // Analyze type distribution
      typeDistribution.set(memory.type, (typeDistribution.get(memory.type) || 0) + 1);
    }

    const labels = Array.from(typeDistribution.keys());
    const typeDistributionArray = Array.from(typeDistribution.values());

    return {
      hourlyAccess,
      typeDistribution: typeDistributionArray,
      labels
    };
  }
}