import { Module, Global } from '@nestjs/common';
import { ConnectionManagerService } from './services/connection-manager.service';
import { DatabaseModule } from '../../database/database.module';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [ConnectionManagerService],
  exports: [ConnectionManagerService],
})
export class CoreModule {}
