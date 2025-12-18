import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { RequireRole } from '../../../common/decorators/require-role.decorator';
import { ToolAction } from '../../../common/decorators/tool-action.decorator';
import { CreatePackageDto } from './dto/create-package.dto';
import { CreateToolActionDto } from './dto/create-tool-action.dto';
import { CreateToolDto } from './dto/create-tool.dto';
import { SetPackageActionsDto } from './dto/set-package-actions.dto';
import {
  CatalogService,
  type ListPackagesResponse,
  type ListToolsResponse,
} from './catalog.service';

@Controller('/v1/catalog')
@RequireRole('ADM_AZA8')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post('/tools')
  @ToolAction('catalog.tools.create')
  async createTool(@Body() dto: CreateToolDto): Promise<{ data: { id: string } }> {
    const tool = await this.catalogService.createTool(dto);
    return { data: { id: tool.id } };
  }

  @Get('/tools')
  @ToolAction('catalog.tools.read')
  async listTools(
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string
  ): Promise<{ data: ListToolsResponse['items']; meta: ListToolsResponse['meta'] }> {
    const { items, meta } = await this.catalogService.listTools({ limit, cursor });
    return { data: items, meta };
  }

  @Post('/tools/:toolKey/actions')
  @ToolAction('catalog.tools.actions.create')
  async createToolAction(
    @Param('toolKey') toolKey: string,
    @Body() dto: CreateToolActionDto
  ): Promise<{ data: { id: string } }> {
    const action = await this.catalogService.createToolAction(toolKey, dto);
    return { data: { id: action.id } };
  }

  @Post('/packages')
  @ToolAction('catalog.packages.create')
  async createPackage(@Body() dto: CreatePackageDto): Promise<{ data: { id: string } }> {
    const pkg = await this.catalogService.createPackage(dto);
    return { data: { id: pkg.id } };
  }

  @Get('/packages')
  @ToolAction('catalog.packages.read')
  async listPackages(
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string
  ): Promise<{ data: ListPackagesResponse['items']; meta: ListPackagesResponse['meta'] }> {
    const { items, meta } = await this.catalogService.listPackages({ limit, cursor });
    return { data: items, meta };
  }

  @Post('/packages/:packageKey/actions')
  @ToolAction('catalog.packages.actions.set')
  async setPackageActions(
    @Param('packageKey') packageKey: string,
    @Body() dto: SetPackageActionsDto
  ): Promise<{ data: { status: 'ok' } }> {
    await this.catalogService.setPackageActions(packageKey, dto.toolActionKeys);
    return { data: { status: 'ok' } };
  }
}
