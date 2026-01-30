import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { CoreModule } from './modules/core/core.module';
import { AuthModule } from './modules/auth/auth.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { SecurityModule } from './modules/security/security.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { VacuumModule } from './modules/vacuum/vacuum.module';
import { QueryModule } from './modules/query/query.module';
import { AlertModule } from './modules/alert/alert.module';
import { SessionModule } from './modules/session/session.module';
import { LockModule } from './modules/lock/lock.module';
import { SchemaBrowserModule } from './modules/schema-browser/schema-browser.module';
import { TaskModule } from './modules/task/task.module';
import { BackupModule } from './modules/backup/backup.module';
import { ReplicationModule } from './modules/replication/replication.module';
import { FailoverModule } from './modules/failover/failover.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    // 환경 변수 설정
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // 스케줄러 (알림, 메트릭 수집용)
    ScheduleModule.forRoot(),

    // Database (Prisma)
    DatabaseModule,

    // Core infrastructure
    CoreModule,

    // Auth, RBAC & Security
    AuthModule,
    RbacModule,
    SecurityModule,

    // Audit (Global)
    AuditModule,

    // Feature modules
    InventoryModule,
    MonitoringModule,
    VacuumModule,
    QueryModule,
    AlertModule,

    // Operations modules
    SessionModule,
    LockModule,
    SchemaBrowserModule,
    TaskModule,

    // HA/DR modules
    BackupModule,
    ReplicationModule,
    FailoverModule,
  ],
})
export class AppModule {}
