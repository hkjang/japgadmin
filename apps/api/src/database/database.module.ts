import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PostgresService } from './postgres.service';

@Global()
@Module({
  providers: [PrismaService, PostgresService],
  exports: [PrismaService, PostgresService],
})
export class DatabaseModule {}
