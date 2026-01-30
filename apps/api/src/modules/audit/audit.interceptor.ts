import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { AuditEventType, ResourceType, ActionType } from '@prisma/client';

interface AuditMetadata {
  resourceType?: ResourceType;
  action?: ActionType;
  getResourceId?: (request: any, response: any) => string;
}

// 메타데이터 키
export const AUDIT_METADATA_KEY = 'audit_metadata';

// 데코레이터
export function Audited(metadata: AuditMetadata) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata(AUDIT_METADATA_KEY, metadata, target, propertyKey);
    return descriptor;
  };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();

    // 메타데이터 조회
    const auditMetadata: AuditMetadata | undefined = Reflect.getMetadata(
      AUDIT_METADATA_KEY,
      context.getClass().prototype,
      handler.name,
    );

    // 메타데이터가 없으면 감사 안 함
    if (!auditMetadata) {
      return next.handle();
    }

    const startTime = Date.now();
    const user = request.user;

    return next.handle().pipe(
      tap(async (response) => {
        try {
          const resourceId = auditMetadata.getResourceId
            ? auditMetadata.getResourceId(request, response)
            : request.params?.id;

          await this.auditService.log({
            userId: user?.id,
            eventType: AuditEventType.RESOURCE_ACCESS,
            resourceType: auditMetadata.resourceType,
            resourceId,
            action: auditMetadata.action || this.getActionFromMethod(request.method),
            details: {
              method: request.method,
              path: request.path,
              durationMs: Date.now() - startTime,
              success: true,
            },
            request,
          });
        } catch (error) {
          this.logger.warn(`Failed to log audit event: ${error.message}`);
        }
      }),
      catchError((error) => {
        // 에러 발생 시에도 감사 로깅 (실패로 기록)
        this.auditService.log({
          userId: user?.id,
          eventType: AuditEventType.RESOURCE_ACCESS,
          resourceType: auditMetadata.resourceType,
          resourceId: request.params?.id,
          action: auditMetadata.action || this.getActionFromMethod(request.method),
          details: {
            method: request.method,
            path: request.path,
            durationMs: Date.now() - startTime,
            success: false,
            error: error.message,
          },
          request,
        }).catch((e) => {
          this.logger.warn(`Failed to log audit event: ${e.message}`);
        });

        throw error;
      }),
    );
  }

  private getActionFromMethod(method: string): ActionType {
    switch (method.toUpperCase()) {
      case 'GET':
        return ActionType.VIEW;
      case 'POST':
        return ActionType.CREATE;
      case 'PUT':
      case 'PATCH':
        return ActionType.UPDATE;
      case 'DELETE':
        return ActionType.DELETE;
      default:
        return ActionType.EXECUTE;
    }
  }
}
