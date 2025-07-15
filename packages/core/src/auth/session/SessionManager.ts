/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomBytes } from 'crypto';
import { 
  AuthSession, 
  AuthState, 
  StoredTokens, 
  SessionConfig,
  AuthError,
  AuthErrorType 
} from '../types';
import { TokenStorage } from '../storage/TokenStorage';
import { JWTValidator } from '../jwt/JWTValidator';

/**
 * Session manager configuration
 */
export interface SessionManagerConfig extends SessionConfig {
  jwtValidator?: JWTValidator;
  tokenStorage?: TokenStorage;
  enableAutoRefresh?: boolean;
  refreshThreshold?: number; // seconds before expiry to refresh
}

/**
 * Session activity event
 */
export interface SessionActivity {
  sessionId: string;
  userId: string;
  action: 'login' | 'logout' | 'refresh' | 'activity' | 'expire';
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Session management with automatic token refresh and lifecycle management
 * 
 * Provides comprehensive session management including:
 * - Session lifecycle management
 * - Automatic token refresh
 * - Session activity tracking
 * - Multi-device session support
 * - Security monitoring
 */
export class SessionManager {
  private readonly config: Required<SessionManagerConfig>;
  private readonly tokenStorage: TokenStorage;
  private readonly jwtValidator: JWTValidator;
  private readonly activeSessions: Map<string, AuthSession> = new Map();
  private readonly sessionActivities: SessionActivity[] = [];
  private readonly refreshTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: SessionManagerConfig = {}) {
    this.config = {
      maxAge: config.maxAge || 24 * 60 * 60, // 24 hours
      inactivityTimeout: config.inactivityTimeout || 2 * 60 * 60, // 2 hours
      renewalThreshold: config.renewalThreshold || 5 * 60, // 5 minutes
      cookieName: config.cookieName || 'convergio_session',
      secure: config.secure ?? true,
      httpOnly: config.httpOnly ?? true,
      sameSite: config.sameSite || 'strict',
      enableAutoRefresh: config.enableAutoRefresh ?? true,
      refreshThreshold: config.refreshThreshold || 5 * 60 // 5 minutes
    };

    this.tokenStorage = config.tokenStorage || new TokenStorage();
    this.jwtValidator = config.jwtValidator || new JWTValidator();

    // Start background tasks
    this.startSessionMonitoring();
  }

  /**
   * Create new authentication session
   * 
   * @param userId - User identifier
   * @param tokens - Authentication tokens
   * @param metadata - Additional session metadata
   * @returns New authentication session
   */
  async createSession(
    userId: string, 
    tokens: StoredTokens,
    metadata?: Record<string, any>
  ): Promise<AuthSession> {
    const sessionId = this.generateSessionId();
    const now = Date.now();

    const session: AuthSession = {
      userId,
      tokens,
      lastActivity: now,
      sessionId,
      deviceId: metadata?.deviceId,
      metadata
    };

    // Store session
    await this.tokenStorage.storeSession(session);
    this.activeSessions.set(sessionId, session);

    // Log activity
    this.logActivity({
      sessionId,
      userId,
      action: 'login',
      timestamp: now,
      metadata
    });

    // Schedule token refresh if enabled
    if (this.config.enableAutoRefresh) {
      this.scheduleTokenRefresh(sessionId, tokens.expiresAt);
    }

    return session;
  }

  /**
   * Get authentication session
   * 
   * @param sessionId - Session identifier
   * @returns Authentication session or null if invalid/expired
   */
  async getSession(sessionId: string): Promise<AuthSession | null> {
    // Try to get from cache first
    let session = this.activeSessions.get(sessionId);

    // Load from storage if not in cache
    if (!session) {
      session = await this.tokenStorage.getSession(sessionId);
      if (session) {
        this.activeSessions.set(sessionId, session);
      }
    }

    if (!session) {
      return null;
    }

    // Validate session
    if (await this.isSessionExpired(session)) {
      await this.deleteSession(sessionId);
      return null;
    }

    // Update last activity
    session.lastActivity = Date.now();
    await this.tokenStorage.updateTokens(sessionId, session.tokens);
    this.activeSessions.set(sessionId, session);

    this.logActivity({
      sessionId,
      userId: session.userId,
      action: 'activity',
      timestamp: session.lastActivity
    });

    return session;
  }

  /**
   * Update session tokens
   * 
   * @param sessionId - Session identifier
   * @param tokens - New token data
   * @returns Updated session
   */
  async updateSessionTokens(sessionId: string, tokens: StoredTokens): Promise<AuthSession> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw this.createAuthError(
        AuthErrorType.SESSION_EXPIRED,
        'Session not found or expired'
      );
    }

    session.tokens = tokens;
    session.lastActivity = Date.now();

    await this.tokenStorage.updateTokens(sessionId, tokens);
    this.activeSessions.set(sessionId, session);

    // Reschedule token refresh
    if (this.config.enableAutoRefresh) {
      this.clearRefreshTimer(sessionId);
      this.scheduleTokenRefresh(sessionId, tokens.expiresAt);
    }

    this.logActivity({
      sessionId,
      userId: session.userId,
      action: 'refresh',
      timestamp: session.lastActivity
    });

    return session;
  }

  /**
   * Delete authentication session
   * 
   * @param sessionId - Session identifier
   * @returns Promise that resolves when session is deleted
   */
  async deleteSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    
    // Remove from cache
    this.activeSessions.delete(sessionId);
    
    // Clear refresh timer
    this.clearRefreshTimer(sessionId);
    
    // Remove from storage
    await this.tokenStorage.deleteSession(sessionId);

    if (session) {
      this.logActivity({
        sessionId,
        userId: session.userId,
        action: 'logout',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Delete all sessions for a user
   * 
   * @param userId - User identifier
   * @returns Promise that resolves when all sessions are deleted
   */
  async deleteUserSessions(userId: string): Promise<void> {
    const sessionIds = await this.tokenStorage.listUserSessions(userId);
    
    for (const sessionId of sessionIds) {
      await this.deleteSession(sessionId);
    }
  }

  /**
   * Get current authentication state for a session
   * 
   * @param sessionId - Session identifier
   * @returns Authentication state
   */
  async getAuthState(sessionId: string): Promise<AuthState> {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      return { isAuthenticated: false };
    }

    // Extract user information from tokens if available
    let user: AuthState['user'];
    let permissions: string[];

    if (session.tokens.idToken) {
      try {
        const { payload } = this.jwtValidator.parseJWT(session.tokens.idToken);
        user = {
          id: payload.sub,
          email: payload.email,
          name: payload.name,
          ...payload
        };
        permissions = payload.scope?.split(' ') || [];
      } catch (error) {
        console.warn('Failed to parse ID token:', error);
      }
    }

    return {
      isAuthenticated: true,
      user,
      session,
      permissions
    };
  }

  /**
   * Check if session tokens need refresh
   * 
   * @param sessionId - Session identifier
   * @returns True if tokens should be refreshed
   */
  async shouldRefreshTokens(sessionId: string): Promise<boolean> {
    return await this.tokenStorage.isTokenExpiring(sessionId, this.config.refreshThreshold);
  }

  /**
   * Get all active sessions for a user
   * 
   * @param userId - User identifier
   * @returns Array of active sessions
   */
  async getUserSessions(userId: string): Promise<AuthSession[]> {
    const sessionIds = await this.tokenStorage.listUserSessions(userId);
    const sessions: AuthSession[] = [];

    for (const sessionId of sessionIds) {
      const session = await this.getSession(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Get session activity history
   * 
   * @param limit - Maximum number of activities to return
   * @param userId - Filter by user ID (optional)
   * @returns Array of session activities
   */
  getSessionActivities(limit: number = 100, userId?: string): SessionActivity[] {
    let activities = this.sessionActivities;
    
    if (userId) {
      activities = activities.filter(activity => activity.userId === userId);
    }
    
    return activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get session manager statistics
   * 
   * @returns Session statistics
   */
  getSessionStats(): {
    activeSessions: number;
    totalActivities: number;
    storageStats: any;
  } {
    return {
      activeSessions: this.activeSessions.size,
      totalActivities: this.sessionActivities.length,
      storageStats: this.tokenStorage.getStorageStats()
    };
  }

  /**
   * Cleanup expired sessions
   * 
   * @returns Number of sessions cleaned up
   */
  async cleanupExpiredSessions(): Promise<number> {
    let cleanedCount = 0;
    const sessionIds = Array.from(this.activeSessions.keys());

    for (const sessionId of sessionIds) {
      const session = this.activeSessions.get(sessionId);
      if (session && await this.isSessionExpired(session)) {
        await this.deleteSession(sessionId);
        cleanedCount++;
      }
    }

    // Also cleanup from storage
    const storageCleanedCount = await this.tokenStorage.cleanupExpiredSessions();
    
    return cleanedCount + storageCleanedCount;
  }

  /**
   * Check if session is expired
   * 
   * @param session - Session to check
   * @returns True if session is expired
   */
  private async isSessionExpired(session: AuthSession): Promise<boolean> {
    const now = Date.now();
    
    // Check session age
    const sessionAge = (now - (session.tokens.createdAt * 1000)) / 1000;
    if (sessionAge > this.config.maxAge) {
      return true;
    }

    // Check inactivity timeout
    const inactivityTime = (now - session.lastActivity) / 1000;
    if (inactivityTime > this.config.inactivityTimeout) {
      return true;
    }

    // Check token expiration
    const tokenAge = now / 1000;
    if (tokenAge > session.tokens.expiresAt) {
      return true;
    }

    return false;
  }

  /**
   * Schedule automatic token refresh
   * 
   * @param sessionId - Session identifier
   * @param expiresAt - Token expiration timestamp
   */
  private scheduleTokenRefresh(sessionId: string, expiresAt: number): void {
    const now = Math.floor(Date.now() / 1000);
    const timeUntilRefresh = (expiresAt - now - this.config.refreshThreshold) * 1000;

    if (timeUntilRefresh > 0) {
      const timer = setTimeout(async () => {
        try {
          // This would trigger token refresh in the main auth system
          // For now, we just log that refresh is needed
          console.log(`Token refresh needed for session ${sessionId}`);
          this.refreshTimers.delete(sessionId);
        } catch (error) {
          console.error(`Token refresh failed for session ${sessionId}:`, error);
        }
      }, timeUntilRefresh);

      this.refreshTimers.set(sessionId, timer);
    }
  }

  /**
   * Clear refresh timer for session
   * 
   * @param sessionId - Session identifier
   */
  private clearRefreshTimer(sessionId: string): void {
    const timer = this.refreshTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.refreshTimers.delete(sessionId);
    }
  }

  /**
   * Generate secure session ID
   * 
   * @returns Random session identifier
   */
  private generateSessionId(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Log session activity
   * 
   * @param activity - Session activity to log
   */
  private logActivity(activity: SessionActivity): void {
    this.sessionActivities.push(activity);
    
    // Keep only last 1000 activities
    if (this.sessionActivities.length > 1000) {
      this.sessionActivities.splice(0, this.sessionActivities.length - 1000);
    }
  }

  /**
   * Create authentication error
   * 
   * @param type - Error type
   * @param message - Error message
   * @returns Authentication error
   */
  private createAuthError(type: AuthErrorType, message: string): AuthError {
    const error = new Error(message) as AuthError;
    error.name = 'AuthError';
    error.type = type;
    return error;
  }

  /**
   * Start background session monitoring
   */
  private startSessionMonitoring(): void {
    // Run session cleanup every 15 minutes
    setInterval(async () => {
      try {
        await this.cleanupExpiredSessions();
      } catch (error) {
        console.warn('Session cleanup failed:', error);
      }
    }, 15 * 60 * 1000);
  }
}