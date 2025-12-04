/**
 * Global type declarations for @safeurl/api-cf
 * Makes CFElysiaApp available as a global type
 */

declare global {
  type CFElysiaApp = import("./app").CFElysiaApp;
}

export {};
