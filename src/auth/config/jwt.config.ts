import { registerAs } from '@nestjs/config';
import { JwtModuleOptions, JwtSignOptions } from '@nestjs/jwt';

export default registerAs('jwt', (): JwtModuleOptions => {
  const expiresIn = process.env
    .JWT_ACCESS_EXPIRES_IN as JwtSignOptions['expiresIn'];

  return {
    secret: process.env.JWT_ACCESS_SECRET,
    signOptions: {
      expiresIn,
    },
  };
});
