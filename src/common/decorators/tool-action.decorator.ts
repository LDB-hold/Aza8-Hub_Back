import { SetMetadata } from '@nestjs/common';

export const TOOL_ACTION_KEY = 'aza8:toolAction';

export function ToolAction(toolActionKey: string): MethodDecorator & ClassDecorator {
  return SetMetadata(TOOL_ACTION_KEY, toolActionKey);
}

