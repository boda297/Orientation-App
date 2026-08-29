import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DeveloperOwnershipService } from '../services/developer-ownership.service';

@Injectable()
export class DeveloperOwnershipGuard implements CanActivate {
  constructor(
    private readonly developerOwnershipService: DeveloperOwnershipService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    const developer = await this.developerOwnershipService.getDeveloperByUserId(
      user.sub,
    );
    if (!developer) {
      throw new ForbiddenException(
        'User account is not linked to an active Developer profile',
      );
    }

    request.developer = developer;
    return true;
  }
}
