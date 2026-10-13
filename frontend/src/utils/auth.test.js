/** Exercise identity validation and persisted state transitions with real browser storage. */
import { describe, expect, it, vi } from 'vitest';
import { BUILT_IN_ADMIN, SESSION_KEY, register, login, getSession, setSession, clearSession } from './auth';
import { getUsers, saveUsers, savePosts, getPosts } from './storage';

const fields = { displayName: ' Jane Doe ', username: ' jane ', password: ' demo ', confirmPassword: ' demo ', role: 'admin' };
const adminSession = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };

/** Deny writes to one key while retaining normal writes to other keys. */
function denyWrite(key) {
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (name, value) {
    if (name === key) throw new Error('quota');
    return original.call(this, name, value);
  });
}

describe('register and login', () => {
  it('trims names, creates only a user, saves the exact schema and authenticates after clearing session', () => {
    const session = register(fields);
    const [account] = getUsers();
    expect(account).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/), displayName: 'Jane Doe', username: 'jane',
      password: ' demo ', role: 'user', createdAt: expect.any(String),
    });
    expect(new Date(account.createdAt).toISOString()).toBe(account.createdAt);
    expect(session).toEqual({ userId: account.id, username: 'jane', displayName: 'Jane Doe', role: 'user' });
    expect(JSON.parse(localStorage.getItem(SESSION_KEY))).toEqual(session);
    expect(getSession()).toEqual(session);
    clearSession();
    expect(getSession()).toBeNull();
    expect(login(' jane ', ' demo ')).toEqual(session);
    expect(getUsers()).toEqual([account]);
  });

  it.each(['displayName', 'username', 'password', 'confirmPassword'])('requires %s without any persistence', (key) => {
    expect(() => register({ ...fields, [key]: '' })).toThrow('All fields are required.');
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
  });

  it.each([null, undefined, {}, { ...fields, username: 42 }, { ...fields, displayName: '   ' },
    { ...fields, password: 1 }, { ...fields, confirmPassword: false }])('rejects malformed registration %j', (value) => {
    expect(() => register(value)).toThrow('All fields are required.');
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
  });

  it('rejects mismatched passwords and retains an existing identity', () => {
    const session = login('admin', 'admin');
    expect(() => register({ ...fields, confirmPassword: 'wrong' })).toThrow('Passwords must match.');
    expect(getUsers()).toEqual([]);
    expect(getSession()).toEqual(session);
  });

  it('rejects trimmed duplicates and literal admin, but allows case-distinct usernames', () => {
    const first = register(fields);
    expect(() => register({ ...fields, username: ' jane ' })).toThrow('Username is already taken.');
    expect(() => register({ ...fields, username: ' admin ' })).toThrow('Username is already taken.');
    expect(getSession()).toEqual(first);
    register({ ...fields, username: 'Jane' });
    register({ ...fields, username: 'Admin' });
    expect(getUsers().map((user) => user.username)).toEqual(['jane', 'Jane', 'Admin']);
  });

  it('reserves a duplicate username even in an unusable stored account', () => {
    saveUsers([{ username: 'jane' }]);
    expect(() => register(fields)).toThrow('Username is already taken.');
    expect(getUsers()).toEqual([{ username: 'jane' }]);
  });

  it.each(['{broken', '[]', '[{"id":"admin","username":"admin","password":"fake"}]'])
    ('always authenticates the immutable built-in admin with account storage %s', (raw) => {
      localStorage.setItem('writespace_users', raw);
      expect(login('admin', 'admin')).toEqual(adminSession);
      expect(getSession()).toEqual(adminSession);
      expect(Object.isFrozen(BUILT_IN_ADMIN)).toBe(true);
      expect(localStorage.getItem('writespace_users')).toBe(raw);
    });

  it('authenticates the built-in admin when collection reads are unavailable', () => {
    const original = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (key === 'writespace_users') throw new Error('denied');
      return original.call(this, key);
    });
    expect(login('admin', 'admin')).toEqual(adminSession);
    expect(getSession()).toEqual(adminSession);
  });

  it('authenticates a stored admin and projects only the session fields', () => {
    saveUsers([{ id: 'operator', username: 'owner', displayName: 'Owner', password: 'demo',
      role: 'admin', createdAt: '2026-03-04T12:00:00.000Z' }]);
    expect(login('owner', 'demo')).toEqual({ userId: 'operator', username: 'owner', displayName: 'Owner', role: 'admin' });
    expect(getSession().password).toBeUndefined();
  });

  it.each([['admin', 'wrong'], ['nobody', 'admin'], [null, 'admin'], ['admin', null], ['ADMIN', 'admin']])
    ('rejects invalid credentials %j without changing an active session', (username, password) => {
      login('admin', 'admin');
      expect(() => login(username, password)).toThrow('Invalid username or password.');
      expect(getSession()).toEqual(adminSession);
    });

  it('requires exact password whitespace and case-sensitive usernames', () => {
    register(fields);
    clearSession();
    expect(() => login('Jane', ' demo ')).toThrow('Invalid username or password.');
    expect(() => login('jane', 'demo')).toThrow('Invalid username or password.');
    expect(getSession()).toBeNull();
    expect(login('jane', ' demo ').role).toBe('user');
  });

  it.each([
    null, {}, { id: 'admin', username: 'admin', password: 'wrong', role: 'admin' },
    { id: 'x', username: 'x', password: 'demo', displayName: 'X', role: 'superuser', createdAt: '2026-01-01' },
    { id: 'x', username: 'x', password: 'demo', displayName: 'X', role: 'user', createdAt: 'bad' },
    { id: 'x', username: 'x', password: '', displayName: 'X', role: 'user', createdAt: '2026-01-01' },
  ])('rejects unusable account records %j', (account) => {
    saveUsers([account]);
    expect(() => login('x', 'demo')).toThrow('Invalid username or password.');
    expect(getSession()).toBeNull();
  });

  it('does not persist a session or account when account saving fails', () => {
    denyWrite('writespace_users');
    expect(() => register(fields)).toThrow('Unable to save data');
    expect(getUsers()).toEqual([]);
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('reports partial registration, retains the account, and allows later login', () => {
    denyWrite(SESSION_KEY);
    expect(() => register(fields)).toThrow('Your account was saved, but your session could not be saved.');
    expect(getUsers()).toHaveLength(1);
    expect(getSession()).toBeNull();
    vi.restoreAllMocks();
    expect(login('jane', ' demo ').userId).toBe(getUsers()[0].id);
  });

  it('reports login session failure without inventing success', () => {
    denyWrite(SESSION_KEY);
    expect(() => login('admin', 'admin')).toThrow('Unable to save your session');
    expect(getSession()).toBeNull();
  });
});

describe('session lifecycle', () => {
  it.each(['{broken', 'null', '[]', '{}', '42', '"admin"',
    '{"userId":"missing","username":"x","displayName":"X","role":"user"}'])
    ('fails closed for missing or malformed session %s', (raw) => {
      expect(getSession()).toBeNull();
      localStorage.setItem(SESSION_KEY, raw);
      expect(getSession()).toBeNull();
    });

  it('fails closed when storage reads are unavailable', () => {
    login('admin', 'admin');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    expect(getSession()).toBeNull();
  });

  it.each(['userId', 'username', 'displayName', 'role'])('rejects drift in canonical %s', (key) => {
    const session = register(fields);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, [key]: 'admin' }));
    expect(getSession()).toBeNull();
    expect(() => setSession({ ...session, [key]: 'admin' })).toThrow('This account is no longer available.');
  });

  it('invalidates deleted and role-changed stored identities', () => {
    const session = register(fields);
    const [account] = getUsers();
    saveUsers([{ ...account, role: 'admin' }]);
    expect(getSession()).toBeNull();
    saveUsers([]);
    expect(getSession()).toBeNull();
    expect(() => setSession(session)).toThrow('This account is no longer available.');
  });

  it('strips extra fields when saving canonical sessions', () => {
    expect(setSession({ ...adminSession, password: 'secret', extra: true })).toEqual(adminSession);
    expect(JSON.parse(localStorage.getItem(SESSION_KEY))).toEqual(adminSession);
  });

  it.each([null, undefined, [], {}, { ...adminSession, role: 'user' }])('rejects invalid setSession input %j', (value) => {
    expect(() => setSession(value)).toThrow('This account is no longer available.');
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('clears only session, is idempotent and preserves posts/accounts', () => {
    register(fields);
    savePosts([{ id: 'post', authorName: 'Jane Doe' }]);
    const users = getUsers();
    clearSession();
    clearSession();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(getUsers()).toEqual(users);
    expect(getPosts()).toEqual([{ id: 'post', authorName: 'Jane Doe' }]);
  });

  it('reports failed session removal and retains the active identity', () => {
    login('admin', 'admin');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
    expect(() => clearSession()).toThrow('Unable to clear your session');
    expect(getSession()).toEqual(adminSession);
  });
});
