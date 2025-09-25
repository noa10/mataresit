/**
 * Enhanced error handling for authentication flows
 */

export interface AuthError {
  code: string;
  message: string;
  details?: any;
  userMessage: string;
  action?: string;
}

export class AuthErrorHandler {
  static handleOAuthError(error: any): AuthError {
    console.error('OAuth Error:', error);

    // Check for common OAuth errors
    if (error.message?.includes('redirect_uri_mismatch')) {
      return {
        code: 'REDIRECT_URI_MISMATCH',
        message: error.message,
        userMessage: 'Authentication configuration error. Please contact support.',
        action: 'Check Supabase redirect URL configuration'
      };
    }

    if (error.message?.includes('access_denied')) {
      return {
        code: 'ACCESS_DENIED',
        message: error.message,
        userMessage: 'Google authentication was cancelled or denied.',
        action: 'Try signing in again'
      };
    }

    if (error.message?.includes('invalid_request')) {
      return {
        code: 'INVALID_REQUEST',
        message: error.message,
        userMessage: 'Invalid authentication request. Please try again.',
        action: 'Refresh page and try again'
      };
    }

    if (error.message?.includes('network') || error.message?.includes('fetch')) {
      return {
        code: 'NETWORK_ERROR',
        message: error.message,
        userMessage: 'Network connection issue. Please check your internet connection.',
        action: 'Check internet connection and try again'
      };
    }

    // Generic error
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'Unknown authentication error',
      userMessage: 'An unexpected error occurred during authentication. Please try again.',
      action: 'Try again or contact support if the issue persists'
    };
  }

  static handleSessionError(error: any): AuthError {
    console.error('Session Error:', error);

    if (error.message?.includes('session_not_found')) {
      return {
        code: 'SESSION_NOT_FOUND',
        message: error.message,
        userMessage: 'Your session has expired. Please sign in again.',
        action: 'Sign in again'
      };
    }

    if (error.message?.includes('invalid_token')) {
      return {
        code: 'INVALID_TOKEN',
        message: error.message,
        userMessage: 'Your authentication token is invalid. Please sign in again.',
        action: 'Sign in again'
      };
    }

    return {
      code: 'SESSION_ERROR',
      message: error.message || 'Session error',
      userMessage: 'There was a problem with your session. Please sign in again.',
      action: 'Sign in again'
    };
  }

  static logAuthEvent(event: string, details?: any) {
    if (import.meta.env.DEV) {
      console.log(`[Auth Event] ${event}`, details);
    }
    
    // In production, you might want to send this to an analytics service
    // analytics.track('auth_event', { event, details });
  }
}

/**
 * Enhanced redirect URL validation
 */
export class RedirectUrlValidator {
  private static allowedHosts = [
    'localhost',
    'mataresit.co',
    'paperless-maverick.vercel.app'
  ];

  private static allowedPorts = [3000, 5173, 8080];

  static validateRedirectUrl(url: string): { valid: boolean; reason?: string } {
    try {
      const urlObj = new URL(url);
      
      // Check protocol
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { valid: false, reason: 'Invalid protocol. Must be http or https.' };
      }

      // Check hostname
      const isAllowedHost = this.allowedHosts.some(host => 
        urlObj.hostname === host || urlObj.hostname.endsWith(`.${host}`)
      );

      if (!isAllowedHost) {
        return { valid: false, reason: `Hostname ${urlObj.hostname} is not allowed.` };
      }

      // Check port for localhost
      if (urlObj.hostname === 'localhost') {
        const port = parseInt(urlObj.port) || (urlObj.protocol === 'https:' ? 443 : 80);
        if (!this.allowedPorts.includes(port)) {
          return { valid: false, reason: `Port ${port} is not allowed for localhost.` };
        }
      }

      // Check path
      if (!urlObj.pathname.startsWith('/auth')) {
        return { valid: false, reason: 'Path must start with /auth' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, reason: 'Invalid URL format.' };
    }
  }

  static getRecommendedRedirectUrl(): string {
    const currentOrigin = window.location.origin;
    const urlObj = new URL(currentOrigin);
    
    // If current origin is valid, use it
    const validation = this.validateRedirectUrl(`${currentOrigin}/auth`);
    if (validation.valid) {
      return `${currentOrigin}/auth`;
    }

    // Fallback to a known good URL
    if (urlObj.hostname === 'localhost') {
      return 'http://localhost:5173/auth';
    }

    return 'https://mataresit.co/auth';
  }
}
