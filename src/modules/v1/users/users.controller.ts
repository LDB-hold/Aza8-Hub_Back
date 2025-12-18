import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { CurrentAuth } from '../../../common/decorators/current-auth.decorator';
import { ToolAction } from '../../../common/decorators/tool-action.decorator';
import type { RequestAuthContext } from '../../infra/auth/request-context';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService, type ListUsersResponse } from './users.service';

@Controller('/v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ToolAction('rbac.users.create')
  async createUser(
    @CurrentAuth() auth: RequestAuthContext,
    @Body() dto: CreateUserDto
  ): Promise<{ data: { id: string } }> {
    const user = await this.usersService.createUser(auth.tenantId, dto);
    return { data: { id: user.id } };
  }

  @Get()
  @ToolAction('rbac.users.read')
  async listUsers(
    @CurrentAuth() auth: RequestAuthContext,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('status') status?: string,
    @Query('q') q?: string
  ): Promise<{ data: ListUsersResponse['items']; meta: ListUsersResponse['meta'] }> {
    const { items, meta } = await this.usersService.listUsers(auth.tenantId, { limit, cursor, status, q });
    return { data: items, meta };
  }

  @Patch('/:id')
  @ToolAction('rbac.users.update')
  async updateUser(
    @CurrentAuth() auth: RequestAuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto
  ): Promise<{ data: { status: 'ok' } }> {
    await this.usersService.updateUser(auth.tenantId, id, dto);
    return { data: { status: 'ok' } };
  }

  @Patch('/:id/status')
  @ToolAction('rbac.users.status.update')
  async updateUserStatus(
    @CurrentAuth() auth: RequestAuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto
  ): Promise<{ data: { status: 'ok' } }> {
    await this.usersService.updateUserStatus(auth.tenantId, id, dto);
    return { data: { status: 'ok' } };
  }
}

