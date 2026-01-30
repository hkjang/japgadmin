import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { CredentialService } from '../services/credential.service';
import { CreateCredentialDto, UpdateCredentialDto } from '../dto/security.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { CurrentUser, CurrentUserData } from '../../auth/decorators/current-user.decorator';
import { ResourceType, ActionType, CredentialType } from '@prisma/client';

@Controller('credentials')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CredentialController {
  constructor(private readonly credentialService: CredentialService) {}

  @Get()
  @RequirePermission({ resource: ResourceType.CREDENTIAL, action: ActionType.VIEW })
  async getCredentials(
    @Query('type') type?: CredentialType,
    @Query('search') search?: string,
  ) {
    return this.credentialService.getCredentials({ type, search });
  }

  @Get('needs-rotation')
  @RequirePermission({ resource: ResourceType.CREDENTIAL, action: ActionType.VIEW })
  async getCredentialsNeedingRotation() {
    return this.credentialService.getCredentialsNeedingRotation();
  }

  @Get(':id')
  @RequirePermission({ resource: ResourceType.CREDENTIAL, action: ActionType.VIEW })
  async getCredentialById(@Param('id', ParseUUIDPipe) id: string) {
    return this.credentialService.getCredentialById(id);
  }

  @Get(':id/access-logs')
  @RequirePermission({ resource: ResourceType.CREDENTIAL, action: ActionType.VIEW })
  async getAccessLogs(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.credentialService.getAccessLogs(id, {
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }

  @Post()
  @RequirePermission({ resource: ResourceType.CREDENTIAL, action: ActionType.CREATE })
  async createCredential(
    @Body() dto: CreateCredentialDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.credentialService.createCredential(dto as any, user.id);
  }

  @Post('generate-database')
  @RequirePermission({ resource: ResourceType.CREDENTIAL, action: ActionType.CREATE })
  async generateDatabaseCredential(
    @Body('name') name: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.credentialService.generateDatabaseCredential(name, user.id);
  }

  @Put(':id')
  @RequirePermission({ resource: ResourceType.CREDENTIAL, action: ActionType.UPDATE })
  async updateCredential(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCredentialDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.credentialService.updateCredential(id, dto as any, user.id);
  }

  @Post(':id/rotate')
  @RequirePermission({ resource: ResourceType.CREDENTIAL, action: ActionType.UPDATE })
  async rotateCredential(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('data') data: Record<string, any>,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.credentialService.rotateCredential(id, data, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ resource: ResourceType.CREDENTIAL, action: ActionType.DELETE })
  async deleteCredential(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    await this.credentialService.deleteCredential(id, user.id);
  }
}
