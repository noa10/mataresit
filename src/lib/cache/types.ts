/**
 * Cache System Types and Interfaces
 * 
 * Defines the core types and interfaces for the multi-layer caching system
 * used throughout the Mataresit application for performance optimization.
 */

// Cache Entry Interface
export interface CacheEntry<T = any> {
  value: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  key: string;
  metadata?: CacheEntryMetadata;
}

export interface CacheEntryMetadata {
  userId?: string;
  queryHash?: string;
  source: CacheSource;
  size?: number; // Size in bytes
  hitCount?: number;
  lastAccessed?: number;
}

// Cache Source Types
export type CacheSource = 
  | 'llm_preprocessing'
  | 'unified_search'
  | 'financial_aggregation'
  | 'embedding_generation'
  | 'reranking_results'
  | 'ui_components'
  | 'conversation_history'
  | 'user_preferences';

// Cache Backend Types
export type CacheBackend = 'memory' | 'redis' | 'localStorage' | 'sessionStorage';

// Cache Configuration
export interface CacheConfig {
  backend: CacheBackend;
  defaultTTL: number; // Default TTL in milliseconds
  maxSize?: number; // Maximum cache size in bytes
  maxEntries?: number; // Maximum number of entries
  compressionEnabled?: boolean;
  encryptionEnabled?: boolean;
  metricsEnabled?: boolean;
}

// Cache Key Parameters
export interface CacheKeyParams {
  source: CacheSource;
  userId?: string;
  query?: string;
  filters?: Record<string, any>;
  timestamp?: number;
  version?: string;
}

// Cache Statistics
export interface CacheStats {
  hitCount: number;
  missCount: number;
  hitRate: number;
  totalEntries: number;
  totalSize: number;
  averageResponseTime: number;
  lastCleared?: number;
}

// Cache Service Interface
export interface CacheService {
  // Basic operations
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  
  // Advanced operations
  has(key: string): Promise<boolean>;
  touch(key: string, ttl?: number): Promise<void>;
  increment(key: string, delta?: number): Promise<number>;
  
  // Batch operations
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void>;
  mdelete(keys: string[]): Promise<void>;
  
  // Pattern operations
  keys(pattern: string): Promise<string[]>;
  invalidatePattern(pattern: string): Promise<void>;
  
  // Statistics and monitoring
  getStats(): Promise<CacheStats>;
  getSize(): Promise<number>;
  getEntryCount(): Promise<number>;
}

// Cache Manager Interface
export interface CacheManager {
  // Cache instance management
  getCache(source: CacheSource): CacheService;
  createCache(source: CacheSource, config: CacheConfig): CacheService;
  
  // Global operations
  clearAll(): Promise<void>;
  getGlobalStats(): Promise<Record<CacheSource, CacheStats>>;
  
  // Configuration
  updateConfig(source: CacheSource, config: Partial<CacheConfig>): Promise<void>;
  getConfig(source: CacheSource): CacheConfig;
}

// Cache Key Generator Interface
export interface CacheKeyGenerator {
  generate(params: CacheKeyParams): string;
  parse(key: string): CacheKeyParams | null;
  validate(key: string): boolean;
}

// Cache Metrics Interface
export interface CacheMetrics {
  recordHit(source: CacheSource, key: string, responseTime: number): void;
  recordMiss(source: CacheSource, key: string): void;
  recordSet(source: CacheSource, key: string, size: number): void;
  recordDelete(source: CacheSource, key: string): void;
  
  getMetrics(source: CacheSource): CacheStats;
  getAllMetrics(): Record<CacheSource, CacheStats>;
  resetMetrics(source?: CacheSource): void;
}

// Cache Event Types
export type CacheEvent = 
  | 'hit'
  | 'miss'
  | 'set'
  | 'delete'
  | 'clear'
  | 'expire'
  | 'evict';

export interface CacheEventData {
  event: CacheEvent;
  source: CacheSource;
  key: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

// Cache Event Listener Interface
export interface CacheEventListener {
  onEvent(data: CacheEventData): void;
}

// Cache Strategy Types
export type CacheStrategy = 
  | 'lru'        // Least Recently Used
  | 'lfu'        // Least Frequently Used
  | 'fifo'       // First In, First Out
  | 'ttl'        // Time To Live only
  | 'adaptive';  // Adaptive based on usage patterns

// Cache Invalidation Strategy
export interface InvalidationStrategy {
  type: 'time' | 'event' | 'manual' | 'dependency';
  config: {
    ttl?: number;
    events?: string[];
    dependencies?: string[];
    maxAge?: number;
  };
}

// Cache Warming Configuration
export interface CacheWarmingConfig {
  enabled: boolean;
  sources: CacheSource[];
  schedule?: string; // Cron expression
  preloadQueries?: string[];
  warmupOnStart?: boolean;
}

// Cache Compression Configuration
export interface CompressionConfig {
  enabled: boolean;
  algorithm: 'gzip' | 'deflate' | 'brotli';
  threshold: number; // Minimum size in bytes to compress
  level?: number; // Compression level (1-9)
}

// Cache Encryption Configuration
export interface EncryptionConfig {
  enabled: boolean;
  algorithm: 'aes-256-gcm' | 'aes-256-cbc';
  keyRotationInterval?: number; // In milliseconds
}

// Cache Health Check
export interface CacheHealthCheck {
  isHealthy: boolean;
  latency: number;
  errorRate: number;
  lastCheck: number;
  details?: Record<string, any>;
}

// Cache Error Types
export class CacheError extends Error {
  constructor(
    message: string,
    public source: CacheSource,
    public operation: string,
    public key?: string
  ) {
    super(message);
    this.name = 'CacheError';
  }
}

export class CacheTimeoutError extends CacheError {
  constructor(source: CacheSource, operation: string, key?: string) {
    super(`Cache operation timed out`, source, operation, key);
    this.name = 'CacheTimeoutError';
  }
}

export class CacheConnectionError extends CacheError {
  constructor(source: CacheSource, operation: string) {
    super(`Cache connection failed`, source, operation);
    this.name = 'CacheConnectionError';
  }
}
