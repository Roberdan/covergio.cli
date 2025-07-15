# OAuth 2.0 Authentication System

The Convergio CLI core package implements a comprehensive OAuth 2.0 authentication system with enterprise-grade security features, supporting modern authentication flows and secure token management.

## Overview

The authentication system provides:

- **OAuth 2.0 Authorization Code Flow** with PKCE support
- **JWT Token Validation** with JWKS integration
- **Secure Token Storage** with AES-256-GCM encryption
- **Session Management** with lifecycle tracking
- **Multi-Provider Support** for major OAuth 2.0 providers
- **Automatic Token Refresh** with configurable thresholds

## Quick Start

```typescript
import { AuthenticationManager, OAUTH2_PROVIDERS } from '@convergio/core/auth';

// Initialize authentication manager
const authManager = new AuthenticationManager({
  oauth2: {
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret', // Optional for PKCE
    authorizationUrl: 'https://provider.com/oauth/authorize',
    tokenUrl: 'https://provider.com/oauth/token',
    redirectUri: 'http://localhost:3000/callback',
    usePKCE: true // Recommended for security
  },
  providers: {
    google: OAUTH2_PROVIDERS.google
  }
});

// Start authentication flow
const { authorizationUrl, state } = await authManager.startAuthentication('google');

// Complete authentication after callback
const result = await authManager.completeAuthentication(
  'google',
  authorizationCode,
  state
);

if (result.success) {
  console.log('Authenticated user:', result.session?.userId);
}
```

## Core Components

### AuthenticationManager

The main orchestrator for all authentication operations:

```typescript
interface AuthenticationConfig {
  oauth2?: OAuth2Config;
  session?: SessionConfig;
  jwt?: {
    jwksUrl?: string;
    validationOptions?: JWTValidationOptions;
  };
  tokenStorage?: {
    storageDir?: string;
    encryptTokens?: boolean;
    encryptionPassword?: string;
  };
  providers?: Record<string, OAuth2Provider>;
  autoRefresh?: boolean;
  refreshThreshold?: number;
}
```

Key methods:
- `startAuthentication()` - Initiate OAuth 2.0 flow
- `completeAuthentication()` - Handle authorization callback
- `refreshTokens()` - Refresh expired tokens
- `getAuthenticationState()` - Get current auth status
- `logout()` - Terminate session

### OAuth2Client

Handles OAuth 2.0 protocol implementation:

```typescript
const oauth2Client = new OAuth2Client({
  clientId: 'your-client-id',
  authorizationUrl: 'https://provider.com/oauth/authorize',
  tokenUrl: 'https://provider.com/oauth/token',
  redirectUri: 'http://localhost:3000/callback',
  usePKCE: true,
  scope: ['openid', 'profile', 'email']
});

// Generate authorization URL
const { url, state, codeVerifier } = oauth2Client.generateAuthorizationUrl();

// Exchange code for tokens
const tokens = await oauth2Client.exchangeCodeForTokens(code, state);
```

### PKCE (Proof Key for Code Exchange)

Implements RFC 7636 for enhanced security:

```typescript
import { PKCEGenerator } from '@convergio/core/auth';

// Generate PKCE parameters
const pkce = PKCEGenerator.generatePKCE('S256');
console.log(pkce.codeVerifier);   // 128-character code verifier
console.log(pkce.codeChallenge); // SHA256 hash of verifier

// Validate code verifier
const isValid = PKCEGenerator.validateCodeVerifier(pkce.codeVerifier);

// Verify challenge
const matches = PKCEGenerator.verifyCodeChallenge(
  pkce.codeVerifier,
  pkce.codeChallenge,
  'S256'
);
```

PKCE provides security benefits:
- Prevents authorization code interception attacks
- Enables secure authentication for public clients
- No client secret required for mobile/SPA applications

### JWT Validation

Comprehensive JWT token validation with JWKS support:

```typescript
import { JWTValidator } from '@convergio/core/auth';

const validator = new JWTValidator();

// Validate with JWKS endpoint
const result = await validator.validateJWTWithJWKS(
  token,
  'https://provider.com/.well-known/jwks.json',
  {
    issuer: 'https://provider.com',
    audience: 'your-client-id',
    algorithms: ['RS256', 'ES256']
  }
);

if (result.isValid) {
  console.log('Token payload:', result.payload);
} else {
  console.log('Validation errors:', result.errors);
}
```

Supported algorithms:
- **RSA**: RS256, RS384, RS512, PS256, PS384, PS512
- **ECDSA**: ES256, ES384, ES512

Validation features:
- Signature verification with JWKS key rotation
- Expiration and not-before claims
- Issuer and audience validation
- Clock skew tolerance
- Algorithm allowlist

### Token Storage

Secure token persistence with encryption:

```typescript
import { TokenStorage } from '@convergio/core/auth';

const storage = new TokenStorage({
  storageDir: '/path/to/secure/storage',
  encryptTokens: true,
  encryptionPassword: 'strong-password',
  sessionTimeout: 3600, // 1 hour
  autoCleanup: true
});

// Store session with encrypted tokens
await storage.storeSession(authSession);

// Retrieve session
const session = await storage.getSession(sessionId);

// Check token expiration
const isExpiring = await storage.isTokenExpiring(sessionId, 300); // 5 minutes
```

Security features:
- AES-256-GCM authenticated encryption
- Secure file permissions (600)
- Automatic cleanup of expired sessions
- Memory clearing for sensitive data

### Session Management

Comprehensive session lifecycle management:

```typescript
import { SessionManager } from '@convergio/core/auth';

const sessionManager = new SessionManager({
  maxAge: 24 * 60 * 60,        // 24 hours
  inactivityTimeout: 2 * 60 * 60, // 2 hours
  renewalThreshold: 5 * 60,     // 5 minutes
  enableAutoRefresh: true
});

// Create session
const session = await sessionManager.createSession(userId, tokens);

// Get current auth state
const authState = await sessionManager.getAuthState(sessionId);

// Check if refresh needed
const needsRefresh = await sessionManager.shouldRefreshTokens(sessionId);

// Get user sessions
const userSessions = await sessionManager.getUserSessions(userId);
```

## Supported Providers

### Pre-configured Providers

```typescript
import { OAUTH2_PROVIDERS } from '@convergio/core/auth';

// Google OAuth 2.0
const googleConfig = OAUTH2_PROVIDERS.google;

// Microsoft Azure AD
const microsoftConfig = OAUTH2_PROVIDERS.microsoft;

// Auth0
const auth0Config = OAUTH2_PROVIDERS.auth0;

// Okta
const oktaConfig = OAUTH2_PROVIDERS.okta;

// GitHub OAuth
const githubConfig = OAUTH2_PROVIDERS.github;
```

### Custom Provider Configuration

```typescript
authManager.addProvider('custom-provider', {
  name: 'custom-provider',
  displayName: 'Custom Provider',
  authorizationUrl: 'https://custom.com/oauth/authorize',
  tokenUrl: 'https://custom.com/oauth/token',
  userInfoUrl: 'https://custom.com/userinfo',
  jwksUrl: 'https://custom.com/.well-known/jwks.json',
  scopes: ['openid', 'profile', 'email'],
  supportsRefreshToken: true,
  supportsPKCE: true,
  requiresClientSecret: false
});
```

## Security Features

### PKCE (Proof Key for Code Exchange)

Prevents authorization code interception attacks:

```typescript
// Automatically enabled for supported providers
const authConfig = {
  oauth2: {
    clientId: 'client-id',
    usePKCE: true, // Enable PKCE
    // No client secret needed
  }
};
```

### State Parameter

CSRF protection with cryptographically secure state:

```typescript
// Automatically generated and validated
const { authorizationUrl, state } = await authManager.startAuthentication('provider');
// State is automatically validated during callback
```

### Token Encryption

All tokens encrypted at rest:

```typescript
const authManager = new AuthenticationManager({
  tokenStorage: {
    encryptTokens: true, // Default: true
    encryptionPassword: 'secure-password'
  }
});
```

### Session Security

Multiple layers of session protection:

```typescript
const sessionConfig = {
  maxAge: 24 * 60 * 60,        // Maximum session lifetime
  inactivityTimeout: 2 * 60 * 60, // Inactivity timeout
  secure: true,                 // HTTPS only
  httpOnly: true,              // Prevent XSS
  sameSite: 'strict'           // CSRF protection
};
```

## Error Handling

Comprehensive error handling with typed errors:

```typescript
import { AuthErrorType } from '@convergio/core/auth';

try {
  const result = await authManager.completeAuthentication(provider, code, state);
  
  if (!result.success) {
    switch (result.error?.type) {
      case AuthErrorType.INVALID_GRANT:
        console.log('Invalid authorization code');
        break;
      case AuthErrorType.TOKEN_EXPIRED:
        console.log('Token has expired, please re-authenticate');
        break;
      case AuthErrorType.NETWORK_ERROR:
        console.log('Network error, please try again');
        break;
    }
  }
} catch (error) {
  console.error('Authentication failed:', error);
}
```

## Utility Functions

```typescript
import { AuthUtils } from '@convergio/core/auth';

// Check token expiration
const isExpired = AuthUtils.isTokenExpired(expiresAt, 60); // 60s buffer

// Generate secure random string
const randomString = AuthUtils.generateRandomString(32);

// Parse JWT (inspection only)
const { header, payload } = AuthUtils.parseJWT(token);

// Time until expiration
const timeLeft = AuthUtils.getTimeUntilExpiration(expiresAt);

// Format user-friendly error messages
const userMessage = AuthUtils.formatAuthError(authError);
```

## Testing

The authentication system includes comprehensive tests:

```bash
# Run authentication tests
npm test src/auth

# Run specific component tests
npm test src/auth/__tests__/PKCEGenerator.test.ts
npm test src/auth/__tests__/simple-auth.test.ts
```

Test coverage:
- **29 passing tests** for core components
- PKCE generator validation (19 tests)
- JWT parsing and validation
- Token storage operations
- Provider configuration validation

## Configuration Examples

### Basic OAuth 2.0 Setup

```typescript
const authManager = new AuthenticationManager({
  oauth2: {
    clientId: process.env.OAUTH_CLIENT_ID,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    redirectUri: 'http://localhost:3000/auth/callback',
    scope: ['openid', 'profile', 'email'],
    usePKCE: true
  }
});
```

### Enterprise Setup with JWKS

```typescript
const authManager = new AuthenticationManager({
  jwt: {
    jwksUrl: 'https://your-domain.auth0.com/.well-known/jwks.json',
    validationOptions: {
      issuer: 'https://your-domain.auth0.com/',
      audience: 'your-api-identifier',
      algorithms: ['RS256'],
      clockTolerance: 60
    }
  },
  session: {
    maxAge: 8 * 60 * 60,      // 8 hours
    inactivityTimeout: 30 * 60, // 30 minutes
    renewalThreshold: 5 * 60   // 5 minutes
  },
  autoRefresh: true,
  providers: {
    'enterprise-sso': {
      name: 'enterprise-sso',
      displayName: 'Enterprise SSO',
      authorizationUrl: 'https://sso.company.com/oauth/authorize',
      tokenUrl: 'https://sso.company.com/oauth/token',
      jwksUrl: 'https://sso.company.com/.well-known/jwks.json',
      scopes: ['openid', 'profile', 'email', 'groups'],
      supportsRefreshToken: true,
      supportsPKCE: true,
      requiresClientSecret: false
    }
  }
});
```

### Multi-Provider Setup

```typescript
const authManager = new AuthenticationManager({
  providers: {
    google: OAUTH2_PROVIDERS.google,
    microsoft: OAUTH2_PROVIDERS.microsoft,
    github: OAUTH2_PROVIDERS.github
  },
  oauth2: {
    clientId: process.env.OAUTH_CLIENT_ID,
    redirectUri: 'http://localhost:3000/auth/callback'
  }
});

// Start authentication with specific provider
const result = await authManager.startAuthentication('google');
```

## Best Practices

### Security Recommendations

1. **Always use PKCE** for public clients (mobile, SPA)
2. **Enable token encryption** for sensitive environments
3. **Configure appropriate session timeouts** based on security requirements
4. **Use HTTPS only** for production deployments
5. **Implement proper error handling** with user-friendly messages
6. **Monitor session activities** for security auditing

### Performance Optimization

1. **Enable JWKS caching** to reduce network requests
2. **Configure session cleanup** to prevent memory leaks
3. **Use connection pooling** for HTTP requests
4. **Implement token refresh** before expiration
5. **Cache provider configurations** for better performance

### Production Considerations

1. **Secure storage directory** with proper file permissions
2. **Environment-specific configuration** for different stages
3. **Monitoring and alerting** for authentication failures
4. **Regular token rotation** and key updates
5. **Compliance** with OAuth 2.0 security best practices

## Migration Guide

For existing authentication systems:

1. **Install dependencies** and configure providers
2. **Migrate user sessions** to new storage format
3. **Update callback URLs** in OAuth provider settings
4. **Test authentication flows** in staging environment
5. **Deploy with feature flags** for gradual rollout

## Troubleshooting

### Common Issues

**Invalid State Parameter**
- Ensure state is properly stored and validated
- Check for timing issues with state expiration

**Token Validation Failures**
- Verify JWKS URL is accessible
- Check clock synchronization between systems
- Validate issuer and audience claims

**Session Expiration**
- Configure appropriate timeout values
- Implement automatic refresh mechanisms
- Handle expiration gracefully in UI

**Provider Configuration**
- Verify OAuth client credentials
- Check redirect URI matches exactly
- Ensure proper scope permissions

### Debug Mode

Enable debug logging for troubleshooting:

```typescript
const authManager = new AuthenticationManager({
  // ... other config
  debug: process.env.NODE_ENV === 'development'
});
```

## API Reference

For complete API documentation, see the TypeScript definitions in:
- `src/auth/types.ts` - Core type definitions
- `src/auth/index.ts` - Public API exports
- `src/auth/AuthenticationManager.ts` - Main manager class

The authentication system provides a robust, secure, and scalable foundation for OAuth 2.0 authentication in enterprise applications.