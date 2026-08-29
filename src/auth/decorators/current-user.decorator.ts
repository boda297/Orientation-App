import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthJwtPayload } from '../types/auth-jwtPayload';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthJwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthJwtPayload;

    return data ? user?.[data] : user;
  },
);
