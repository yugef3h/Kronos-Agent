import * as jwt from 'jsonwebtoken';

export type DevTokenPayload = {
  token: string;
  tokenType: 'Bearer';
  expiresIn: '7d';
};

export const createDevToken = (jwtSecret: string): DevTokenPayload => {
  const token = jwt.sign({ sub: 'dev-user', role: 'tester' }, jwtSecret, {
    algorithm: 'HS256',
    expiresIn: '7d',
  });

  return { token, tokenType: 'Bearer', expiresIn: '7d' };
};

export const isDevTokenRouteEnabled = (nodeEnv?: string): boolean => nodeEnv !== 'production';
