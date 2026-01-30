import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { CoreModule } from '../core/core.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule, CoreModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
