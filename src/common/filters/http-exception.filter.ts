import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

interface ErrorBody {
  code: string;
  message: string;
}

// Map HTTP status codes to stable machine-readable error codes
const STATUS_CODE_MAP: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  500: 'INTERNAL_SERVER_ERROR',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error: ErrorBody;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, any>;

        // Use caller-supplied code if present, otherwise derive from status
        const code: string =
          res['code'] ?? STATUS_CODE_MAP[status] ?? 'ERROR';

        // NestJS class-validator wraps messages in an array
        const message: string = Array.isArray(res['message'])
          ? res['message'][0]
          : res['message'] ?? exception.message;

        error = { code, message };
      } else {
        error = {
          code: STATUS_CODE_MAP[status] ?? 'ERROR',
          message: String(exceptionResponse),
        };
      }
    } else {
      // Unhandled errors — log but don't leak internals
      this.logger.error('Unhandled exception', exception);
      error = {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      };
    }

    response.status(status).json({ success: false, error });
  }
}
