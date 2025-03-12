import * as jwt from 'jsonwebtoken';

type JwtModuleShape = {
  sign?: typeof jwt.sign;
  verify?: typeof jwt.verify;
  default?: {
    sign?: typeof jwt.sign;
    verify?: typeof jwt.verify;
  };
};

export const resolveJwtSign = (jwtModule: JwtModuleShape): typeof jwt.sign => {
  if (typeof jwtModule.sign === 'function') {
    return jwtModule.sign;
  }

  if (typeof jwtModule.default?.sign === 'function') {
    return jwtModule.default.sign;
  }

  throw new TypeError('jsonwebtoken.sign is not available');
};

export const resolveJwtVerify = (jwtModule: JwtModuleShape): typeof jwt.verify => {
  if (typeof jwtModule.verify === 'function') {
    return jwtModule.verify;
  }

  if (typeof jwtModule.default?.verify === 'function') {
    return jwtModule.default.verify;
  }

  throw new TypeError('jsonwebtoken.verify is not available');
};
