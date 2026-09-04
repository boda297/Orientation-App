import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class HTTPLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl, body } = req;
    const startTime = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;

      // Mask sensitive query parameters before logging.
      // `hmac` is Paymob's per-transaction signature — logging it raw would
      // allow anyone with log access to replay a captured webhook payload.
      const safeUrl = originalUrl.replace(
        /([?&]hmac=)[^&]*/gi,
        '$1***',
      );

      let bodyLog = '';
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && body && Object.keys(body).length > 0) {
        // Sanitize sensitive fields
        const sanitizedBody = { ...body };
        if (sanitizedBody.password) sanitizedBody.password = '***';
        if (sanitizedBody.confirmPassword) sanitizedBody.confirmPassword = '***';
        if (sanitizedBody.token) sanitizedBody.token = '***';
        if (sanitizedBody.refreshToken) sanitizedBody.refreshToken = '***';

        const jsonString = JSON.stringify(sanitizedBody);
        // Truncate if too long (e.g. large JSON)
        const truncated = jsonString.length > 500 ? `${jsonString.slice(0, 500)}...` : jsonString;
        bodyLog = ` | Body: ${truncated}`;
      }

      const logMessage = `[${method}] ${safeUrl} ${statusCode} - ${duration}ms${bodyLog}`;

      if (statusCode >= 500) {
        this.logger.error(logMessage);
      } else if (statusCode >= 400) {
        this.logger.warn(logMessage);
      } else {
        this.logger.log(logMessage);
      }
    });

    next();
  }
}

