import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/preact';
import { AuthProvider } from './auth-provider';
import { useAuth } from './auth-context';

vi.mock('../demo/is-demo-mode', () => ({ isDemoMode: () => false }));
vi.mock('../state/board-store', () => ({ showToast: vi.fn() }));

/**
 * #285: GIS is stubbed so the test drives the token callback itself. The
 * userinfo fetch is held open so the window between "token arrived" and
 * "user arrived" is observable.
 */
let gisCallback: ((response: any) => Promise<void>) | null = null;
let resolveUserinfo: ((info: any) => void) | null = null;

beforeEach(() => {
  localStorage.clear();
  gisCallback = null;
  (globalThis as any).google = {
    accounts: {
      oauth2: {
        initTokenClient: (config: any) => {
          gisCallback = config.callback;
          return { requestAccessToken: vi.fn() };
        },
      },
    },
  };
  vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => {
    resolveUserinfo = (info) => resolve({ json: () => Promise.resolve(info) });
  })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (globalThis as any).google;
  localStorage.clear();
});

type Snapshot = { token: string | null; email: string | null; isAuthenticated: boolean };

function renderRecorder() {
  const snapshots: Snapshot[] = [];
  function Recorder() {
    const { token, user, isAuthenticated } = useAuth();
    snapshots.push({ token, email: user?.email ?? null, isAuthenticated });
    return null;
  }
  render(<AuthProvider><Recorder /></AuthProvider>);
  return snapshots;
}

describe('AuthProvider sign-in ordering (Issue #285)', () => {
  // AC1/AC4: the app mounts on `isAuthenticated` and loads the board with the
  // user it has at that moment. It must never see a token without a user.
  it('never reports authenticated before the user is known on an interactive sign-in', async () => {
    const snapshots = renderRecorder();
    expect(gisCallback).not.toBeNull();

    let pending!: Promise<void>;
    await act(async () => {
      pending = gisCallback!({ access_token: 'new-token', expires_in: 3600 });
    });

    // Token has arrived, userinfo has not
    expect(snapshots.filter(s => s.isAuthenticated && !s.email)).toEqual([]);

    await act(async () => {
      resolveUserinfo!({ email: 'luke@example.com', name: 'Luke', picture: '' });
      await pending;
    });

    const last = snapshots[snapshots.length - 1];
    expect(last).toEqual({ token: 'new-token', email: 'luke@example.com', isAuthenticated: true });
    expect(snapshots.filter(s => s.isAuthenticated && !s.email)).toEqual([]);
  });

  // A failed userinfo call must not strand the user on the login screen
  it('still signs in when the userinfo request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network'))));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const snapshots = renderRecorder();

    await act(async () => {
      await gisCallback!({ access_token: 'new-token', expires_in: 3600 });
    });

    expect(snapshots[snapshots.length - 1].token).toBe('new-token');
    errSpy.mockRestore();
  });

  // AC2: a cached session already has both on the first render
  it('starts authenticated with the cached user on reload', () => {
    localStorage.setItem('hive_token', 'cached-token');
    localStorage.setItem('hive_user', JSON.stringify({ email: 'luke@example.com', name: 'Luke', picture: '' }));
    localStorage.setItem('hive_token_expiry', String(Date.now() + 3_600_000));

    const snapshots = renderRecorder();

    expect(snapshots[0]).toEqual({ token: 'cached-token', email: 'luke@example.com', isAuthenticated: true });
  });
});
