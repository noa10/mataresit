/**
 * Security Data Protection Tests for Queue System
 * Tests data encryption, PII protection, secure data handling, and compliance
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';

// Mock encryption service
class MockEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;

  constructor(private encryptionKey: Buffer = crypto.randomBytes(32)) {}

  encrypt(plaintext: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
    cipher.setAAD(Buffer.from('queue-system'));

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  decrypt(encryptedData: { encrypted: string; iv: string; tag: string }): string {
    const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
    decipher.setAAD(Buffer.from('queue-system'));
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  hashWithSalt(data: string, salt: string): string {
    return crypto.createHash('sha256').update(data + salt).digest('hex');
  }
}

// Mock PII detection and protection service
class MockPIIProtectionService {
  private readonly piiPatterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    malaysianIC: /\b\d{6}-\d{2}-\d{4}\b/g,
    malaysianPhone: /\b(\+?6?0?1[0-9]-?[0-9]{7,8})\b/g
  };

  detectPII(text: string): { type: string; matches: string[] }[] {
    const detectedPII: { type: string; matches: string[] }[] = [];

    Object.entries(this.piiPatterns).forEach(([type, pattern]) => {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        detectedPII.push({ type, matches });
      }
    });

    return detectedPII;
  }

  maskPII(text: string): string {
    let maskedText = text;

    // Mask emails
    maskedText = maskedText.replace(this.piiPatterns.email, (match) => {
      const [local, domain] = match.split('@');
      return `${local.charAt(0)}***@${domain}`;
    });

    // Mask phone numbers
    maskedText = maskedText.replace(this.piiPatterns.phone, (match) => {
      return `***-***-${match.slice(-4)}`;
    });

    // Mask credit cards
    maskedText = maskedText.replace(this.piiPatterns.creditCard, (match) => {
      const cleaned = match.replace(/[-\s]/g, '');
      return `****-****-****-${cleaned.slice(-4)}`;
    });

    // Mask Malaysian IC
    maskedText = maskedText.replace(this.piiPatterns.malaysianIC, (match) => {
      return `******-**-${match.slice(-4)}`;
    });

    return maskedText;
  }

  sanitizeForLogging(data: any): any {
    if (typeof data === 'string') {
      return this.maskPII(data);
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeForLogging(item));
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      Object.keys(data).forEach(key => {
        // Completely remove sensitive fields
        if (['password', 'apiKey', 'token', 'secret'].includes(key.toLowerCase())) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeForLogging(data[key]);
        }
      });
      return sanitized;
    }

    return data;
  }

  validateDataMinimization(data: any, allowedFields: string[]): { valid: boolean; violations: string[] } {
    const violations: string[] = [];
    
    if (typeof data === 'object' && data !== null) {
      Object.keys(data).forEach(key => {
        if (!allowedFields.includes(key)) {
          violations.push(`Unnecessary field: ${key}`);
        }
      });
    }

    return {
      valid: violations.length === 0,
      violations
    };
  }
}

// Mock secure queue data handler
class MockSecureQueueDataHandler {
  constructor(
    private encryptionService: MockEncryptionService,
    private piiService: MockPIIProtectionService
  ) {}

  async secureQueueItem(queueItem: any): Promise<any> {
    const securedItem = { ...queueItem };

    // Encrypt sensitive metadata
    if (securedItem.metadata && typeof securedItem.metadata === 'object') {
      const metadataString = JSON.stringify(securedItem.metadata);
      const piiDetected = this.piiService.detectPII(metadataString);
      
      if (piiDetected.length > 0) {
        const encryptedMetadata = this.encryptionService.encrypt(metadataString);
        securedItem.metadata = {
          encrypted: true,
          data: encryptedMetadata
        };
      }
    }

    // Hash sensitive identifiers
    if (securedItem.source_id) {
      securedItem.source_id_hash = this.encryptionService.hash(securedItem.source_id);
    }

    // Add data classification
    securedItem.data_classification = this.classifyData(queueItem);

    return securedItem;
  }

  async retrieveQueueItem(securedItem: any): Promise<any> {
    const retrievedItem = { ...securedItem };

    // Decrypt metadata if encrypted
    if (retrievedItem.metadata?.encrypted) {
      const decryptedMetadata = this.encryptionService.decrypt(retrievedItem.metadata.data);
      retrievedItem.metadata = JSON.parse(decryptedMetadata);
    }

    return retrievedItem;
  }

  private classifyData(data: any): string {
    const dataString = JSON.stringify(data);
    const piiDetected = this.piiService.detectPII(dataString);
    
    if (piiDetected.some(pii => ['ssn', 'creditCard', 'malaysianIC'].includes(pii.type))) {
      return 'highly_sensitive';
    }
    
    if (piiDetected.some(pii => ['email', 'phone'].includes(pii.type))) {
      return 'sensitive';
    }
    
    return 'internal';
  }
}

describe('Security Data Protection Tests', () => {
  let encryptionService: MockEncryptionService;
  let piiService: MockPIIProtectionService;
  let secureDataHandler: MockSecureQueueDataHandler;

  beforeEach(() => {
    encryptionService = new MockEncryptionService();
    piiService = new MockPIIProtectionService();
    secureDataHandler = new MockSecureQueueDataHandler(encryptionService, piiService);
  });

  describe('Data Encryption Tests', () => {
    it('should encrypt and decrypt data correctly', () => {
      const plaintext = 'Sensitive queue item data';
      
      const encrypted = encryptionService.encrypt(plaintext);
      expect(encrypted.encrypted).toBeTruthy();
      expect(encrypted.iv).toBeTruthy();
      expect(encrypted.tag).toBeTruthy();
      expect(encrypted.encrypted).not.toBe(plaintext);

      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle encryption of queue metadata', async () => {
      const queueItem = {
        id: 'item-123',
        source_type: 'receipts',
        source_id: 'receipt-456',
        metadata: {
          customerEmail: 'john.doe@example.com',
          customerPhone: '555-123-4567',
          receiptData: 'Purchase details...'
        }
      };

      const securedItem = await secureDataHandler.secureQueueItem(queueItem);
      
      expect(securedItem.metadata.encrypted).toBe(true);
      expect(securedItem.metadata.data).toBeTruthy();
      expect(securedItem.data_classification).toBe('sensitive');

      const retrievedItem = await secureDataHandler.retrieveQueueItem(securedItem);
      expect(retrievedItem.metadata.customerEmail).toBe('john.doe@example.com');
    });

    it('should generate secure hashes for identifiers', () => {
      const sourceId = 'receipt-123';
      const hash1 = encryptionService.hash(sourceId);
      const hash2 = encryptionService.hash(sourceId);
      
      expect(hash1).toBe(hash2); // Same input should produce same hash
      expect(hash1).toHaveLength(64); // SHA-256 produces 64-character hex string
      expect(hash1).not.toBe(sourceId);
    });

    it('should use salt for password-like data', () => {
      const data = 'sensitive-data';
      const salt1 = encryptionService.generateSalt();
      const salt2 = encryptionService.generateSalt();
      
      const hash1 = encryptionService.hashWithSalt(data, salt1);
      const hash2 = encryptionService.hashWithSalt(data, salt2);
      
      expect(hash1).not.toBe(hash2); // Different salts should produce different hashes
      expect(salt1).not.toBe(salt2);
    });
  });

  describe('PII Detection and Protection Tests', () => {
    it('should detect various types of PII', () => {
      const textWithPII = `
        Contact John Doe at john.doe@example.com or call 555-123-4567.
        His SSN is 123-45-6789 and credit card is 4532-1234-5678-9012.
        Malaysian IC: 123456-12-1234
      `;

      const detectedPII = piiService.detectPII(textWithPII);
      
      expect(detectedPII).toHaveLength(5);
      expect(detectedPII.some(pii => pii.type === 'email')).toBe(true);
      expect(detectedPII.some(pii => pii.type === 'phone')).toBe(true);
      expect(detectedPII.some(pii => pii.type === 'ssn')).toBe(true);
      expect(detectedPII.some(pii => pii.type === 'creditCard')).toBe(true);
      expect(detectedPII.some(pii => pii.type === 'malaysianIC')).toBe(true);
    });

    it('should mask PII in text', () => {
      const textWithPII = 'Email: john.doe@example.com, Phone: 555-123-4567';
      const maskedText = piiService.maskPII(textWithPII);
      
      expect(maskedText).toContain('j***@example.com');
      expect(maskedText).toContain('***-***-4567');
      expect(maskedText).not.toContain('john.doe@example.com');
      expect(maskedText).not.toContain('555-123-4567');
    });

    it('should sanitize data for logging', () => {
      const sensitiveData = {
        id: 'item-123',
        customerEmail: 'customer@example.com',
        password: 'secret123',
        apiKey: 'mk_test_key_123',
        receiptData: 'Purchase at store, phone: 555-123-4567'
      };

      const sanitized = piiService.sanitizeForLogging(sensitiveData);
      
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.customerEmail).toContain('c***@example.com');
      expect(sanitized.receiptData).toContain('***-***-4567');
    });

    it('should validate data minimization principles', () => {
      const queueItemData = {
        id: 'item-123',
        source_type: 'receipts',
        source_id: 'receipt-456',
        status: 'pending',
        // Unnecessary fields that shouldn't be stored
        customerSocialSecurityNumber: '123-45-6789',
        internalNotes: 'Some internal notes'
      };

      const allowedFields = ['id', 'source_type', 'source_id', 'status', 'metadata'];
      const validation = piiService.validateDataMinimization(queueItemData, allowedFields);
      
      expect(validation.valid).toBe(false);
      expect(validation.violations).toContain('Unnecessary field: customerSocialSecurityNumber');
      expect(validation.violations).toContain('Unnecessary field: internalNotes');
    });
  });

  describe('Data Classification Tests', () => {
    it('should classify data based on sensitivity level', async () => {
      const highlySecureItem = {
        id: 'item-1',
        metadata: { ssn: '123-45-6789', creditCard: '4532-1234-5678-9012' }
      };

      const sensitiveItem = {
        id: 'item-2',
        metadata: { email: 'user@example.com', phone: '555-123-4567' }
      };

      const internalItem = {
        id: 'item-3',
        metadata: { receiptTotal: 25.99, storeName: 'Test Store' }
      };

      const securedHighly = await secureDataHandler.secureQueueItem(highlySecureItem);
      const securedSensitive = await secureDataHandler.secureQueueItem(sensitiveItem);
      const securedInternal = await secureDataHandler.secureQueueItem(internalItem);

      expect(securedHighly.data_classification).toBe('highly_sensitive');
      expect(securedSensitive.data_classification).toBe('sensitive');
      expect(securedInternal.data_classification).toBe('internal');
    });

    it('should apply appropriate security measures based on classification', async () => {
      const highlySensitiveItem = {
        id: 'item-1',
        metadata: { 
          customerIC: '123456-12-1234',
          bankAccount: '1234567890'
        }
      };

      const securedItem = await secureDataHandler.secureQueueItem(highlySensitiveItem);
      
      // Highly sensitive data should be encrypted
      expect(securedItem.metadata.encrypted).toBe(true);
      expect(securedItem.data_classification).toBe('highly_sensitive');
      
      // Should have hash of source ID for tracking without exposing original
      expect(securedItem.source_id_hash).toBeTruthy();
    });
  });

  describe('Secure Data Transmission Tests', () => {
    it('should validate secure transmission requirements', () => {
      const transmissionValidator = {
        validateSecureTransport: (url: string) => {
          return url.startsWith('https://');
        },
        
        validateCertificate: (cert: any) => {
          // Mock certificate validation
          return cert && cert.valid && !cert.expired;
        },
        
        validateEncryption: (data: any) => {
          return data.encrypted === true && data.algorithm && data.keyVersion;
        }
      };

      // Test secure transport
      expect(transmissionValidator.validateSecureTransport('https://api.example.com')).toBe(true);
      expect(transmissionValidator.validateSecureTransport('http://api.example.com')).toBe(false);

      // Test certificate validation
      const validCert = { valid: true, expired: false, issuer: 'CA' };
      const invalidCert = { valid: false, expired: true, issuer: 'Unknown' };
      
      expect(transmissionValidator.validateCertificate(validCert)).toBe(true);
      expect(transmissionValidator.validateCertificate(invalidCert)).toBe(false);

      // Test encryption validation
      const encryptedData = { encrypted: true, algorithm: 'AES-256-GCM', keyVersion: 'v1' };
      const unencryptedData = { data: 'plain text' };
      
      expect(transmissionValidator.validateEncryption(encryptedData)).toBe(true);
      expect(transmissionValidator.validateEncryption(unencryptedData)).toBe(false);
    });
  });

  describe('Data Retention and Deletion Tests', () => {
    it('should implement secure data deletion', () => {
      const secureDataManager = {
        secureDelete: (data: any) => {
          // Simulate secure deletion by overwriting with random data
          if (typeof data === 'string') {
            return crypto.randomBytes(data.length).toString('hex');
          }
          
          if (typeof data === 'object' && data !== null) {
            const overwritten: any = {};
            Object.keys(data).forEach(key => {
              overwritten[key] = '[SECURELY_DELETED]';
            });
            return overwritten;
          }
          
          return null;
        },
        
        validateDeletion: (original: any, deleted: any) => {
          if (typeof original === 'string') {
            return deleted !== original && deleted.length === original.length * 2; // Hex is 2x length
          }
          
          if (typeof original === 'object' && original !== null) {
            return Object.values(deleted).every(value => value === '[SECURELY_DELETED]');
          }
          
          return deleted === null;
        }
      };

      const sensitiveData = {
        customerEmail: 'customer@example.com',
        customerPhone: '555-123-4567',
        receiptData: 'Sensitive receipt information'
      };

      const deletedData = secureDataManager.secureDelete(sensitiveData);
      const isDeletionValid = secureDataManager.validateDeletion(sensitiveData, deletedData);
      
      expect(isDeletionValid).toBe(true);
      expect(deletedData.customerEmail).toBe('[SECURELY_DELETED]');
    });

    it('should enforce data retention policies', () => {
      const retentionPolicyManager = {
        policies: {
          'queue_items': { retentionDays: 90, classification: 'internal' },
          'sensitive_data': { retentionDays: 30, classification: 'sensitive' },
          'highly_sensitive_data': { retentionDays: 7, classification: 'highly_sensitive' }
        },
        
        shouldRetain: (item: any, currentDate: Date) => {
          const policy = this.policies[item.data_classification + '_data'] || this.policies['queue_items'];
          const itemDate = new Date(item.created_at);
          const daysDiff = Math.floor((currentDate.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
          
          return daysDiff < policy.retentionDays;
        },
        
        getItemsForDeletion: (items: any[], currentDate: Date) => {
          return items.filter(item => !this.shouldRetain(item, currentDate));
        }
      };

      const currentDate = new Date();
      const oldDate = new Date(currentDate.getTime() - (100 * 24 * 60 * 60 * 1000)); // 100 days ago
      
      const queueItems = [
        { id: 'item-1', data_classification: 'internal', created_at: oldDate.toISOString() },
        { id: 'item-2', data_classification: 'sensitive', created_at: oldDate.toISOString() },
        { id: 'item-3', data_classification: 'highly_sensitive', created_at: oldDate.toISOString() }
      ];

      const itemsForDeletion = retentionPolicyManager.getItemsForDeletion(queueItems, currentDate);
      
      // All items should be marked for deletion as they're older than their retention periods
      expect(itemsForDeletion).toHaveLength(3);
    });
  });

  describe('Compliance and Audit Tests', () => {
    it('should generate audit trails for data access', () => {
      const auditLogger = {
        logs: [] as any[],
        
        logDataAccess: (operation: string, data: any, user: any) => {
          this.logs.push({
            timestamp: new Date().toISOString(),
            operation,
            dataId: data.id,
            dataClassification: data.data_classification,
            userId: user.id,
            userRole: user.role,
            accessGranted: true
          });
        },
        
        getAuditTrail: (dataId: string) => {
          return this.logs.filter(log => log.dataId === dataId);
        }
      };

      const sensitiveData = { id: 'item-123', data_classification: 'sensitive' };
      const user = { id: 'user-456', role: 'admin' };

      auditLogger.logDataAccess('READ', sensitiveData, user);
      auditLogger.logDataAccess('UPDATE', sensitiveData, user);

      const auditTrail = auditLogger.getAuditTrail('item-123');
      
      expect(auditTrail).toHaveLength(2);
      expect(auditTrail[0].operation).toBe('READ');
      expect(auditTrail[1].operation).toBe('UPDATE');
      expect(auditTrail.every(log => log.userId === 'user-456')).toBe(true);
    });

    it('should validate GDPR compliance requirements', () => {
      const gdprValidator = {
        validateDataProcessingLawfulness: (purpose: string, legalBasis: string) => {
          const validBases = ['consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests'];
          return validBases.includes(legalBasis) && purpose.length > 0;
        },
        
        validateDataMinimization: (collectedData: string[], necessaryData: string[]) => {
          return collectedData.every(field => necessaryData.includes(field));
        },
        
        validateRetentionPeriod: (retentionDays: number, purpose: string) => {
          const maxRetentionByPurpose: { [key: string]: number } = {
            'receipt_processing': 2555, // 7 years for tax purposes
            'analytics': 1095, // 3 years
            'marketing': 365 // 1 year
          };
          
          return retentionDays <= (maxRetentionByPurpose[purpose] || 365);
        }
      };

      // Test lawful basis validation
      expect(gdprValidator.validateDataProcessingLawfulness('Receipt processing', 'contract')).toBe(true);
      expect(gdprValidator.validateDataProcessingLawfulness('Marketing', 'invalid_basis')).toBe(false);

      // Test data minimization
      const collected = ['name', 'email', 'receipt_data'];
      const necessary = ['name', 'email', 'receipt_data', 'phone']; // phone not collected
      expect(gdprValidator.validateDataMinimization(collected, necessary)).toBe(true);

      // Test retention period
      expect(gdprValidator.validateRetentionPeriod(365, 'marketing')).toBe(true);
      expect(gdprValidator.validateRetentionPeriod(3000, 'marketing')).toBe(false);
    });
  });
});
