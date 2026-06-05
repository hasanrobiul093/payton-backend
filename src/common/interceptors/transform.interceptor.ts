import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../helpers/api-response.helper';

/**
 * Transform Interceptor
 * Detects if the controller already returned an ApiResponse-shaped object.
 * - If YES → passes it through unchanged (no double-wrapping).
 * - If NO  → wraps the raw payload in the standard ApiResponse shape.
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const statusCode = context.switchToHttp().getResponse().statusCode;

    return next.handle().pipe(
      map((payload) => {
        // Already in standard shape → pass through as-is
        if (
          payload !== null &&
          typeof payload === 'object' &&
          'statusCode' in payload &&
          'message' in payload &&
          'data' in payload &&
          'timestamp' in payload
        ) {
          return payload as ApiResponse<T>;
        }

        // Raw data → wrap in standard shape
        return {
          statusCode,
          message: 'Success',
          meta: null,
          data: payload ?? null,
          timestamp: new Date().toISOString(),
        } as ApiResponse<T>;
      }),
    );
  }
}
