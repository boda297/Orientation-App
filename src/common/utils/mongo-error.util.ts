import { HttpStatus } from '@nestjs/common';
import { Error as MongooseError } from 'mongoose';

/**
 * Sanitized HTTP error shape returned by the translator.
 */
export interface TranslatedError {
  statusCode: number;
  error: string;
  message: string;
}

/**
 * MongoErrorTranslator
 *
 * Single-responsibility: inspect a thrown exception and translate
 * known Mongoose / MongoDB driver errors into safe HTTP payloads.
 *
 * Returns null for anything it does not recognise so the caller
 * (GlobalExceptionFilter) can apply its own fallback strategy.
 *
 * OCP note: add future adapter cases (Redis, S3, …) below without
 * touching GlobalExceptionFilter.
 */
export class MongoErrorTranslator {
  static translate(exception: unknown): TranslatedError | null {
    // ── Duplicate Key (MongoDB driver error code 11000) ──────────────
    if (MongoErrorTranslator.isDuplicateKeyError(exception)) {
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: 'A record with this value already exists.',
      };
    }

    // ── Mongoose ValidationError ─────────────────────────────────────
    if (exception instanceof MongooseError.ValidationError) {
      const messages = Object.values(exception.errors)
        .map((e) => e.message)
        // Strip schema paths / collection names from Mongoose messages
        .map((msg) => MongoErrorTranslator.sanitizeMessage(msg));

      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: messages.join('; ') || 'Validation failed.',
      };
    }

    // ── Mongoose CastError (malformed ObjectId, wrong type, …) ───────
    if (exception instanceof MongooseError.CastError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Invalid resource identifier format.',
      };
    }

    return null;
  }

  // ─── private helpers ────────────────────────────────────────────────

  private static isDuplicateKeyError(exception: unknown): boolean {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      (exception as Record<string, unknown>)['code'] === 11000
    );
  }

  /**
   * Strips Mongoose-generated phrases that leak schema internals:
   *   "Path `email` is required." -> "Field is required."
   *   "Cast to ObjectId failed for value …" -> sanitised above in CastError
   */
  private static sanitizeMessage(message: string): string {
    return message
      .replace(/Path `[^`]+`/g, 'Field')
      .replace(/`[^`]+`/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
}
