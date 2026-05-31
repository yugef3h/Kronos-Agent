import { consumeTokenBucket, createTokenBucket, remainingTokens } from '../tokenBucket.js';

describe('tokenBucket', () => {
  it('creates bucket at full capacity', () => {
    const bucket = createTokenBucket('u1', 10, 1);
    expect(remainingTokens(bucket)).toBe(10);
  });

  it('consumes tokens when available', () => {
    const bucket = createTokenBucket('u1', 2, 1);
    expect(consumeTokenBucket(bucket, 1)).toBe(true);
    expect(consumeTokenBucket(bucket, 1)).toBe(true);
    expect(consumeTokenBucket(bucket, 1)).toBe(false);
  });
});
