/** Verify account permissions, validation, fresh state and real local persistence. */
import { describe, expect, it, vi } from 'vitest';
import {
  accountDeletionReason, createAccount, deleteAccount, getAccountStats, listAccounts, validateAccountFields,
} from './accounts';
import { BUILT_IN_ADMIN, getSession, login, SESSION_KEY } from './auth';
import { getPosts, getUsers, savePosts, saveUsers, USERS_KEY } from './storage';

const writer = {
  id: 'writer', displayName: 'Writer', username: 'writer', password: 'demo', role: 'user',
  createdAt: '2026-03-01T00:00:00.000Z',
};
const editor = { ...writer, id: 'editor', username: 'editor', displayName: 'Editor', role: 'admin' };
const fields = { displayName: 'New Writer', username: 'new', password: 'demo', role: 'user' };
const post = { id: 'post', title: 'Saved', content: 'Text', authorId: 'writer', authorName: 'Writer', createdAt: writer.createdAt };

/** Seed canonical stored accounts and sign in the built-in operator. */
function setup() {
  saveUsers([writer, editor]);
  login('admin', 'admin');
}

/** Verify exact collection persistence after a rejected operation. */
function unchanged(action, message) {
  const before = localStorage.getItem(USERS_KEY);
  expect(action).toThrow(message);
  expect(localStorage.getItem(USERS_KEY)).toBe(before);
}

describe('account listing and counts', () => {
  it('includes only the fixed identity for empty storage without persisting a duplicate or date', () => {
    expect(listAccounts()).toEqual([BUILT_IN_ADMIN]);
    expect(listAccounts()[0].createdAt).toBeUndefined();
    expect(Object.isFrozen(listAccounts()[0])).toBe(true);
    expect(getAccountStats()).toEqual({ 'Total Posts': 0, 'Total Users': 1, 'Total Admins': 1, 'Total users': 0 });
    expect(localStorage.getItem(USERS_KEY)).toBeNull();
  });
  it('counts both roles plus built-in and the entire post array, requerying changed storage', () => {
    setup();
    savePosts([post, null]);
    expect(getAccountStats()).toEqual({ 'Total Posts': 2, 'Total Users': 3, 'Total Admins': 2, 'Total users': 1 });
    deleteAccount('writer');
    expect(getAccountStats()).toEqual({ 'Total Posts': 2, 'Total Users': 2, 'Total Admins': 2, 'Total users': 0 });
    expect(getPosts()).toEqual([post, null]);
  });
  it.each(['{bad', '{}', 'null'])('survives damaged collections %s', (raw) => {
    localStorage.setItem(USERS_KEY, raw);
    localStorage.setItem('writespace_posts', raw);
    expect(listAccounts()).toEqual([BUILT_IN_ADMIN]);
    expect(getAccountStats()['Total Posts']).toBe(0);
    expect(localStorage.getItem(USERS_KEY)).toBe(raw);
  });
  it('filters every malformed identity branch and collisions without changing records', () => {
    const malformed = [null, [], 5, {}, ...['id', 'username', 'displayName', 'password', 'createdAt'].flatMap((key) => [
      { ...writer, [key]: undefined }, { ...writer, [key]: 42 }, { ...writer, [key]: '' },
    ]), { ...writer, id: ' ' }, { ...writer, username: ' ' }, { ...writer, displayName: ' ' },
    { ...writer, createdAt: 'bad' }, { ...writer, role: 'owner' }, { ...writer, role: undefined },
    { ...writer, id: 'admin' }, { ...writer, username: 'admin' }];
    saveUsers([...malformed, writer, editor]);
    expect(listAccounts()).toEqual([BUILT_IN_ADMIN, writer, editor]);
    expect(getUsers()).toEqual(JSON.parse(JSON.stringify([...malformed, writer, editor])));
  });
  it('falls back safely when reads are denied', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Denied'); });
    expect(listAccounts()).toEqual([BUILT_IN_ADMIN]);
    expect(getAccountStats()).toEqual({ 'Total Posts': 0, 'Total Users': 1, 'Total Admins': 1, 'Total users': 0 });
  });
});

describe('required account fields', () => {
  it.each(['admin', 'user'])('accepts exact role %s', (role) => {
    expect(validateAccountFields({ ...fields, role })).toEqual({});
  });
  it.each(['displayName', 'username', 'password', 'role'])('rejects omitted, blank and non-string %s without writes', (key) => {
    setup();
    for (const value of [undefined, null, '', '   ', 0, false, {}, []]) {
      const invalid = { ...fields, [key]: value };
      expect(validateAccountFields(invalid)[key]).toMatch(/required/);
      unchanged(() => createAccount(invalid), /required/);
    }
  });
  it.each([undefined, null, {}, false, [], 'text'])('rejects absent or wrong-shaped input %s', (value) => {
    setup();
    expect(Object.keys(validateAccountFields(value))).toHaveLength(4);
    unchanged(() => createAccount(value), /required/);
  });
  it.each(['Admin', 'USER', 'owner', ' admin ', ' user '])('rejects invalid role %s', (role) => {
    setup();
    expect(validateAccountFields({ ...fields, role })).toEqual({ role: 'Choose Admin or user.' });
    unchanged(() => createAccount({ ...fields, role }), 'Choose Admin or user.');
  });
});

describe('account creation', () => {
  it.each(['user', 'admin'])('persists exact metadata and role %s without changing the Admin session', (role) => {
    setup();
    const session = getSession();
    const account = createAccount({ ...fields, displayName: '  New Name  ', username: '  new  ', password: ' demo ', role,
      id: 'injected', createdAt: 'injected', extra: true });
    expect(account.id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);
    expect(new Date(account.createdAt).toISOString()).toBe(account.createdAt);
    expect(Object.keys(account).sort()).toEqual(['createdAt', 'displayName', 'id', 'password', 'role', 'username']);
    expect(account).toMatchObject({ displayName: 'New Name', username: 'new', password: ' demo ', role });
    expect(getUsers()).toEqual([writer, editor, account]);
    expect(getSession()).toEqual(session);
  });
  it.each(['admin', ' admin ', 'writer', ' writer '])('rejects duplicate/reserved username %s', (username) => {
    setup();
    unchanged(() => createAccount({ ...fields, username }), 'Username is already taken.');
  });
  it('reserves admin even when account storage is empty and handles duplicates in damaged records', () => {
    login('admin', 'admin');
    unchanged(() => createAccount({ ...fields, username: 'admin' }), /already taken/);
    saveUsers([null, { username: 'new' }]);
    unchanged(() => createAccount(fields), /already taken/);
  });
  it('keeps username matching case-sensitive and imposes no invented text limits', () => {
    setup();
    const account = createAccount({ ...fields, username: 'Admin', displayName: '<script>text</script>'.repeat(500), password: 'x' });
    expect(getUsers().at(-1)).toEqual(account);
    expect(account.username).toBe('Admin');
  });
  it('requeries new duplicates before a second creation', () => {
    setup();
    const saved = createAccount(fields);
    unchanged(() => createAccount(fields), /already taken/);
    expect(getUsers()).toEqual([writer, editor, saved]);
  });
  it('allows a stored Admin and rejects a UUID failure without writing', () => {
    setup();
    login('editor', 'demo');
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('UUID unavailable'); });
    unchanged(() => createAccount(fields), 'UUID unavailable');
  });
  it('reports persistence denial, preserves collections/session and succeeds on retry', () => {
    setup();
    const session = getSession();
    const denial = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Denied'); });
    unchanged(() => createAccount(fields), /Unable to save data/);
    expect(getSession()).toEqual(session);
    denial.mockRestore();
    expect(getUsers()).toEqual([writer, editor]);
    const saved = createAccount(fields);
    expect(getUsers()).toEqual([writer, editor, saved]);
  });
});

describe('canonical mutation authorization', () => {
  it.each(['missing', 'corrupt', 'wrong role', 'deleted', 'role drift', 'forged', 'unavailable'])(
    'rejects %s identity on create and delete without trusting supplied sessions', (state) => {
      setup();
      if (state === 'missing') localStorage.removeItem(SESSION_KEY);
      if (state === 'corrupt') localStorage.setItem(SESSION_KEY, '{bad');
      if (['wrong role', 'deleted', 'role drift'].includes(state)) login('writer', 'demo');
      if (state === 'deleted') saveUsers([editor]);
      if (state === 'role drift') saveUsers([{ ...writer, role: 'admin' }, editor]);
      if (state === 'forged') localStorage.setItem(SESSION_KEY, JSON.stringify({
        userId: 'writer', username: 'writer', displayName: 'Writer', role: 'admin',
      }));
      const before = localStorage.getItem(USERS_KEY);
      if (state === 'unavailable') {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Denied'); });
      }
      expect(() => createAccount(fields, BUILT_IN_ADMIN)).toThrow(/Admin access/);
      expect(() => deleteAccount('editor', BUILT_IN_ADMIN)).toThrow(/Admin access/);
      vi.restoreAllMocks();
      expect(localStorage.getItem(USERS_KEY)).toBe(before);
    },
  );
});

describe('protected and confirmed-boundary account deletion', () => {
  it('explains default/self protection and handles absent arguments safely', () => {
    expect(accountDeletionReason(BUILT_IN_ADMIN, { userId: 'admin' })).toBe('Default admin cannot be deleted.');
    expect(accountDeletionReason(editor, { userId: 'editor' })).toBe('You cannot delete your own account.');
    expect(accountDeletionReason(writer, { userId: 'editor' })).toBe('');
    expect(accountDeletionReason(null, null)).toBe('');
    expect(accountDeletionReason({}, {})).toBe('');
  });
  it('cannot delete builtin or active stored Admin and uses freshly changed session for self protection', () => {
    setup();
    unchanged(() => deleteAccount('admin'), 'Default admin cannot be deleted.');
    login('editor', 'demo');
    unchanged(() => deleteAccount('editor'), 'You cannot delete your own account.');
    expect(getSession().userId).toBe('editor');
  });
  it.each([undefined, null, '', ' ', 4, {}, [], 'missing'])('rejects missing/invalid id %s without changes', (id) => {
    setup();
    unchanged(() => deleteAccount(id), 'Account not found.');
  });
  it('rejects malformed matching records and repeated deletions', () => {
    setup();
    saveUsers([writer, { id: 'broken', username: 'broken' }]);
    unchanged(() => deleteAccount('broken'), /not found/);
    deleteAccount('writer');
    unchanged(() => deleteAccount('writer'), /not found/);
  });
  it.each(['writer', 'editor'])('deletes stored %s while preserving exact posts and remaining identities', (id) => {
    setup();
    savePosts([post, { ...post, id: 'second', authorId: 'editor', authorName: 'Editor' }]);
    const posts = getPosts();
    const removed = deleteAccount(id);
    expect(removed).toEqual(id === 'writer' ? writer : editor);
    expect(getUsers()).toEqual(id === 'writer' ? [editor] : [writer]);
    expect(getPosts()).toEqual(posts);
    expect(getSession().userId).toBe('admin');
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      userId: removed.id, username: removed.username, displayName: removed.displayName, role: removed.role,
    }));
    expect(getSession()).toBeNull();
  });
  it('uses the fresh collection without overwriting accounts added after listing', () => {
    setup();
    listAccounts();
    const added = createAccount(fields);
    deleteAccount('writer');
    expect(getUsers()).toEqual([editor, added]);
  });
  it('reports failed delete with all records preserved and retries successfully', () => {
    setup();
    savePosts([post]);
    const denial = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Denied'); });
    unchanged(() => deleteAccount('writer'), /Unable to save data/);
    expect(getPosts()).toEqual([post]);
    denial.mockRestore();
    deleteAccount('writer');
    expect(getUsers()).toEqual([editor]);
    expect(getPosts()).toEqual([post]);
  });
});
