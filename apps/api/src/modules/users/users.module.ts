import { Module } from '@nestjs/common';
import { UsersController, RolesController } from './users.controller';
import { UsersService } from './users.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [UsersController, RolesController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
