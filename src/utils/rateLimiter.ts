/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class RateLimiter {
  private maxTokens: number;
  private refillRate: number;
  private tokens: number;
  private lastRefill: number;
  private totalWaits = 0;
  private totalWaitSeconds = 0;

  constructor(maxTokens = 16, refillRatePerMin = 16) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRatePerMin / 60;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return Promise.resolve();
    }

    const waitTime = ((1 - this.tokens) / this.refillRate) * 1000;
    this.totalWaits += 1;
    this.totalWaitSeconds += waitTime / 1000;
    this.tokens = 0;

    return new Promise((resolve) => {
      setTimeout(() => {
        this.refill();
        this.tokens -= 1;
        resolve();
      }, waitTime);
    });
  }

  getStats() {
    return {
      totalWaits: this.totalWaits,
      totalWaitSeconds: Math.round(this.totalWaitSeconds * 10) / 10,
      currentTokens: Math.round(this.tokens * 100) / 100,
    };
  }

  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
    this.totalWaits = 0;
    this.totalWaitSeconds = 0;
  }
}

export const rateLimiter = new RateLimiter(4, 4);
