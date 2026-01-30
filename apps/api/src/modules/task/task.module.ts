import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { VacuumProcessor } from './processors/vacuum.processor';
import { ReportProcessor } from './processors/report.processor';
import { CoreModule } from '../core/core.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD', undefined),
        },
        defaultJobOptions: {
          removeOnComplete: 100, // 완료된 작업 100개 유지
          removeOnFail: 50, // 실패한 작업 50개 유지
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'maintenance',
    }),
    CoreModule,
    DatabaseModule,
  ],
  controllers: [TaskController],
  providers: [TaskService, VacuumProcessor, ReportProcessor],
  exports: [TaskService, BullModule],
})
export class TaskModule {}
