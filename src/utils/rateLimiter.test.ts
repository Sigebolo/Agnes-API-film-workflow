import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from './rateLimiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('burst: 连续 acquire 无等待', () => {
    const limiter = new RateLimiter(16, 16);
    const start = Date.now();

    for (let i = 0; i < 16; i++) {
      limiter.acquire();
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it('第 17 次 acquire 需要等待', async () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(16, 16);

    for (let i = 0; i < 16; i++) {
      limiter.acquire();
    }

    let resolved = false;
    const promise = limiter.acquire().then(() => { resolved = true; });

    expect(resolved).toBe(false);

    vi.advanceTimersByTime(4000);
    await promise;
    expect(resolved).toBe(true);
  });

  it('getStats 返回正确的 totalWaits', async () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(2, 120);

    limiter.acquire();
    limiter.acquire();
    expect(limiter.getStats().totalWaits).toBe(0);

    const p = limiter.acquire();
    vi.advanceTimersByTime(1000);
    await p;
    expect(limiter.getStats().totalWaits).toBe(1);
  });

  it('reset 恢复令牌', () => {
    const limiter = new RateLimiter(4, 120);
    limiter.acquire();
    limiter.acquire();
    limiter.acquire();
    limiter.acquire();
    expect(limiter.getStats().currentTokens).toBe(0);

    limiter.reset();
    expect(limiter.getStats().currentTokens).toBe(4);
    expect(limiter.getStats().totalWaits).toBe(0);
  });
});
