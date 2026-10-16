import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    if (!(exception instanceof HttpException) || status >= 500) {
      const message =
        exception instanceof Error
          ? exception.message
          : 'A non-Error exception was thrown';
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `${request.method} ${request.url} - ${message}`,
        stack,
      );
    }

    if (response.headersSent) {
      response.end();
      return;
    }

    if (
      exceptionResponse !== null &&
      typeof exceptionResponse === 'object'
    ) {
      response.status(status).json(exceptionResponse);
      return;
    }

    response.status(status).json({
      statusCode: status,
      message:
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : 'Internal server error',
    });
  }
}
