import { Module } from '@nestjs/common';
import { ExtensionsController } from './extensions.controller';
import { ExtensionsService } from './extensions.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ExtensionsController],
  providers: [ExtensionsService],
})
export class ExtensionsModule {}
