import 'htmx.org';

interface HtmxConfigRequestEvent extends CustomEvent {
  detail: {
    headers: Record<string, string>;
    parameters: Record<string, string>;
  };
}

interface HtmxAfterRequestEvent extends CustomEvent {
  detail: {
    xhr: XMLHttpRequest;
    target: HTMLElement;
  };
}

/**
 * Authentication Manager
 * Handles JWT token storage and htmx request interceptors
 */
export class AuthManager {
  private static readonly TOKEN_KEY = 'jwt';

  /**
   * Get JWT token from localStorage
   */
  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Store JWT token in localStorage
   */
  static setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  /**
   * Clear JWT token from localStorage
   */
  static clearToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Redirect to login if not authenticated
   */
  static requireAuth(): void {
    if (!this.isAuthenticated()) {
      window.location.href = '/';
    }
  }

  /**
   * Initialize htmx interceptors for authentication
   */
  static initHtmxInterceptors(): void {
    // Add JWT to all htmx requests
    document.body.addEventListener('htmx:configRequest', ((event: HtmxConfigRequestEvent) => {
      const token = this.getToken();
      if (token) {
        event.detail.headers['Authorization'] = `Bearer ${token}`;
      }
    }) as EventListener);

    // Handle 401 unauthorized responses
    document.body.addEventListener('htmx:afterRequest', ((event: HtmxAfterRequestEvent) => {
      if (event.detail.xhr.status === 401) {
        console.log('Unauthorized, clearing token and redirecting to login');
        this.clearToken();
        window.location.href = '/';
      }
    }) as EventListener);

    // Store JWT from login response
    document.body.addEventListener('htmx:afterRequest', ((event: HtmxAfterRequestEvent) => {
      const token = event.detail.xhr.getResponseHeader('X-Auth-Token');
      if (token) {
        console.log('Token received, storing and redirecting to directory');
        this.setToken(token);
        // Redirect to directory after successful login
        setTimeout(() => {
          window.location.href = '/directory.html';
        }, 500);
      }
    }) as EventListener);
  }
}

// Initialize htmx interceptors on page load
AuthManager.initHtmxInterceptors();

// For directory page, require authentication
if (window.location.pathname.includes('directory')) {
  AuthManager.requireAuth();
}

// Export for potential use in other modules
(window as any).AuthManager = AuthManager;
