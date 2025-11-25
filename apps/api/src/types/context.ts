/**
 * Extended ElysiaJS context types
 * Adds custom properties to the request context
 */

/**
 * User information from authentication
 */
export interface AuthenticatedUser {
  userId: string;
  clerkUserId: string;
}

/**
 * Extended context with authenticated user
 */
export interface AuthenticatedContext {
  user: AuthenticatedUser;
}

