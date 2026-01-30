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
  UseGuards,
} from '@nestjs/common';
import { TaskService, CreateTaskDto, CreateScheduleDto, UpdateScheduleDto } from './task.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ResourceType, ActionType, TaskType, TaskStatus } from '@prisma/client';

@Controller('tasks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  // ============ Task Management ============

  @Post()
  @RequirePermission({ resource: ResourceType.VACUUM, action: ActionType.EXECUTE })
  async createTask(
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: any,
  ) {
    return this.taskService.createTask(dto, user?.id);
  }

  @Get()
  @RequirePermission({ resource: ResourceType.VACUUM, action: ActionType.VIEW })
  async getTasks(
    @Query('instanceId') instanceId?: string,
    @Query('type') type?: TaskType,
    @Query('status') status?: TaskStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.taskService.getTasks({
      instanceId,
      type,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('stats')
  @RequirePermission({ resource: ResourceType.VACUUM, action: ActionType.VIEW })
  async getQueueStats() {
    return this.taskService.getQueueStats();
  }

  @Get('active')
  @RequirePermission({ resource: ResourceType.VACUUM, action: ActionType.VIEW })
  async getActiveJobs() {
    return this.taskService.getActiveJobs();
  }

  @Get('failed')
  @RequirePermission({ resource: ResourceType.VACUUM, action: ActionType.VIEW })
  async getFailedJobs(@Query('limit') limit?: string) {
    return this.taskService.getFailedJobs(limit ? parseInt(limit, 10) : undefined);
  }

  @Get(':id')
  @RequirePermission({ resource: ResourceType.VACUUM, action: ActionType.VIEW })
  async getTask(@Param('id', ParseUUIDPipe) id: string) {
    return this.taskService.getTask(id);
  }

  @Post(':id/cancel')
  @RequirePermission({ resource: ResourceType.VACUUM, action: ActionType.EXECUTE })
  async cancelTask(@Param('id', ParseUUIDPipe) id: string) {
    return this.taskService.cancelTask(id);
  }

  @Post(':id/retry')
  @RequirePermission({ resource: ResourceType.VACUUM, action: ActionType.EXECUTE })
  async retryTask(@Param('id', ParseUUIDPipe) id: string) {
    return this.taskService.retryTask(id);
  }

  // ============ Maintenance Schedules ============

  @Post('schedules')
  @RequirePermission({ resource: ResourceType.VACUUM, action: ActionType.CREATE })
  async createSchedule(@Body() dto: CreateScheduleDto) {
    return this.taskService.createSchedule(dto);
  }

  @Get('schedules')
  @RequirePermission({ resource: ResourceType.VACUUM, action: ActionType.VIEW })
  async getSchedules(@Query('instanceId') instanceId?: string) {
    return this.taskService.getSchedules(instanceId);
  }

  @Get('schedules/:id')
  @RequirePermission({ resource: ResourceType.VACUUM, action: ActionType.VIEW })
  async getSchedule(@Param('id', ParseUUIDPipe) id: string) {
    return this.taskService.getSchedule(id);
  }

  @Put('schedules/:id')
  @RequirePermission({ resource: ResourceType.VACUUM, action: ActionType.UPDATE })
  async updateSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.taskService.updateSchedule(id, dto);
  }

  @Delete('schedules/:id')
  @RequirePermission({ resource: ResourceType.VACUUM, action: ActionType.DELETE })
  async deleteSchedule(@Param('id', ParseUUIDPipe) id: string) {
    return this.taskService.deleteSchedule(id);
  }

  @Post('schedules/:id/toggle')
  @RequirePermission({ resource: ResourceType.VACUUM, action: ActionType.UPDATE })
  async toggleSchedule(@Param('id', ParseUUIDPipe) id: string) {
    return this.taskService.toggleSchedule(id);
  }
}
