import crypto from 'crypto';
import { storage } from '../storage';
import { auditLog, insertAuditLogSchema } from '@shared/schema';

// Encryption key MUST be provided via environment variable (CRITICAL SECURITY FIX)
// No fallback allowed for real-money trading security
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  console.error('[CRITICAL] ENCRYPTION_KEY must be set to 64-char hex in all environments');
  process.exit(1);
}
const ENCRYPTION_KEY_BUFFER = Buffer.from(ENCRYPTION_KEY, 'hex');
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt sensitive data like API keys using AES-256-GCM (SECURITY FIX)
 */
export function encryptSensitiveData(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY_BUFFER, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Combine IV, authTag, and encrypted data
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt sensitive data like API keys using AES-256-GCM (SECURITY FIX)
 */
export function decryptSensitiveData(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY_BUFFER, iv, {
    authTagLength: 16
  });
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Log security events for audit trail and compliance (CRITICAL SECURITY FIX)
 * Now with persistent database storage for compliance and forensics
 */
export async function logSecurityEvent(params: {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
}) {
  try {
    const logLevel = params.success ? 'info' : 'warn';
    const logPrefix = params.success ? '[AUDIT]' : '[SECURITY]';
    const timestamp = new Date().toISOString();
    
    // Log to console for immediate visibility
    console[logLevel](`${logPrefix} ${timestamp} - ${params.action} on ${params.resource} by user ${params.userId || 'anonymous'} from ${params.ipAddress || 'unknown'} - ${params.success ? 'SUCCESS' : 'FAILED'}`);
    
    if (params.details) {
      console[logLevel](`${logPrefix} Details:`, JSON.stringify(params.details, null, 2));
    }
    
    // Persist to database for audit trail and compliance (NON-BLOCKING)
    setImmediate(async () => {
      try {
        await storage.createAuditLog({
          userId: params.userId,
          action: params.action,
          resource: params.resource,
          resourceId: params.resourceId,
          details: params.details,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          success: params.success
        });
      } catch (dbError) {
        console.error('[CRITICAL] Database audit logging failed (security event NOT persisted):', dbError);
      }
    });
    
  } catch (error) {
    // Critical: audit logging should never fail silently
    console.error('[CRITICAL] Security logging failed:', error);
  }
}

/**
 * Validate API key format and permissions
 */
export function validateApiKey(apiKey: string, requiredPermissions: string[] = []): boolean {
  // Basic validation - in production, add more sophisticated checks
  if (!apiKey || apiKey.length < 20) {
    return false;
  }
  
  // Add permission validation logic here
  return true;
}

/**
 * Generate secure session token
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash sensitive data for comparison (passwords, tokens, etc)
 */
export function hashSensitiveData(data: string, salt?: string): string {
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(data, useSalt, 10000, 64, 'sha512');
  return useSalt + ':' + hash.toString('hex');
}

/**
 * Verify hashed data
 */
export function verifySensitiveData(data: string, hashedData: string): boolean {
  const [salt, hash] = hashedData.split(':');
  const verifyHash = crypto.pbkdf2Sync(data, salt, 10000, 64, 'sha512');
  return hash === verifyHash.toString('hex');
}

// logSecurityEvent is already exported above - no need for duplicate export