import { Module, Global } from '@nestjs/common';
import { EncryptionService } from './services/encryption.service';
import { SqlSafetyService } from './services/sql-safety.service';
import { CredentialService } from './services/credential.service';
import { CredentialController } from './controllers/credential.controller';
import { SqlSafetyController } from './controllers/sql-safety.controller';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [CredentialController, SqlSafetyController],
  providers: [EncryptionService, SqlSafetyService, CredentialService],
  exports: [EncryptionService, SqlSafetyService, CredentialService],
})
export class SecurityModule {}
