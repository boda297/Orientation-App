import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DeveloperDoc } from '../entities/developer.entity';

/**
 * Parameter decorator to retrieve the resolved Developer document attached to the request.
 * Populated when using DeveloperOwnershipGuard.
 * Usage: @CurrentDeveloper() developer: DeveloperDoc
 */
export const CurrentDeveloper = createParamDecorator(
  (data: keyof DeveloperDoc | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const developer = request.developer as DeveloperDoc;

    return data ? developer?.[data] : developer;
  },
);
