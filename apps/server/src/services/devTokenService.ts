import * as jwt from 'jsonwebtoken';
import { resolveJwtSign } from '../utils/jwtInterop.js';

export type DevTokenPayload = {
  token: string;
  tokenType: 'Bearer';
  expiresIn: '7d';
};

export const createDevToken = (jwtSecret: string): DevTokenPayload => {
  const sign = resolveJwtSign(jwt);
  const token = sign({ sub: 'dev-user', role: 'tester' }, jwtSecret, {
    algorithm: 'HS256',
    expiresIn: '7d',
  });

  return { token, tokenType: 'Bearer', expiresIn: '7d' };
};

export const isDevTokenRouteEnabled = (nodeEnv?: string): boolean => nodeEnv !== 'production';
