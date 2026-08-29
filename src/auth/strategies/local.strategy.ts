import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import { LoginDto } from '../dto/login.dto';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email',
    });
  }

  validate(loginDto: LoginDto) {
    if (loginDto.password == '') {
      throw new UnauthorizedException('Please Provide The Password');
    }
    return this.authService.validateUser(loginDto.email, loginDto.password);
  }
}
