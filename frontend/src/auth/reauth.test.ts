import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerReauthCallback,
  onReauthFailed,
  attemptReauth,
  ReauthFailedError,
  _resetForTesting,
} from './reauth';

describe('reauth module', () => {
  beforeEach(() => {
    _resetForTesting();
  });

  it('throws when no callback is registered', async () => {
    await expect(attemptReauth()).rejects.toThrow('No reauth callback registered');
  });

  it('calls the registered callback and returns the new token', async () => {
    const cb = vi.fn().mockResolvedValue('new-token-123');
    registerReauthCallback(cb);

    const token = await attemptReauth();

    expect(cb).toHaveBeenCalledTimes(1);
    expect(token).toBe('new-token-123');
  });

  it('calls onReauthFailed callback and throws ReauthFailedError when reauth fails', async () => {
    const failedCb = vi.fn();
    const cb = vi.fn().mockRejectedValue(new Error('GIS failed'));
    registerReauthCallback(cb);
    onReauthFailed(failedCb);

    await expect(attemptReauth()).rejects.toThrow(ReauthFailedError);
    expect(failedCb).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent reauth attempts', async () => {
    let resolveReauth: (token: string) => void;
    const cb = vi.fn().mockImplementation(() =>
      new Promise<string>(resolve => { resolveReauth = resolve; })
    );
    registerReauthCallback(cb);

    // Fire two concurrent attempts
    const p1 = attemptReauth();
    const p2 = attemptReauth();

    // Only one callback invocation
    expect(cb).toHaveBeenCalledTimes(1);

    // Resolve the single callback
    resolveReauth!('deduped-token');

    const [t1, t2] = await Promise.all([p1, p2]);
    expect(t1).toBe('deduped-token');
    expect(t2).toBe('deduped-token');
  });

  it('allows new reauth after previous one completes', async () => {
    const cb = vi.fn()
      .mockResolvedValueOnce('token-1')
      .mockResolvedValueOnce('token-2');
    registerReauthCallback(cb);

    const t1 = await attemptReauth();
    const t2 = await attemptReauth();

    expect(t1).toBe('token-1');
    expect(t2).toBe('token-2');
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('cleanup function unregisters the reauth callback', async () => {
    const cb = vi.fn().mockResolvedValue('token');
    const cleanup = registerReauthCallback(cb);

    cleanup();

    await expect(attemptReauth()).rejects.toThrow('No reauth callback registered');
  });

  it('cleanup function unregisters the onReauthFailed callback', async () => {
    const failedCb = vi.fn();
    const cb = vi.fn().mockRejectedValue(new Error('fail'));
    registerReauthCallback(cb);
    const cleanup = onReauthFailed(failedCb);

    cleanup();

    // Reauth fails but failedCb should NOT be called
    await expect(attemptReauth()).rejects.toThrow(ReauthFailedError);
    expect(failedCb).not.toHaveBeenCalled();
  });

  it('ReauthFailedError preserves the original cause', async () => {
    const originalError = new Error('popup blocked');
    const cb = vi.fn().mockRejectedValue(originalError);
    registerReauthCallback(cb);

    try {
      await attemptReauth();
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ReauthFailedError);
      expect((err as ReauthFailedError).cause).toBe(originalError);
    }
  });
});
