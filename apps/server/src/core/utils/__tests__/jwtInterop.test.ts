import { resolveJwtSign, resolveJwtVerify } from './jwtInterop';

describe('jwtInterop', () => {
  it('should resolve direct sign and verify functions first', () => {
    const sign = jest.fn();
    const verify = jest.fn();

    expect(resolveJwtSign({ sign, default: { sign: jest.fn() } })).toBe(sign);
    expect(resolveJwtVerify({ verify, default: { verify: jest.fn() } })).toBe(verify);
  });

  it('should fallback to default export functions when direct ones are missing', () => {
    const sign = jest.fn();
    const verify = jest.fn();

    expect(resolveJwtSign({ default: { sign } })).toBe(sign);
    expect(resolveJwtVerify({ default: { verify } })).toBe(verify);
  });

  it('should throw when sign or verify cannot be resolved', () => {
    expect(() => resolveJwtSign({})).toThrow('jsonwebtoken.sign is not available');
    expect(() => resolveJwtVerify({})).toThrow('jsonwebtoken.verify is not available');
  });
});
