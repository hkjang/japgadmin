import { Module } from '@nestjs/common';
import { QueryConsoleController } from './query-console.controller';
import { QueryConsoleService } from './query-console.service';
import { CoreModule } from '../core/core.module';
import { DatabaseModule } from '../../database/database.module';
import { SecurityModule } from '../security/security.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [CoreModule, DatabaseModule, SecurityModule, AuditModule],
  controllers: [QueryConsoleController],
  providers: [QueryConsoleService],
  exports: [QueryConsoleService],
})
export class QueryConsoleModule {}
