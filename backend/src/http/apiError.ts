export class ApiError extends Error {
  readonly statusCode: number;
  readonly code?: string;

  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }

  static badRequest(message: string, code = 'bad_request'): ApiError {
    return new ApiError(400, message, code);
  }

  static unauthorized(message = 'Unauthorized', code = 'unauthorized'): ApiError {
    return new ApiError(401, message, code);
  }

  static notFound(message = 'Not found', code = 'not_found'): ApiError {
    return new ApiError(404, message, code);
  }

  static conflict(message: string, code = 'conflict'): ApiError {
    return new ApiError(409, message, code);
  }

  static serviceUnavailable(message: string, code = 'service_unavailable'): ApiError {
    return new ApiError(503, message, code);
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
