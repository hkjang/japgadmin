import { ScopeType, ResourceType, ActionType } from '@prisma/client';

export interface PredefinedRole {
  name: string;
  description: string;
  scopeType: ScopeType;
  isSystem: boolean;
  permissions: { resource: ResourceType; action: ActionType; conditions?: any }[];
}

export const SYSTEM_ROLES: PredefinedRole[] = [
  {
    name: 'Super Admin',
    description: '전체 시스템에 대한 모든 권한을 가진 최고 관리자',
    scopeType: ScopeType.GLOBAL,
    isSystem: true,
    permissions: [
      // All resources with ADMIN action (includes all other actions)
      { resource: ResourceType.CLUSTER, action: ActionType.ADMIN },
      { resource: ResourceType.INSTANCE, action: ActionType.ADMIN },
      { resource: ResourceType.DATABASE, action: ActionType.ADMIN },
      { resource: ResourceType.QUERY, action: ActionType.ADMIN },
      { resource: ResourceType.VACUUM, action: ActionType.ADMIN },
      { resource: ResourceType.SESSION, action: ActionType.ADMIN },
      { resource: ResourceType.ALERT, action: ActionType.ADMIN },
      { resource: ResourceType.CONFIG, action: ActionType.ADMIN },
      { resource: ResourceType.BACKUP, action: ActionType.ADMIN },
      { resource: ResourceType.USER, action: ActionType.ADMIN },
      { resource: ResourceType.ROLE, action: ActionType.ADMIN },
      { resource: ResourceType.AUDIT, action: ActionType.ADMIN },
      { resource: ResourceType.CREDENTIAL, action: ActionType.ADMIN },
    ],
  },
  {
    name: 'Cluster Admin',
    description: '할당된 클러스터에 대한 전체 권한을 가진 관리자',
    scopeType: ScopeType.CLUSTER,
    isSystem: true,
    permissions: [
      { resource: ResourceType.INSTANCE, action: ActionType.ADMIN },
      { resource: ResourceType.DATABASE, action: ActionType.ADMIN },
      { resource: ResourceType.QUERY, action: ActionType.EXECUTE },
      { resource: ResourceType.VACUUM, action: ActionType.EXECUTE },
      { resource: ResourceType.SESSION, action: ActionType.EXECUTE },
      { resource: ResourceType.ALERT, action: ActionType.ADMIN },
      { resource: ResourceType.CONFIG, action: ActionType.VIEW },
      { resource: ResourceType.BACKUP, action: ActionType.VIEW },
      { resource: ResourceType.AUDIT, action: ActionType.VIEW },
    ],
  },
  {
    name: 'DBA',
    description: '데이터베이스 운영 및 유지보수 권한을 가진 데이터베이스 관리자',
    scopeType: ScopeType.DATABASE,
    isSystem: true,
    permissions: [
      { resource: ResourceType.DATABASE, action: ActionType.VIEW },
      { resource: ResourceType.QUERY, action: ActionType.EXECUTE },
      { resource: ResourceType.VACUUM, action: ActionType.EXECUTE },
      { resource: ResourceType.SESSION, action: ActionType.VIEW },
      { resource: ResourceType.SESSION, action: ActionType.EXECUTE }, // cancel/terminate
      { resource: ResourceType.ALERT, action: ActionType.VIEW },
      { resource: ResourceType.ALERT, action: ActionType.CREATE },
      { resource: ResourceType.BACKUP, action: ActionType.VIEW },
      { resource: ResourceType.BACKUP, action: ActionType.EXECUTE },
      { resource: ResourceType.CONFIG, action: ActionType.VIEW },
    ],
  },
  {
    name: 'SRE',
    description: '사이트 신뢰성 엔지니어 - 모니터링 및 알림 관리',
    scopeType: ScopeType.CLUSTER,
    isSystem: true,
    permissions: [
      { resource: ResourceType.CLUSTER, action: ActionType.VIEW },
      { resource: ResourceType.INSTANCE, action: ActionType.VIEW },
      { resource: ResourceType.DATABASE, action: ActionType.VIEW },
      { resource: ResourceType.SESSION, action: ActionType.VIEW },
      { resource: ResourceType.SESSION, action: ActionType.EXECUTE },
      { resource: ResourceType.ALERT, action: ActionType.ADMIN },
      { resource: ResourceType.BACKUP, action: ActionType.VIEW },
      { resource: ResourceType.CONFIG, action: ActionType.VIEW },
      { resource: ResourceType.AUDIT, action: ActionType.VIEW },
    ],
  },
  {
    name: 'Developer',
    description: '읽기 전용 접근과 제한된 쿼리 실행 권한을 가진 개발자',
    scopeType: ScopeType.DATABASE,
    isSystem: true,
    permissions: [
      { resource: ResourceType.DATABASE, action: ActionType.VIEW },
      { resource: ResourceType.QUERY, action: ActionType.VIEW },
      {
        resource: ResourceType.QUERY,
        action: ActionType.EXECUTE,
        conditions: { readOnly: true, maxRows: 10000 },
      },
      { resource: ResourceType.SESSION, action: ActionType.VIEW },
    ],
  },
  {
    name: 'Viewer',
    description: '읽기 전용 모니터링 접근 권한',
    scopeType: ScopeType.CLUSTER,
    isSystem: true,
    permissions: [
      { resource: ResourceType.CLUSTER, action: ActionType.VIEW },
      { resource: ResourceType.INSTANCE, action: ActionType.VIEW },
      { resource: ResourceType.DATABASE, action: ActionType.VIEW },
      { resource: ResourceType.SESSION, action: ActionType.VIEW },
      { resource: ResourceType.ALERT, action: ActionType.VIEW },
    ],
  },
  {
    name: 'Auditor',
    description: '감사 로그 및 규정 준수 리포트 조회 권한',
    scopeType: ScopeType.GLOBAL,
    isSystem: true,
    permissions: [
      { resource: ResourceType.CLUSTER, action: ActionType.VIEW },
      { resource: ResourceType.INSTANCE, action: ActionType.VIEW },
      { resource: ResourceType.DATABASE, action: ActionType.VIEW },
      { resource: ResourceType.AUDIT, action: ActionType.VIEW },
      { resource: ResourceType.USER, action: ActionType.VIEW },
      { resource: ResourceType.ROLE, action: ActionType.VIEW },
    ],
  },
];

export const DEFAULT_ADMIN_EMAIL = 'admin@localhost';
export const DEFAULT_ADMIN_PASSWORD = 'admin123!@#';
