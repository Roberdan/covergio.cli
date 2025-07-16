/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SimilarityCalculator } from './interfaces.js';
import { VectorEmbedding } from './types.js';

/**
 * Implementation of vector similarity calculations
 */
export class DefaultSimilarityCalculator implements SimilarityCalculator {
  
  /**
   * Calculate cosine similarity between two vectors
   */
  cosine(vector1: number[], vector2: number[]): number {
    if (vector1.length !== vector2.length) {
      throw new Error('Vectors must have the same dimensions');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      norm1 += vector1[i] * vector1[i];
      norm2 += vector2[i] * vector2[i];
    }

    // Handle zero vectors
    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Calculate euclidean distance between two vectors
   */
  euclidean(vector1: number[], vector2: number[]): number {
    if (vector1.length !== vector2.length) {
      throw new Error('Vectors must have the same dimensions');
    }

    let sumSquaredDifferences = 0;
    for (let i = 0; i < vector1.length; i++) {
      const diff = vector1[i] - vector2[i];
      sumSquaredDifferences += diff * diff;
    }

    return Math.sqrt(sumSquaredDifferences);
  }

  /**
   * Calculate manhattan distance between two vectors
   */
  manhattan(vector1: number[], vector2: number[]): number {
    if (vector1.length !== vector2.length) {
      throw new Error('Vectors must have the same dimensions');
    }

    let sumAbsoluteDifferences = 0;
    for (let i = 0; i < vector1.length; i++) {
      sumAbsoluteDifferences += Math.abs(vector1[i] - vector2[i]);
    }

    return sumAbsoluteDifferences;
  }

  /**
   * Calculate dot product between two vectors
   */
  dotProduct(vector1: number[], vector2: number[]): number {
    if (vector1.length !== vector2.length) {
      throw new Error('Vectors must have the same dimensions');
    }

    let product = 0;
    for (let i = 0; i < vector1.length; i++) {
      product += vector1[i] * vector2[i];
    }

    return product;
  }

  /**
   * Find most similar vectors using specified metric
   */
  findSimilar(
    queryVector: number[],
    candidateVectors: VectorEmbedding[],
    topK: number,
    metric: string = 'cosine'
  ): VectorEmbedding[] {
    if (candidateVectors.length === 0) {
      return [];
    }

    // Calculate similarities/distances
    const scored = candidateVectors.map(candidate => {
      let score: number;
      
      switch (metric.toLowerCase()) {
        case 'cosine':
          score = this.cosine(queryVector, candidate.values);
          break;
        case 'euclidean':
          // Convert distance to similarity (smaller distance = higher similarity)
          score = 1 / (1 + this.euclidean(queryVector, candidate.values));
          break;
        case 'manhattan':
          // Convert distance to similarity (smaller distance = higher similarity)
          score = 1 / (1 + this.manhattan(queryVector, candidate.values));
          break;
        case 'dotproduct':
          score = this.dotProduct(queryVector, candidate.values);
          break;
        default:
          throw new Error(`Unsupported similarity metric: ${metric}`);
      }

      return {
        vector: candidate,
        score
      };
    });

    // Sort by score (highest first for similarity, lowest first for distance)
    scored.sort((a, b) => b.score - a.score);

    // Return top K vectors
    return scored.slice(0, topK).map(item => item.vector);
  }

  /**
   * Calculate similarity matrix for a set of vectors
   */
  similarityMatrix(vectors: number[][]): number[][] {
    const n = vectors.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1.0; // Self-similarity is always 1
        } else {
          const similarity = this.cosine(vectors[i], vectors[j]);
          matrix[i][j] = similarity;
          matrix[j][i] = similarity; // Matrix is symmetric
        }
      }
    }

    return matrix;
  }

  /**
   * Normalize a vector to unit length
   */
  normalize(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    
    if (norm === 0) {
      return vector; // Cannot normalize zero vector
    }

    return vector.map(val => val / norm);
  }

  /**
   * Calculate vector magnitude (L2 norm)
   */
  magnitude(vector: number[]): number {
    return Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  }

  /**
   * Calculate angle between two vectors in radians
   */
  angle(vector1: number[], vector2: number[]): number {
    const cosineSim = this.cosine(vector1, vector2);
    return Math.acos(Math.max(-1, Math.min(1, cosineSim))); // Clamp to avoid numerical errors
  }

  /**
   * Check if two vectors are approximately equal within a tolerance
   */
  isApproximatelyEqual(vector1: number[], vector2: number[], tolerance: number = 1e-10): boolean {
    if (vector1.length !== vector2.length) {
      return false;
    }

    for (let i = 0; i < vector1.length; i++) {
      if (Math.abs(vector1[i] - vector2[i]) > tolerance) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate the centroid of a set of vectors
   */
  centroid(vectors: number[][]): number[] {
    if (vectors.length === 0) {
      throw new Error('Cannot calculate centroid of empty vector set');
    }

    const dimensions = vectors[0].length;
    const center = new Array(dimensions).fill(0);

    // Sum all vectors
    for (const vector of vectors) {
      if (vector.length !== dimensions) {
        throw new Error('All vectors must have the same dimensions');
      }
      
      for (let i = 0; i < dimensions; i++) {
        center[i] += vector[i];
      }
    }

    // Divide by count to get average
    return center.map(val => val / vectors.length);
  }

  /**
   * Find the k-nearest neighbors using brute force search
   */
  kNearestNeighbors(
    queryVector: number[],
    candidateVectors: VectorEmbedding[],
    k: number,
    metric: string = 'cosine'
  ): Array<{ vector: VectorEmbedding; distance: number; similarity: number }> {
    if (candidateVectors.length === 0) {
      return [];
    }

    // Calculate distances and similarities
    const results = candidateVectors.map(candidate => {
      let distance: number;
      let similarity: number;

      switch (metric.toLowerCase()) {
        case 'cosine':
          similarity = this.cosine(queryVector, candidate.values);
          distance = 1 - similarity; // Convert similarity to distance
          break;
        case 'euclidean':
          distance = this.euclidean(queryVector, candidate.values);
          similarity = 1 / (1 + distance);
          break;
        case 'manhattan':
          distance = this.manhattan(queryVector, candidate.values);
          similarity = 1 / (1 + distance);
          break;
        case 'dotproduct':
          similarity = this.dotProduct(queryVector, candidate.values);
          distance = -similarity; // Higher dot product = lower "distance"
          break;
        default:
          throw new Error(`Unsupported similarity metric: ${metric}`);
      }

      return {
        vector: candidate,
        distance,
        similarity
      };
    });

    // Sort by distance (ascending) and return top k
    results.sort((a, b) => a.distance - b.distance);
    return results.slice(0, k);
  }

  /**
   * Calculate pairwise distances between vectors
   */
  pairwiseDistances(vectors: number[][], metric: string = 'euclidean'): number[][] {
    const n = vectors.length;
    const distances: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let distance: number;

        switch (metric.toLowerCase()) {
          case 'euclidean':
            distance = this.euclidean(vectors[i], vectors[j]);
            break;
          case 'manhattan':
            distance = this.manhattan(vectors[i], vectors[j]);
            break;
          case 'cosine':
            distance = 1 - this.cosine(vectors[i], vectors[j]);
            break;
          default:
            throw new Error(`Unsupported distance metric: ${metric}`);
        }

        distances[i][j] = distance;
        distances[j][i] = distance; // Matrix is symmetric
      }
    }

    return distances;
  }

  /**
   * Calculate diversity score for a set of vectors
   */
  diversityScore(vectors: number[][]): number {
    if (vectors.length < 2) {
      return 0;
    }

    let totalDistance = 0;
    let pairCount = 0;

    for (let i = 0; i < vectors.length; i++) {
      for (let j = i + 1; j < vectors.length; j++) {
        totalDistance += this.euclidean(vectors[i], vectors[j]);
        pairCount++;
      }
    }

    return totalDistance / pairCount;
  }

  /**
   * Find outlier vectors based on distance from centroid
   */
  findOutliers(vectors: VectorEmbedding[], threshold: number = 2.0): VectorEmbedding[] {
    if (vectors.length < 3) {
      return []; // Need at least 3 vectors to detect outliers
    }

    // Calculate centroid
    const values = vectors.map(v => v.values);
    const center = this.centroid(values);

    // Calculate distances from centroid
    const distances = vectors.map(vector => ({
      vector,
      distance: this.euclidean(vector.values, center)
    }));

    // Calculate mean and standard deviation of distances
    const mean = distances.reduce((sum, item) => sum + item.distance, 0) / distances.length;
    const variance = distances.reduce((sum, item) => sum + Math.pow(item.distance - mean, 2), 0) / distances.length;
    const stdDev = Math.sqrt(variance);

    // Find outliers (distance > mean + threshold * stdDev)
    const outlierThreshold = mean + threshold * stdDev;
    
    return distances
      .filter(item => item.distance > outlierThreshold)
      .map(item => item.vector);
  }

  /**
   * Calculate vector sparsity (percentage of zero values)
   */
  calculateSparsity(vector: number[]): number {
    const zeroCount = vector.filter(val => Math.abs(val) < 1e-10).length;
    return zeroCount / vector.length;
  }

  /**
   * Calculate average sparsity for a set of vectors
   */
  averageSparsity(vectors: number[][]): number {
    if (vectors.length === 0) {
      return 0;
    }

    const totalSparsity = vectors.reduce((sum, vector) => sum + this.calculateSparsity(vector), 0);
    return totalSparsity / vectors.length;
  }
}