/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { v4 as uuidv4 } from 'uuid';

export interface Context {
  id: string;
  type: string;
  data: Record<string, unknown>;
  metadata: {
    created: Date;
    updated: Date;
    version: number;
    tags: string[];
    parentContextId?: string;
  };
}

export interface ContextQuery {
  type?: string;
  tags?: string[];
  minVersion?: number;
  updatedSince?: Date;
  searchTerm?: string;
}

export interface ContextStorage {
  save(context: Context): Promise<void>;
  load(contextId: string): Promise<Context | null>;
  query(query: ContextQuery): Promise<Context[]>;
  delete(contextId: string): Promise<boolean>;
}

export class MemoryContextStorage implements ContextStorage {
  private storage: Map<string, Context> = new Map();
  private typeIndex: Map<string, Set<string>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();

  async save(context: Context): Promise<void> {
    const now = new Date();
    
    // Update timestamps
    if (!context.metadata) {
      context.metadata = {
        created: now,
        updated: now,
        version: 1,
        tags: []
      };
    } else {
      context.metadata.updated = now;
      context.metadata.version = (context.metadata.version || 0) + 1;
    }

    // Update indexes
    this.storage.set(context.id, context);
    
    // Update type index
    if (!this.typeIndex.has(context.type)) {
      this.typeIndex.set(context.type, new Set());
    }
    this.typeIndex.get(context.type)?.add(context.id);
    
    // Update tag index
    if (context.metadata.tags) {
      for (const tag of context.metadata.tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)?.add(context.id);
      }
    }
  }

  async load(contextId: string): Promise<Context | null> {
    return this.storage.get(contextId) || null;
  }

  async query(query: ContextQuery): Promise<Context[]> {
    let results: Set<string> | null = null;
    
    // Filter by type if specified
    if (query.type) {
      const typeResults = this.typeIndex.get(query.type) || new Set();
      results = new Set(typeResults);
    }
    
    // Filter by tags if specified
    if (query.tags && query.tags.length > 0) {
      const tagResults = new Set<string>();
      
      for (const tag of query.tags) {
        const tagged = this.tagIndex.get(tag) || new Set();
        if (tagResults.size === 0) {
          // First tag, add all
          for (const id of tagged) tagResults.add(id);
        } else {
          // Subsequent tags, intersect
          for (const id of tagResults) {
            if (!tagged.has(id)) tagResults.delete(id);
          }
        }
      }
      
      if (results) {
        // Intersect with previous results
        for (const id of results) {
          if (!tagResults.has(id)) results.delete(id);
        }
      } else {
        results = tagResults;
      }
    }
    
    // If no filters, return all
    if (!results) {
      results = new Set(this.storage.keys());
    }
    
    // Convert to context objects and apply remaining filters
    const contexts: Context[] = [];
    
    for (const id of results) {
      const context = this.storage.get(id);
      if (!context) continue;
      
      // Apply remaining filters
      if (query.updatedSince && context.metadata.updated < query.updatedSince) {
        continue;
      }
      
      if (query.minVersion && (context.metadata.version || 0) < query.minVersion) {
        continue;
      }
      
      if (query.searchTerm) {
        const searchLower = query.searchTerm.toLowerCase();
        const contextStr = JSON.stringify(context).toLowerCase();
        if (!contextStr.includes(searchLower)) {
          continue;
        }
      }
      
      contexts.push(context);
    }
    
    return contexts;
  }

  async delete(contextId: string): Promise<boolean> {
    const context = await this.load(contextId);
    if (!context) return false;
    
    // Remove from storage
    this.storage.delete(contextId);
    
    // Remove from type index
    this.typeIndex.get(context.type)?.delete(contextId);
    
    // Remove from tag index
    if (context.metadata.tags) {
      for (const tag of context.metadata.tags) {
        this.tagIndex.get(tag)?.delete(contextId);
      }
    }
    
    return true;
  }
}

export class ContextEngine {
  private storage: ContextStorage;
  private cache: Map<string, Context> = new Map();
  private cacheTtl: number = 5 * 60 * 1000; // 5 minutes
  private lastCleanup: number = Date.now();
  private cleanupInterval: number = 60 * 1000; // 1 minute

  constructor(storage?: ContextStorage) {
    this.storage = storage || new MemoryContextStorage();
    
    // Setup periodic cache cleanup
    setInterval(() => this.cleanupCache(), this.cleanupInterval);
  }

  async getContext(contextId: string, useCache: boolean = true): Promise<Context | null> {
    // Check cache first if enabled
    if (useCache && this.cache.has(contextId)) {
      return this.cache.get(contextId) || null;
    }
    
    // Load from storage
    const context = await this.storage.load(contextId);
    
    // Update cache
    if (context) {
      this.cache.set(contextId, context);
    }
    
    return context;
  }

  async createContext(
    type: string, 
    data: Record<string, unknown>,
    tags: string[] = [],
    parentContextId?: string
  ): Promise<Context> {
    const context: Context = {
      id: uuidv4(),
      type,
      data,
      metadata: {
        created: new Date(),
        updated: new Date(),
        version: 1,
        tags: [...tags],
        parentContextId
      }
    };
    
    await this.storage.save(context);
    this.cache.set(context.id, context);
    
    return context;
  }

  async updateContext(
    contextId: string, 
    updates: Partial<Context>,
    merge: boolean = true
  ): Promise<Context | null> {
    const existing = await this.getContext(contextId);
    if (!existing) return null;
    
    // Apply updates
    const updated: Context = {
      ...existing,
      ...updates,
      id: existing.id, // Never update ID
      metadata: {
        ...existing.metadata,
        ...updates.metadata,
        version: existing.metadata.version + 1,
        updated: new Date()
      }
    };
    
    // Handle data merging if specified
    if (merge && updates.data && existing.data) {
      updated.data = { ...existing.data, ...updates.data };
    }
    
    await this.storage.save(updated);
    this.cache.set(updated.id, updated);
    
    return updated;
  }

  async queryContexts(query: ContextQuery): Promise<Context[]> {
    return this.storage.query(query);
  }

  async deleteContext(contextId: string): Promise<boolean> {
    this.cache.delete(contextId);
    return this.storage.delete(contextId);
  }

  async getRelatedContexts(
    contextId: string,
    maxDepth: number = 3
  ): Promise<{ context: Context; distance: number }[]> {
    const visited = new Map<string, number>();
    const queue: { id: string; distance: number }[] = [{ id: contextId, distance: 0 }];
    const results: { context: Context; distance: number }[] = [];
    
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || current.distance > maxDepth) continue;
      
      const context = await this.getContext(current.id);
      if (!context) continue;
      
      // Skip if already visited with a shorter path
      const existingDistance = visited.get(current.id) ?? Infinity;
      if (existingDistance <= current.distance) continue;
      
      // Add to results if not the starting context
      if (current.distance > 0) {
        results.push({ context, distance: current.distance });
      }
      
      // Mark as visited
      visited.set(current.id, current.distance);
      
      // Find related contexts
      const related: string[] = [];
      
      // Parent context
      if (context.metadata.parentContextId) {
        related.push(context.metadata.parentContextId);
      }
      
      // Contexts with this as parent
      const children = await this.storage.query({
        parentContextId: context.id
      });
      children.forEach(child => related.push(child.id));
      
      // Add to queue with increased distance
      for (const id of related) {
        if (!visited.has(id) || (visited.get(id) ?? Infinity) > current.distance + 1) {
          queue.push({ id, distance: current.distance + 1 });
        }
      }
    }
    
    return results;
  }

  private async cleanupCache(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCleanup < this.cleanupInterval) return;
    
    const cacheEntries = Array.from(this.cache.entries());
    const cutoff = now - this.cacheTtl;
    
    for (const [id, context] of cacheEntries) {
      if (context.metadata.updated.getTime() < cutoff) {
        this.cache.delete(id);
      }
    }
    
    this.lastCleanup = now;
  }

  // Singleton pattern
  private static instance: ContextEngine;
  
  public static getInstance(storage?: ContextStorage): ContextEngine {
    if (!ContextEngine.instance) {
      ContextEngine.instance = new ContextEngine(storage);
    }
    return ContextEngine.instance;
  }
  
  public static resetInstance(): void {
    ContextEngine.instance = new ContextEngine();
  }
}
