import { Controller, Get } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';

@Controller()
export class HealthController {
  @Public()
  @Get('/health')
  health(): { data: { status: 'ok' } } {
    return { data: { status: 'ok' } };
  }
}
