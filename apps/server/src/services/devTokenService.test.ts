import * as jwt from 'jsonwebtoken';
import { createDevToken, isDevTokenRouteEnabled } from './devTokenService';

const getJwtVerify = (): typeof jwt.verify => {
  const verify = (jwt as unknown as { verify?: typeof jwt.verify }).verify;
  if (typeof verify === 'function') {
    return verify;
  }

  const defaultVerify = (jwt as unknown as { default?: { verify?: typeof jwt.verify } }).default?.verify;
  if (typeof defaultVerify === 'function') {
    return defaultVerify;
  }

  throw new TypeError('jsonwebtoken.verify is not available');
};

describe('devTokenService', () => {
  it('should create a verifiable HS256 bearer token', () => {
    const jwtSecret = 'unit-test-secret-1234567890';
    const result = createDevToken(jwtSecret);

    expect(result.tokenType).toBe('Bearer');
    expect(result.expiresIn).toBe('7d');

    const verify = getJwtVerify();
    const payload = verify(result.token, jwtSecret) as jwt.JwtPayload;

    expect(payload.sub).toBe('dev-user');
    expect(payload.role).toBe('tester');
    expect(payload.exp).toBeDefined();
  });

  it('should disable the dev token route in production', () => {
    expect(isDevTokenRouteEnabled('production')).toBe(false);
    expect(isDevTokenRouteEnabled('development')).toBe(true);
    expect(isDevTokenRouteEnabled(undefined)).toBe(true);
  });
});
