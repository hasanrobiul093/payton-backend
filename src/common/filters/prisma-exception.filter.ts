import { ArgumentsHost, Catch, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

/**
 * Prisma Exception Filter
 * Converts Prisma database errors to standard ApiResponse HTTP responses.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    switch (exception.code) {
      case 'P2002':
        // Unique constraint violation
        status = HttpStatus.CONFLICT;
        message = `Duplicate value: ${this.extractFieldFromMeta(exception.meta)}`;
        break;

      case 'P2025':
        // Record not found
        status = HttpStatus.NOT_FOUND;
        message = 'Record not found';
        break;

      case 'P2003':
        // Foreign key constraint violation
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid reference';
        break;

      case 'P2014':
        // Invalid ID
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid ID';
        break;

      default:
        this.logger.error(
          `Prisma error: ${exception.code} - ${exception.message}`,
          exception.stack,
        );
        break;
    }

    response.status(status).json({
      statusCode: status,
      message,
      meta: null,
      data: null,
      timestamp: new Date().toISOString(),
    });
  }

  private extractFieldFromMeta(meta: any): string {
    if (meta?.target) {
      return Array.isArray(meta.target) ? meta.target.join(', ') : meta.target;
    }
    return 'unknown field';
  }
}
