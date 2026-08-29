import { Role } from 'src/auth/enum/roles.enum';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateUserByAdminDto {
  @IsEnum(Role)
  @IsNotEmpty()
  role: Role;
}
