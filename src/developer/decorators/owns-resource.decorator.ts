import { SetMetadata } from '@nestjs/common';

export const OWNS_RESOURCE_KEY = 'owns_resource';

export type ResourceType =
  'developer' | 'project' | 'reel' | 'inventory' | 'auto';

export interface OwnsResourceOptions {
  /**
   * Resource type to check:
   * - 'developer': Target ID represents a developerId.
   * - 'project': Target ID represents a projectId; guard checks the project's developer field.
   * - 'reel': Target ID represents a reelId; guard checks the reel's developerId field.
   * - 'inventory': Target ID represents an inventoryId; guard checks inventory's developer field.
   * - 'auto' (default): Automatically detects resource or developer ID from request.
   */
  resourceType?: ResourceType;

  /**
   * Route param or body field name containing the resource ID or developer ID.
   * Defaults to checking 'id', 'developerId', 'developer', 'projectId' in params/body/query.
   */
  paramName?: string;

  /**
   * Body field name containing developer ID or project ID.
   */
  bodyName?: string;
}

/**
 * Decorator to enforce Developer ownership on a controller route.
 * Usage:
 *   @OwnsResource()
 *   @OwnsResource('project')
 *   @OwnsResource({ resourceType: 'developer', paramName: 'id' })
 */
export const OwnsResource = (
  options: OwnsResourceOptions | ResourceType = 'auto',
) => {
  const opts: OwnsResourceOptions =
    typeof options === 'string' ? { resourceType: options } : options;
  return SetMetadata(OWNS_RESOURCE_KEY, opts);
};
