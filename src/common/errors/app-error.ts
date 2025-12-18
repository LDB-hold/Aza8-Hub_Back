export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'TENANT_MISMATCH'
  | 'UNAUTHORIZED'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'TENANT_NOT_FOUND'
  | 'TENANT_SUSPENDED'
  | 'FORBIDDEN_ACTION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'DUPLICATE_RESOURCE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'DATABASE_ERROR'
  | 'SERVICE_UNAVAILABLE';

export type AppErrorDetails = Record<string, unknown>;

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly httpStatus: number;
  public readonly details?: AppErrorDetails;

  constructor(params: { code: AppErrorCode; httpStatus: number; message: string; details?: AppErrorDetails }) {
    super(params.message);
    this.code = params.code;
    this.httpStatus = params.httpStatus;
    this.details = params.details;
  }
}

