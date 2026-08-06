import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(): Promise<void> {
    throw new ThrottlerException(
      'Too many attempts. Please wait a minute before trying again.',
    );
  }
}
