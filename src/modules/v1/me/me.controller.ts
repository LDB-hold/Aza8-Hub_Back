import { Controller, Get } from '@nestjs/common';

import { CurrentAuth } from '../../../common/decorators/current-auth.decorator';
import { ToolAction } from '../../../common/decorators/tool-action.decorator';
import { AppError } from '../../../common/errors/app-error';
import type { RequestAuthContext } from '../../infra/auth/request-context';
import { MeService, type MeResponse } from './me.service';

@Controller('/v1/me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  @ToolAction('me.read')
  async me(@CurrentAuth() auth: RequestAuthContext): Promise<{ data: MeResponse }> {
    if (auth.actor.kind !== 'user') {
      throw new AppError({
        code: 'FORBIDDEN_ACTION',
        httpStatus: 403,
        message: 'Forbidden',
      });
    }

    const data = await this.meService.getMe({
      tenantId: auth.tenantId,
      userId: auth.actor.userId,
      role: auth.actor.role,
    });

    return { data };
  }
}

