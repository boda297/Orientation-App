import { Types } from 'mongoose';
import { Role } from '../enum/roles.enum';

export type AuthJwtPayload = {
  sub: Types.ObjectId;
  role?: Role | string;
};