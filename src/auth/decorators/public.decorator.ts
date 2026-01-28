import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../constants';

/**
 * Decorator to mark routes as public (skip JWT authentication)
 * Usage: @Public()
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
