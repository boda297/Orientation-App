import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { MongoErrorTranslator } from '../utils/mongo-error.util';
import { getReasonPhrase } from 'http-status-codes';

/**
 * GlobalExceptionFilter
 *
 * Catches every unhandled exception across the application and converts
 * it into a standardised, information-safe JSON error response.
 *
 * Responsibility boundary (SRP):
 *   • This class owns HTTP response formatting and logging only.
 *   • MongoDB/Mongoose error parsing is delegated to MongoErrorTranslator.
 *
 * Registration: use APP_FILTER in AppModule (DI-managed) — never
 * app.useGlobalFilters(new …) which breaks Dependency Injection.
 */
@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number;
    let error: string;
    let message: string | string[];

    // ── 1. NestJS / HTTP exceptions ───────────────────────────────────
    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const bodyObj = body as Record<string, unknown>;
        message =
          (bodyObj['message'] as string | string[]) ?? exception.message;
      } else {
        message = exception.message;
      }

      error = GlobalExceptionFilter.httpStatusText(statusCode);
    }

    // ── 2. Known MongoDB / Mongoose errors ────────────────────────────
    else {
      const translated = MongoErrorTranslator.translate(exception);

      if (translated) {
        statusCode = translated.statusCode;
        error = translated.error;
        message = translated.message;
      }

      // ── 3. Unhandled / unexpected crash ──────────────────────────────
      else {
        statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
        error = 'Internal Server Error';
        message = 'An unexpected internal server error occurred.';

        // Log the real stack internally — never sent to the client
        const err = exception as Error | undefined;
        this.logger.error(
          `Unhandled exception on [${request.method}] ${request.url}: ${err?.message ?? String(exception)}`,
          err?.stack,
        );
      }
    }

    // ── Emit standardised JSON response ──────────────────────────────
    response.status(statusCode).json({
      success: false,
      statusCode,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  // ─── helpers ─────────────────────────────────────────────────────────

  private static httpStatusText(statusCode: number): string {
    try {
      return getReasonPhrase(statusCode);
    } catch {
      return 'Error';
    }
  }
}
