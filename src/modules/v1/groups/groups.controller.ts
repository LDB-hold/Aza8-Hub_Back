import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { CurrentAuth } from '../../../common/decorators/current-auth.decorator';
import { ToolAction } from '../../../common/decorators/tool-action.decorator';
import type { RequestAuthContext } from '../../infra/auth/request-context';
import { CreateGroupDto } from './dto/create-group.dto';
import { SetGroupPermissionsDto } from './dto/set-group-permissions.dto';
import { UpdateGroupStatusDto } from './dto/update-group-status.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupsService, type ListGroupsResponse } from './groups.service';

@Controller('/v1/groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @ToolAction('rbac.groups.create')
  async createGroup(
    @CurrentAuth() auth: RequestAuthContext,
    @Body() dto: CreateGroupDto
  ): Promise<{ data: { id: string } }> {
    const group = await this.groupsService.createGroup(auth.tenantId, dto);
    return { data: { id: group.id } };
  }

  @Get()
  @ToolAction('rbac.groups.read')
  async listGroups(
    @CurrentAuth() auth: RequestAuthContext,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('status') status?: string,
    @Query('q') q?: string
  ): Promise<{ data: ListGroupsResponse['items']; meta: ListGroupsResponse['meta'] }> {
    const { items, meta } = await this.groupsService.listGroups(auth.tenantId, { limit, cursor, status, q });
    return { data: items, meta };
  }

  @Patch('/:id')
  @ToolAction('rbac.groups.update')
  async updateGroup(
    @CurrentAuth() auth: RequestAuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto
  ): Promise<{ data: { status: 'ok' } }> {
    await this.groupsService.updateGroup(auth.tenantId, id, dto);
    return { data: { status: 'ok' } };
  }

  @Patch('/:id/status')
  @ToolAction('rbac.groups.status.update')
  async updateGroupStatus(
    @CurrentAuth() auth: RequestAuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateGroupStatusDto
  ): Promise<{ data: { status: 'ok' } }> {
    await this.groupsService.updateGroupStatus(auth.tenantId, id, dto);
    return { data: { status: 'ok' } };
  }

  @Post('/:id/users/:userId')
  @ToolAction('rbac.groups.users.add')
  async addUserToGroup(
    @CurrentAuth() auth: RequestAuthContext,
    @Param('id') groupId: string,
    @Param('userId') userId: string
  ): Promise<{ data: { status: 'ok' } }> {
    await this.groupsService.addUserToGroup(auth.tenantId, groupId, userId);
    return { data: { status: 'ok' } };
  }

  @Delete('/:id/users/:userId')
  @ToolAction('rbac.groups.users.remove')
  async removeUserFromGroup(
    @CurrentAuth() auth: RequestAuthContext,
    @Param('id') groupId: string,
    @Param('userId') userId: string
  ): Promise<{ data: { status: 'ok' } }> {
    await this.groupsService.removeUserFromGroup(auth.tenantId, groupId, userId);
    return { data: { status: 'ok' } };
  }

  @Post('/:id/permissions')
  @ToolAction('rbac.groups.permissions.set')
  async setGroupPermissions(
    @CurrentAuth() auth: RequestAuthContext,
    @Param('id') groupId: string,
    @Body() dto: SetGroupPermissionsDto
  ): Promise<{ data: { status: 'ok' } }> {
    await this.groupsService.addGroupPermissions(auth.tenantId, groupId, dto.toolActionKeys);
    return { data: { status: 'ok' } };
  }

  @Delete('/:id/permissions/:permissionId')
  @ToolAction('rbac.groups.permissions.remove')
  async removeGroupPermission(
    @CurrentAuth() auth: RequestAuthContext,
    @Param('id') groupId: string,
    @Param('permissionId') permissionId: string
  ): Promise<{ data: { status: 'ok' } }> {
    await this.groupsService.removeGroupPermission(auth.tenantId, groupId, permissionId);
    return { data: { status: 'ok' } };
  }
}

