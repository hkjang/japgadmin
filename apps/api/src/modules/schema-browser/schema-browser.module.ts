import { Module } from '@nestjs/common';
import { SchemaBrowserController } from './schema-browser.controller';
import { SchemaBrowserService } from './schema-browser.service';
import { CoreModule } from '../core/core.module';

@Module({
  imports: [CoreModule],
  controllers: [SchemaBrowserController],
  providers: [SchemaBrowserService],
  exports: [SchemaBrowserService],
})
export class SchemaBrowserModule {}
