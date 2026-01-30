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
import { AuditAction, AuditStatus, ActionType } from '@prisma/client';

interface AuditMetadata {
  resource?: string;
  action?: AuditAction;
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
            username: user?.email,
            action: auditMetadata.action || this.getAuditActionFromMethod(request.method),
            resource: auditMetadata.resource || request.path,
            resourceId,
            metadata: {
              method: request.method,
              path: request.path,
              durationMs: Date.now() - startTime,
            },
            status: AuditStatus.SUCCESS,
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
          username: user?.email,
          action: auditMetadata.action || this.getAuditActionFromMethod(request.method),
          resource: auditMetadata.resource || request.path,
          resourceId: request.params?.id,
          metadata: {
            method: request.method,
            path: request.path,
            durationMs: Date.now() - startTime,
            error: error.message,
          },
          status: AuditStatus.FAILED,
          request,
        }).catch((e) => {
          this.logger.warn(`Failed to log audit event: ${e.message}`);
        });

        throw error;
      }),
    );
  }

  private getAuditActionFromMethod(method: string): AuditAction {
    switch (method.toUpperCase()) {
      case 'GET':
        return AuditAction.QUERY_EXECUTED; // 조회는 쿼리 실행으로 기록
      case 'POST':
        return AuditAction.CLUSTER_CREATED; // 일반적인 생성
      case 'PUT':
      case 'PATCH':
        return AuditAction.CONFIG_CHANGED; // 일반적인 수정
      case 'DELETE':
        return AuditAction.CLUSTER_DELETED; // 일반적인 삭제
      default:
        return AuditAction.QUERY_EXECUTED;
    }
  }
}
