import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { VacuumModule } from './modules/vacuum/vacuum.module';
import { QueryModule } from './modules/query/query.module';
import { AlertModule } from './modules/alert/alert.module';

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
    
    // Feature modules
    MonitoringModule,
    VacuumModule,
    QueryModule,
    AlertModule,
  ],
})
export class AppModule {}
