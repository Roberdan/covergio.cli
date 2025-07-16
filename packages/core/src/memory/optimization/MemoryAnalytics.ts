/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { MemoryAnalytics } from './interfaces.js';
import { MemoryUsageAnalytics } from './types.js';
import { MemoryItem } from '../types.js';
import { MemoryStore } from '../interfaces.js';

/**
 * Default implementation of memory analytics
 */
export class DefaultMemoryAnalytics implements MemoryAnalytics {
  private memoryStore: MemoryStore;
  private analyticsCache = new Map<string, { data: any; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(memoryStore: MemoryStore) {
    this.memoryStore = memoryStore;
  }

  /**
   * Analyze memory usage patterns
   */
  async analyzeUsage(agentId?: string): Promise<MemoryUsageAnalytics> {
    const cacheKey = `usage-${agentId || 'all'}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) return cached;

    try {
      const searchResult = await this.memoryStore.search(agentId ? { agentId } : {});
      const memories = searchResult.items;

      const analytics = await this.calculateUsageAnalytics(memories);
      this.setCachedResult(cacheKey, analytics);
      
      return analytics;
    } catch (error) {
      throw new Error(`Failed to analyze memory usage: ${(error as Error).message}`);
    }
  }

  /**
   * Get memory distribution statistics
   */
  async getDistributionStats(): Promise<{
    byType: Map<string, number>;
    byAgent: Map<string, number>;
    byScope: Map<string, number>;
    byAge: Map<string, number>;
  }> {
    const cacheKey = 'distribution-stats';
    const cached = this.getCachedResult(cacheKey);
    if (cached) return cached;

    try {
      const searchResult = await this.memoryStore.search({});
      const memories = searchResult.items;

      const byType = new Map<string, number>();
      const byAgent = new Map<string, number>();
      const byScope = new Map<string, number>();
      const byAge = new Map<string, number>();

      const now = Date.now();
      
      for (const memory of memories) {
        // By type
        byType.set(memory.type, (byType.get(memory.type) || 0) + 1);
        
        // By agent
        byAgent.set(memory.agentId, (byAgent.get(memory.agentId) || 0) + 1);
        
        // By scope
        byScope.set(memory.scope, (byScope.get(memory.scope) || 0) + 1);
        
        // By age
        const age = now - (memory.metadata?.createdAt as Date)?.getTime();
        const ageCategory = this.getAgeCategory(age);
        byAge.set(ageCategory, (byAge.get(ageCategory) || 0) + 1);
      }

      const stats = { byType, byAgent, byScope, byAge };
      this.setCachedResult(cacheKey, stats);
      
      return stats;
    } catch (error) {
      throw new Error(`Failed to get distribution stats: ${(error as Error).message}`);
    }
  }

  /**
   * Get access pattern analysis
   */
  async getAccessPatterns(agentId?: string): Promise<{
    peakAccessTimes: string[];
    accessFrequency: Map<string, number>;
    popularMemories: MemoryItem[];
    unusedMemories: MemoryItem[];
  }> {
    const cacheKey = `access-patterns-${agentId || 'all'}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) return cached;

    try {
      const searchResult = await this.memoryStore.search(agentId ? { agentId } : {});
      const memories = searchResult.items;

      const accessTimes = new Map<string, number>();
      const accessFrequency = new Map<string, number>();
      const popularMemories: MemoryItem[] = [];
      const unusedMemories: MemoryItem[] = [];

      for (const memory of memories) {
        const accessCount = memory.metadata?.accessCount || 0;
        const lastAccessed = memory.metadata?.lastAccessedAt as Date;

        // Track access frequency
        accessFrequency.set(memory.id, accessCount);

        // Track access times
        if (lastAccessed) {
          const hour = lastAccessed.getHours();
          const timeSlot = `${hour}:00`;
          accessTimes.set(timeSlot, (accessTimes.get(timeSlot) || 0) + 1);
        }

        // Categorize memories
        if (accessCount === 0) {
          unusedMemories.push(memory);
        } else if (accessCount > 10) {
          popularMemories.push(memory);
        }
      }

      // Find peak access times
      const peakAccessTimes = Array.from(accessTimes.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([time]) => time);

      // Sort popular memories by access count
      popularMemories.sort((a, b) => (b.metadata?.accessCount || 0) - (a.metadata?.accessCount || 0));

      const patterns = {
        peakAccessTimes,
        accessFrequency,
        popularMemories: popularMemories.slice(0, 10),
        unusedMemories
      };

      this.setCachedResult(cacheKey, patterns);
      return patterns;
    } catch (error) {
      throw new Error(`Failed to analyze access patterns: ${(error as Error).message}`);
    }
  }

  /**
   * Get memory growth trends
   */
  async getGrowthTrends(period: string = '30d'): Promise<{
    growthRate: number;
    projectedGrowth: number;
    trendsData: Array<{
      date: Date;
      memoryCount: number;
      storageSize: number;
    }>;
  }> {
    const cacheKey = `growth-trends-${period}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) return cached;

    try {
      const searchResult = await this.memoryStore.search({});
      const memories = searchResult.items;

      const periodMs = this.parsePeriod(period);
      const now = Date.now();
      const startTime = now - periodMs;

      // Group memories by day
      const dailyData = new Map<string, { count: number; size: number }>();
      
      for (const memory of memories) {
        const createdAt = (memory.metadata?.createdAt as Date)?.getTime();
        if (createdAt && createdAt >= startTime) {
          const date = new Date(createdAt);
          const dayKey = date.toISOString().split('T')[0];
          
          const existing = dailyData.get(dayKey) || { count: 0, size: 0 };
          existing.count += 1;
          existing.size += JSON.stringify(memory).length;
          dailyData.set(dayKey, existing);
        }
      }

      // Convert to trend data
      const trendsData: Array<{
        date: Date;
        memoryCount: number;
        storageSize: number;
      }> = [];

      const sortedDates = Array.from(dailyData.keys()).sort();
      let cumulativeCount = 0;
      let cumulativeSize = 0;

      for (const dateKey of sortedDates) {
        const dayData = dailyData.get(dateKey)!;
        cumulativeCount += dayData.count;
        cumulativeSize += dayData.size;
        
        trendsData.push({
          date: new Date(dateKey),
          memoryCount: cumulativeCount,
          storageSize: cumulativeSize
        });
      }

      // Calculate growth rate
      const growthRate = this.calculateGrowthRate(trendsData);
      const projectedGrowth = this.calculateProjectedGrowth(trendsData, growthRate);

      const trends = {
        growthRate,
        projectedGrowth,
        trendsData
      };

      this.setCachedResult(cacheKey, trends);
      return trends;
    } catch (error) {
      throw new Error(`Failed to analyze growth trends: ${(error as Error).message}`);
    }
  }

  /**
   * Generate analytics report
   */
  async generateReport(agentId?: string): Promise<string> {
    try {
      const usage = await this.analyzeUsage(agentId);
      const distribution = await this.getDistributionStats();
      const accessPatterns = await this.getAccessPatterns(agentId);
      const growthTrends = await this.getGrowthTrends();

      const report = `
# Memory Analytics Report
${agentId ? `Agent: ${agentId}` : 'All Agents'}
Generated: ${new Date().toISOString()}

## Summary
- Total Memories: ${usage.totalMemories}
- Total Storage: ${this.formatBytes(usage.totalMemoryUsage)}
- Average Size: ${this.formatBytes(usage.averageMemorySize)}

## Memory Distribution
### By Type
${Array.from(distribution.byType.entries())
  .map(([type, count]) => `- ${type}: ${count}`)
  .join('\n')}

### By Agent
${Array.from(distribution.byAgent.entries())
  .slice(0, 10)
  .map(([agent, count]) => `- ${agent}: ${count}`)
  .join('\n')}

## Access Patterns
### Peak Access Times
${accessPatterns.peakAccessTimes.map(time => `- ${time}`).join('\n')}

### Most Popular Memories
${accessPatterns.popularMemories
  .slice(0, 5)
  .map(memory => `- ${memory.id}: ${memory.metadata?.accessCount || 0} accesses`)
  .join('\n')}

### Unused Memories
- Count: ${accessPatterns.unusedMemories.length}
- Percentage: ${((accessPatterns.unusedMemories.length / usage.totalMemories) * 100).toFixed(1)}%

## Growth Trends
- Growth Rate: ${(growthTrends.growthRate * 100).toFixed(1)}% per day
- Projected Growth: ${growthTrends.projectedGrowth} memories in next 30 days

## Age Distribution
- Less than 1 day: ${usage.ageDistribution.lessThanDay}
- Less than 1 week: ${usage.ageDistribution.lessThanWeek}
- Less than 1 month: ${usage.ageDistribution.lessThanMonth}
- More than 1 month: ${usage.ageDistribution.moreThanMonth}

## Recommendations
${await this.generateRecommendations(usage, accessPatterns)}
`;

      return report;
    } catch (error) {
      throw new Error(`Failed to generate analytics report: ${(error as Error).message}`);
    }
  }

  /**
   * Calculate usage analytics for memories
   */
  private async calculateUsageAnalytics(memories: MemoryItem[]): Promise<MemoryUsageAnalytics> {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const oneWeekMs = 7 * oneDayMs;
    const oneMonthMs = 30 * oneDayMs;

    const memoryByType = new Map<string, number>();
    const memoryByAgent = new Map<string, number>();
    let totalMemoryUsage = 0;
    const accessCounts: number[] = [];
    const memorySizes: number[] = [];

    const ageDistribution = {
      lessThanDay: 0,
      lessThanWeek: 0,
      lessThanMonth: 0,
      moreThanMonth: 0
    };

    for (const memory of memories) {
      // Type distribution
      memoryByType.set(memory.type, (memoryByType.get(memory.type) || 0) + 1);
      
      // Agent distribution
      memoryByAgent.set(memory.agentId, (memoryByAgent.get(memory.agentId) || 0) + 1);
      
      // Size calculation
      const size = JSON.stringify(memory).length;
      memorySizes.push(size);
      totalMemoryUsage += size;
      
      // Access count
      const accessCount = memory.metadata?.accessCount || 0;
      accessCounts.push(accessCount);
      
      // Age distribution
      const age = now - (memory.metadata?.createdAt as Date)?.getTime();
      if (age < oneDayMs) {
        ageDistribution.lessThanDay++;
      } else if (age < oneWeekMs) {
        ageDistribution.lessThanWeek++;
      } else if (age < oneMonthMs) {
        ageDistribution.lessThanMonth++;
      } else {
        ageDistribution.moreThanMonth++;
      }
    }

    // Sort memories by access count for most/least accessed
    const sortedByAccess = [...memories].sort((a, b) => 
      (b.metadata?.accessCount || 0) - (a.metadata?.accessCount || 0)
    );

    const mostAccessedMemories = sortedByAccess.slice(0, 10);
    const leastAccessedMemories = sortedByAccess.slice(-10).reverse();

    // Sort memories by creation date for recently created
    const recentlyCreated = [...memories]
      .sort((a, b) => (b.metadata?.createdAt as Date)?.getTime() - (a.metadata?.createdAt as Date)?.getTime())
      .slice(0, 10);

    // Calculate averages
    const averageMemorySize = memorySizes.length > 0 ? 
      memorySizes.reduce((sum, size) => sum + size, 0) / memorySizes.length : 0;

    // Find most active agents
    const mostActiveAgents = Array.from(memoryByAgent.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([agent]) => agent);

    // Calculate average access frequency
    const totalAccesses = accessCounts.reduce((sum, count) => sum + count, 0);
    const averageAccessFrequency = memories.length > 0 ? totalAccesses / memories.length : 0;

    return {
      totalMemories: memories.length,
      memoryByType,
      memoryByAgent,
      averageMemorySize,
      totalMemoryUsage,
      mostAccessedMemories,
      leastAccessedMemories,
      ageDistribution,
      accessPatterns: {
        peakAccessTime: this.findPeakAccessTime(memories),
        averageAccessFrequency,
        mostActiveAgents
      },
      performance: {
        averageQueryTime: 0, // Would need to be tracked in real implementation
        averageStoreTime: 0, // Would need to be tracked in real implementation
        cacheHitRate: 0 // Would need to be tracked in real implementation
      },
      analyzedAt: new Date(),
      recentlyCreated
    };
  }

  /**
   * Find peak access time from memories
   */
  private findPeakAccessTime(memories: MemoryItem[]): string {
    const hourCounts = new Map<number, number>();
    
    for (const memory of memories) {
      const lastAccessed = memory.metadata?.lastAccessedAt as Date;
      if (lastAccessed) {
        const hour = lastAccessed.getHours();
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
      }
    }

    let peakHour = 0;
    let maxCount = 0;
    
    for (const [hour, count] of Array.from(hourCounts.entries())) {
      if (count > maxCount) {
        maxCount = count;
        peakHour = hour;
      }
    }

    return `${peakHour}:00`;
  }

  /**
   * Get age category for a memory age in milliseconds
   */
  private getAgeCategory(age: number): string {
    const oneDayMs = 24 * 60 * 60 * 1000;
    const oneWeekMs = 7 * oneDayMs;
    const oneMonthMs = 30 * oneDayMs;

    if (age < oneDayMs) return 'less-than-day';
    if (age < oneWeekMs) return 'less-than-week';
    if (age < oneMonthMs) return 'less-than-month';
    return 'more-than-month';
  }

  /**
   * Parse period string to milliseconds
   */
  private parsePeriod(period: string): number {
    const match = period.match(/^(\d+)([dhwmy])$/);
    if (!match) return 30 * 24 * 60 * 60 * 1000; // Default to 30 days

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'w': return value * 7 * 24 * 60 * 60 * 1000;
      case 'm': return value * 30 * 24 * 60 * 60 * 1000;
      case 'y': return value * 365 * 24 * 60 * 60 * 1000;
      default: return 30 * 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Calculate growth rate from trends data
   */
  private calculateGrowthRate(trendsData: Array<{ date: Date; memoryCount: number; storageSize: number }>): number {
    if (trendsData.length < 2) return 0;

    const first = trendsData[0];
    const last = trendsData[trendsData.length - 1];
    const daysDiff = (last.date.getTime() - first.date.getTime()) / (24 * 60 * 60 * 1000);
    
    if (daysDiff === 0 || first.memoryCount === 0) return 0;

    const totalGrowth = (last.memoryCount - first.memoryCount) / first.memoryCount;
    return totalGrowth / daysDiff;
  }

  /**
   * Calculate projected growth
   */
  private calculateProjectedGrowth(
    trendsData: Array<{ date: Date; memoryCount: number; storageSize: number }>,
    growthRate: number
  ): number {
    if (trendsData.length === 0) return 0;
    
    const lastCount = trendsData[trendsData.length - 1].memoryCount;
    const daysToProject = 30;
    
    return Math.round(lastCount * (1 + growthRate * daysToProject));
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Generate recommendations based on analytics
   */
  private async generateRecommendations(
    usage: MemoryUsageAnalytics,
    accessPatterns: { unusedMemories: MemoryItem[]; popularMemories: MemoryItem[] }
  ): Promise<string> {
    const recommendations: string[] = [];

    // Storage recommendations
    if (usage.totalMemoryUsage > 100 * 1024 * 1024) { // 100MB
      recommendations.push('Consider implementing compression to reduce storage usage');
    }

    // Unused memory recommendations
    if (accessPatterns.unusedMemories.length > usage.totalMemories * 0.2) {
      recommendations.push('High number of unused memories - consider pruning old or irrelevant memories');
    }

    // Access pattern recommendations
    if (accessPatterns.popularMemories.length > 0) {
      recommendations.push('Consider caching frequently accessed memories for better performance');
    }

    // Age distribution recommendations
    if (usage.ageDistribution.moreThanMonth > usage.totalMemories * 0.5) {
      recommendations.push('Large number of old memories - consider archiving memories older than 1 month');
    }

    return recommendations.length > 0 ? recommendations.join('\n- ') : 'No specific recommendations at this time';
  }

  /**
   * Get cached result if available and not expired
   */
  private getCachedResult(key: string): any | null {
    const cached = this.analyticsCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  /**
   * Set cached result
   */
  private setCachedResult(key: string, data: any): void {
    this.analyticsCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
}