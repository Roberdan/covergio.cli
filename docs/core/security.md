# Security Implementation

The Convergio CLI core package implements comprehensive security measures to protect user data, ensure secure communications, and maintain system integrity. This document outlines the security architecture and components.

## Overview

The security system provides:

- **Data Encryption**: AES-256-GCM authenticated encryption for data at rest
- **Key Management**: Hierarchical key management with master key protection
- **Secure Transport**: TLS 1.3 enforcement for all HTTP communications
- **Certificate Validation**: Comprehensive certificate chain validation and monitoring
- **Authentication**: OAuth 2.0 with PKCE for secure user authentication
- **Authorization**: Role-Based Access Control (RBAC) with fine-grained permissions
- **Security Monitoring**: Audit logging and health checks

## Security Manager

The `SecurityManager` class serves as the central interface for all security operations:

```typescript
import { SecurityManager } from '@convergio/core/security';

const securityManager = new SecurityManager({
  encryption: {
    keyRotationInterval: 90
  },
  transport: {
    enforceHttps: true,
    tlsMinVersion: 'TLSv1.3'
  },
  certificates: {
    checkRevocation: true,
    warningDaysBeforeExpiration: 30
  }
});

await securityManager.initialize('master-password');
```

## Data Encryption

### AES-256-GCM Encryption

All sensitive data is encrypted using AES-256-GCM (Galois/Counter Mode) which provides:

- **Confidentiality**: 256-bit AES encryption
- **Authenticity**: Built-in authentication prevents tampering
- **Performance**: Hardware-accelerated on modern processors

```typescript
// Encrypt sensitive data
const encrypted = await securityManager.encryptData(
  'sensitive information',
  'user-password'
);

// Decrypt data
const decrypted = await securityManager.decryptData(
  encrypted,
  'user-password'
);
```

### Key Derivation

Keys are derived from passwords using scrypt with secure parameters:

- **N**: 16384 (cost factor)
- **r**: 8 (block size)
- **p**: 1 (parallelization factor)

This provides resistance against:
- Brute force attacks
- Rainbow table attacks
- Time-memory trade-off attacks

## Key Management

### Hierarchical Key Architecture

The system implements a hierarchical key structure:

```
Master Key (encrypted with user password)
    ├── Data Encryption Key 1
    ├── Data Encryption Key 2
    └── Data Encryption Key N
```

### Master Key Protection

- Encrypted using scrypt-derived key from user password
- Stored with secure file permissions (600)
- Automatic backup creation
- Password change capability

### Data Encryption Keys (DEKs)

- Generated using cryptographically secure random number generator
- Encrypted with master key using AES-256-GCM
- Individual keys for different data types/purposes
- Key rotation support with versioning

```typescript
// Create a new encryption key
await securityManager.createEncryptionKey(
  'user-settings',
  'master-password',
  'Key for user configuration data'
);

// Rotate an existing key
const result = await securityManager.rotateEncryptionKey(
  'user-settings',
  'master-password'
);
```

## Secure Transport

### TLS 1.3 Enforcement

All HTTP communications enforce TLS 1.3 with strong cipher suites:

- `TLS_AES_256_GCM_SHA384`
- `TLS_CHACHA20_POLY1305_SHA256` 
- `TLS_AES_128_GCM_SHA256`

### Certificate Pinning

Support for certificate pinning to prevent man-in-the-middle attacks:

```typescript
// Add certificate pin for a specific hostname
securityManager.addCertificatePin(
  'api.example.com',
  'YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2Fuihg=',
  'sha256'
);
```

### Secure HTTP Client

```typescript
// Make secure requests
const response = await securityManager.secureRequest('https://api.example.com/data', {
  method: 'POST',
  body: JSON.stringify({ data: 'value' }),
  headers: { 'Content-Type': 'application/json' }
});
```

## Certificate Validation

### Comprehensive Validation

The certificate validator performs multiple checks:

1. **Certificate Chain Validation**: Verifies complete chain to trusted root
2. **Hostname Verification**: Ensures certificate matches requested hostname
3. **Expiration Checking**: Validates certificate validity period
4. **Revocation Status**: OCSP checking for revoked certificates
5. **Key Strength Validation**: Ensures minimum key sizes (RSA 2048+, EC 256+)

### Certificate Monitoring

```typescript
// Validate server certificate
const result = await securityManager.validateServerCertificate('example.com', 443);

if (!result.isValid) {
  console.log('Certificate errors:', result.errors);
}

// Check certificate expiration
const expiration = await securityManager.checkCertificateExpiration('example.com');
if (expiration.isExpiringSoon) {
  console.log(`Certificate expires in ${expiration.daysUntilExpiration} days`);
}
```

## Authentication System

### OAuth 2.0 Implementation

The authentication system implements OAuth 2.0 authorization code flow with PKCE:

```typescript
import { AuthenticationManager } from '@convergio/core/auth';

const authManager = new AuthenticationManager({
  provider: 'google',
  clientId: 'your-client-id',
  redirectUri: 'http://localhost:8080/callback',
  scopes: ['openid', 'profile', 'email']
});

// Start authentication flow
const authUrl = await authManager.getAuthorizationUrl();

// Complete authentication with authorization code
const tokens = await authManager.authenticate(authorizationCode);
```

### Secure Token Management

- **JWT Validation**: Comprehensive token validation with JWKS support
- **Refresh Tokens**: Automatic token refresh with secure storage
- **Session Management**: Session lifecycle with configurable timeouts
- **Multi-Device Support**: Concurrent session management

### Supported Providers

The system supports major OAuth 2.0 providers:
- Google OAuth 2.0
- Microsoft Azure AD
- Auth0
- Okta
- GitHub OAuth

## Authorization System

### Role-Based Access Control (RBAC)

The authorization system implements comprehensive RBAC with fine-grained permissions:

```typescript
import { AuthorizationService } from '@convergio/core/auth/authorization';

const authService = new AuthorizationService({
  enableAttributeBasedAccess: true,
  enableRoleHierarchy: true,
  auditEnabled: true
});

// Create permissions
await authService.createPermission({
  id: 'users:read',
  name: 'Read Users',
  resource: 'users',
  action: 'read'
});

// Create roles with hierarchy
await authService.createRole({
  id: 'editor',
  name: 'Editor',
  permissions: ['users:write'],
  inheritFrom: ['viewer'] // Inherits viewer permissions
});

// Assign roles to users
await authService.assignRole('user123', 'editor', 'admin');
```

### Attribute-Based Access Control (ABAC)

Support for conditional permissions based on context:

```typescript
// Permission with conditions
const conditionalPermission = {
  id: 'sensitive:read',
  name: 'Read Sensitive Data',
  resource: 'sensitive',
  action: 'read',
  conditions: [
    {
      attribute: 'department',
      operator: 'equals',
      value: 'security',
      context: 'user'
    }
  ]
};
```

### Authorization Middleware

Express-style middleware for API endpoint protection:

```typescript
import { createAuthorizationMiddleware } from '@convergio/core/auth/authorization/middleware';

const authMiddleware = createAuthorizationMiddleware(authService, {
  extractResource: (req) => req.path.split('/')[1],
  extractAction: (req) => req.method.toLowerCase(),
  skipPaths: ['/health', '/public/*']
});

app.use(authMiddleware);
```

### Role Management Features

- **Role Hierarchy**: Inheritance with principle of least privilege
- **Dynamic Permissions**: Runtime permission changes
- **Bulk Operations**: Efficient batch authorization checks
- **Permission Matrix**: Analysis and visualization tools
- **Circular Dependency Detection**: Prevents invalid role hierarchies

## Security Monitoring

### Audit Logging

All security operations are logged with structured audit entries:

```typescript
interface SecurityAuditEntry {
  timestamp: string;
  event: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  details: Record<string, any>;
  source: string;
}
```

### Authorization Audit Logs

Comprehensive logging for all authorization decisions:

```typescript
interface AuthorizationAuditLog {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  resource: string;
  result: 'granted' | 'denied';
  reason?: string;
  context: AuthorizationContext;
  sessionId?: string;
}
```

### Health Checks

Regular security health checks validate system state:

```typescript
const healthCheck = await securityManager.performHealthCheck();

console.log('Overall security status:', healthCheck.overall);
console.log('Issues found:', healthCheck.issues);
console.log('Recommendations:', healthCheck.recommendations);
```

### Audit Log Management

```typescript
// Get recent audit entries
const auditLog = securityManager.getAuditLog(50);

// Clear audit log (creates audit entry for this action)
securityManager.clearAuditLog();
```

## Security Best Practices

### Password Requirements

- Minimum 12 characters for master passwords
- Use unique passwords for different environments
- Consider using password managers for complex passwords

### Key Rotation

- Rotate data encryption keys every 90 days (configurable)
- Monitor key usage and rotate after significant operations
- Maintain key backup and recovery procedures

### Certificate Management

- Enable certificate pinning for critical API endpoints
- Monitor certificate expiration dates
- Use Certificate Transparency logs when available
- Implement certificate validation in all TLS connections

### Network Security

- Enforce HTTPS for all external communications
- Use TLS 1.3 with strong cipher suites
- Implement proper certificate validation
- Consider VPN or private networks for sensitive operations

## Configuration Options

### Security Configuration

```typescript
interface SecurityConfig {
  encryption?: {
    masterPassword?: string;
    keyRotationInterval?: number; // days
  };
  transport?: {
    enforceHttps?: boolean;
    certificatePinning?: boolean;
    tlsMinVersion?: string;
  };
  certificates?: {
    checkRevocation?: boolean;
    checkCertificateTransparency?: boolean;
    warningDaysBeforeExpiration?: number;
  };
  keyManagement?: {
    configDir?: string;
    autoBackup?: boolean;
  };
  authentication?: {
    provider?: 'google' | 'microsoft' | 'auth0' | 'okta' | 'github';
    clientId?: string;
    redirectUri?: string;
    scopes?: string[];
    sessionTimeout?: number; // minutes
  };
  authorization?: {
    enableAttributeBasedAccess?: boolean;
    enableRoleHierarchy?: boolean;
    enablePolicyEngine?: boolean;
    defaultDenyAll?: boolean;
    auditEnabled?: boolean;
    strictMode?: boolean;
    maxRoleDepth?: number;
  };
}
```

### Default Configuration

```typescript
export const DEFAULT_SECURITY_CONFIG = {
  encryption: {
    keyRotationInterval: 90,
  },
  transport: {
    enforceHttps: true,
    certificatePinning: true,
    tlsMinVersion: 'TLSv1.3',
  },
  certificates: {
    checkRevocation: true,
    checkCertificateTransparency: false,
    warningDaysBeforeExpiration: 30,
  },
  keyManagement: {
    autoBackup: true,
  },
  authentication: {
    sessionTimeout: 480, // 8 hours
    scopes: ['openid', 'profile', 'email']
  },
  authorization: {
    enableAttributeBasedAccess: true,
    enableRoleHierarchy: true,
    enablePolicyEngine: true,
    defaultDenyAll: false,
    auditEnabled: true,
    strictMode: false,
    maxRoleDepth: 10
  }
};
```

## Error Handling

The security system implements comprehensive error handling:

- **Encryption Errors**: Invalid passwords, corrupted data
- **Key Management Errors**: Missing keys, access denied
- **Network Errors**: TLS failures, certificate validation
- **Configuration Errors**: Invalid settings, missing required fields
- **Authentication Errors**: Invalid tokens, expired sessions, provider failures
- **Authorization Errors**: Access denied, invalid permissions, role conflicts
- **Validation Errors**: Invalid context, missing required fields

All errors are logged to the audit system with appropriate severity levels.

### Authorization Error Types

```typescript
enum AuthorizationErrorType {
  PERMISSION_DENIED = 'permission_denied',
  ROLE_NOT_FOUND = 'role_not_found',
  PERMISSION_NOT_FOUND = 'permission_not_found',
  INVALID_CONTEXT = 'invalid_context',
  CIRCULAR_DEPENDENCY = 'circular_dependency',
  MAX_DEPTH_EXCEEDED = 'max_depth_exceeded',
  POLICY_EVALUATION_ERROR = 'policy_evaluation_error'
}
```

## Performance Considerations

### Encryption Performance

- Hardware AES acceleration when available
- Efficient key derivation with optimal parameters
- Memory clearing for sensitive data

### Certificate Validation

- Certificate validation results cached (1 hour)
- OCSP response caching
- Parallel validation when possible

### Key Management

- Lazy loading of encryption keys
- Efficient key storage format
- Minimal memory footprint

### Authentication Performance

- JWT token validation caching
- Session state optimized storage
- Efficient PKCE parameter generation
- Connection pooling for OAuth providers

### Authorization Performance

- Permission evaluation caching (5 minutes default)
- Role hierarchy computation optimization
- Bulk authorization operations
- Lazy loading of role permissions
- Efficient policy evaluation engine

## Security Compliance

The security implementation addresses common security frameworks:

- **OWASP**: Top 10 security risks mitigation
- **NIST**: Cryptographic standards compliance
- **SOC 2**: Security controls implementation
- **GDPR**: Data protection requirements

## Future Enhancements

Planned security improvements:

1. **Hardware Security Module (HSM) Integration**
2. **Multi-factor Authentication Support**
3. **Zero-Knowledge Architecture**
4. **Quantum-Resistant Cryptography**
5. **Advanced Threat Detection**