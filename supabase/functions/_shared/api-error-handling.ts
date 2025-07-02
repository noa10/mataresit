/**
 * API Error Handling and Logging
 * Provides comprehensive error handling, logging, and response formatting
 */

import type { ApiContext } from './api-auth.ts';

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  statusCode: number;
  timestamp: string;
  requestId?: string;
  userId?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Standard API error codes
 */
export const ErrorCodes = {
  // Authentication & Authorization
  INVALID_API_KEY: 'INVALID_API_KEY',
  EXPIRED_API_KEY: 'EXPIRED_API_KEY',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  ACCESS_DENIED: 'ACCESS_DENIED',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SUBSCRIPTION_LIMIT_EXCEEDED: 'SUBSCRIPTION_LIMIT_EXCEEDED',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_REQUEST_BODY: 'INVALID_REQUEST_BODY',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_VALUE: 'INVALID_FIELD_VALUE',

  // Resources
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',

  // Database
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',

  // General
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE'
} as const;

/**
 * Creates a standardized API error
 */
export function createApiError(
  code: string,
  message: string,
  statusCode: number,
  details?: any,
  context?: ApiContext
): ApiError {
  return {
    code,
    message,
    details,
    statusCode,
    timestamp: new Date().toISOString(),
    userId: context?.userId
  };
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  error: ApiError | string,
  statusCode?: number,
  context?: ApiContext
): Response {
  let apiError: ApiError;

  if (typeof error === 'string') {
    apiError = createApiError(
      ErrorCodes.INTERNAL_SERVER_ERROR,
      error,
      statusCode || 500,
      undefined,
      context
    );
  } else {
    apiError = error;
  }

  // Log error for monitoring
  logError(apiError, context);

  return new Response(
    JSON.stringify({
      error: true,
      code: apiError.code,
      message: apiError.message,
      details: apiError.details,
      timestamp: apiError.timestamp,
      requestId: apiError.requestId
    }),
    {
      status: apiError.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'X-Error-Code': apiError.code
      }
    }
  );
}

/**
 * Creates a validation error response
 */
export function createValidationErrorResponse(
  errors: ValidationError[],
  context?: ApiContext
): Response {
  const apiError = createApiError(
    ErrorCodes.VALIDATION_ERROR,
    'Validation failed',
    400,
    { validationErrors: errors },
    context
  );

  return createErrorResponse(apiError, 400, context);
}

/**
 * Creates a permission error response
 */
export function createPermissionErrorResponse(
  requiredScope: string,
  context?: ApiContext
): Response {
  const apiError = createApiError(
    ErrorCodes.INSUFFICIENT_PERMISSIONS,
    `Insufficient permissions. Required scope: ${requiredScope}`,
    403,
    { requiredScope, userScopes: context?.scopes },
    context
  );

  return createErrorResponse(apiError, 403, context);
}

/**
 * Creates a not found error response
 */
export function createNotFoundErrorResponse(
  resource: string,
  id?: string,
  context?: ApiContext
): Response {
  const message = id 
    ? `${resource} with ID '${id}' not found`
    : `${resource} not found`;

  const apiError = createApiError(
    ErrorCodes.RESOURCE_NOT_FOUND,
    message,
    404,
    { resource, id },
    context
  );

  return createErrorResponse(apiError, 404, context);
}

/**
 * Creates a database error response
 */
export function createDatabaseErrorResponse(
  operation: string,
  dbError: any,
  context?: ApiContext
): Response {
  // Don't expose internal database errors to clients
  const message = `Database operation failed: ${operation}`;
  
  const apiError = createApiError(
    ErrorCodes.DATABASE_ERROR,
    message,
    500,
    { operation },
    context
  );

  // Log the actual database error internally
  console.error('Database Error:', {
    operation,
    error: dbError,
    userId: context?.userId,
    timestamp: new Date().toISOString()
  });

  return createErrorResponse(apiError, 500, context);
}

/**
 * Validates required fields in request body
 */
export function validateRequiredFields(
  body: any,
  requiredFields: string[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      errors.push({
        field,
        message: `${field} is required`,
        value: body[field]
      });
    }
  }

  return errors;
}

/**
 * Validates field types and formats
 */
export function validateFieldTypes(
  body: any,
  fieldValidations: Record<string, (value: any) => string | null>
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [field, validator] of Object.entries(fieldValidations)) {
    if (body[field] !== undefined) {
      const error = validator(body[field]);
      if (error) {
        errors.push({
          field,
          message: error,
          value: body[field]
        });
      }
    }
  }

  return errors;
}

/**
 * Common field validators
 */
export const FieldValidators = {
  positiveNumber: (value: any): string | null => {
    if (typeof value !== 'number' || value <= 0) {
      return 'Must be a positive number';
    }
    return null;
  },

  nonNegativeNumber: (value: any): string | null => {
    if (typeof value !== 'number' || value < 0) {
      return 'Must be a non-negative number';
    }
    return null;
  },

  nonEmptyString: (value: any): string | null => {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return 'Must be a non-empty string';
    }
    return null;
  },

  minLength: (min: number) => (value: any): string | null => {
    if (typeof value !== 'string' || value.length < min) {
      return `Must be at least ${min} characters long`;
    }
    return null;
  },

  maxLength: (max: number) => (value: any): string | null => {
    if (typeof value !== 'string' || value.length > max) {
      return `Must be no more than ${max} characters long`;
    }
    return null;
  },

  validDate: (value: any): string | null => {
    if (typeof value !== 'string' || isNaN(Date.parse(value))) {
      return 'Must be a valid date string';
    }
    return null;
  },

  validEmail: (value: any): string | null => {
    if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'Must be a valid email address';
    }
    return null;
  },

  oneOf: (validValues: any[]) => (value: any): string | null => {
    if (!validValues.includes(value)) {
      return `Must be one of: ${validValues.join(', ')}`;
    }
    return null;
  },

  uuid: (value: any): string | null => {
    if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      return 'Must be a valid UUID';
    }
    return null;
  }
};

// Export alias for backward compatibility
export const validators = FieldValidators;

/**
 * Validates a UUID and returns an error response if invalid
 */
export function validateUUID(value: string, fieldName: string): Response | null {
  const error = FieldValidators.uuid(value);
  if (error) {
    return new Response(
      JSON.stringify({
        error: true,
        code: 400,
        message: `Invalid ${fieldName} format. Expected UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`,
        field: fieldName,
        received: value,
        timestamp: new Date().toISOString()
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
  return null;
}

/**
 * Logs errors for monitoring and debugging
 */
function logError(error: ApiError, context?: ApiContext): void {
  const logEntry = {
    level: 'ERROR',
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
    details: error.details,
    userId: context?.userId,
    keyId: context?.keyId,
    timestamp: error.timestamp
  };

  console.error('API Error:', logEntry);

  // In production, you might want to send this to a logging service
  // like DataDog, Sentry, or CloudWatch
}

/**
 * Wraps async functions with error handling
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context?: ApiContext
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error('Unhandled error in API function:', error);
      
      // Create a generic error response
      const apiError = createApiError(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'An unexpected error occurred',
        500,
        undefined,
        context
      );

      throw apiError;
    }
  };
}
