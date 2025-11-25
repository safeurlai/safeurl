/**
 * Scan module schemas
 * Re-export schemas from @safeurl/core for use in routes
 */
export {
  createScanRequestSchema,
  getScanRequestSchema,
  createScanResponseSchema,
  scanResponseSchema,
  errorResponseSchema,
  type CreateScanRequest,
  type GetScanRequest,
  type CreateScanResponse,
  type ScanResponse,
  type ErrorResponse,
} from "@safeurl/core/schemas";
