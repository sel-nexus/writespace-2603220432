/** Verify actual persisted content and fail-closed permission boundaries. */
import { describe, expect, it, vi } from 'vitest';
import { login, clearSession } from './auth';
import { getPosts, savePosts, saveUsers } from './storage';
import { createPost, updatePost, deletePost, validatePostFields } from './posts';

const writer = {
  id: 'writer', username: 'writer', displayName: 'Writer', password: 'demo', role: 'user',
  createdAt: '2026-03-01T00:00:00Z',
};
const other = { ...writer, id: 'other', username: 'other', displayName: 'Other' };
const editor = { ...writer, id: 'editor', username: 'editor', displayName: 'Editor', role: 'admin' };
const original = {
  id: 'post', title: 'Original', content: 'Original text', createdAt: '2026-03-02T00:00:00Z',
  authorId: 'writer', authorName: 'Saved Writer',
};
const fields = { title: '  <img src=x>  ', content: '  <script>plain text</script>\n\n  End\n' };

/** Seed accounts and sign in using the canonical authentication implementation. */
function signIn(name = 'writer') {
  saveUsers([writer, other, editor]);
  return login(name, name === 'admin' ? 'admin' : 'demo');
}

const invalidValues = [undefined, null, '', ' \n ', 0, false, {}, []];
describe('required post fields', () => {
  it('accepts nonempty strings and ignores unrelated fields', () => {
    expect(validatePostFields({ ...fields, authorId: {} })).toEqual({});
  });
  it.each([undefined, null, {}, [], false])('rejects absent form object %s', (input) => {
    expect(validatePostFields(input)).toEqual({ title: 'Title is required.', content: 'Content is required.' });
  });
  for (const field of ['title', 'content']) {
    it.each(invalidValues)(`rejects ${field} invalid value %s on create and update`, (value) => {
      signIn();
      savePosts([original]);
      const input = { ...fields, [field]: value };
      expect(validatePostFields(input)).toEqual({ [field]: `${field === 'title' ? 'Title' : 'Content'} is required.` });
      expect(() => createPost(input)).toThrow(/required/);
      expect(() => updatePost('post', input)).toThrow(/required/);
      expect(getPosts()).toEqual([original]);
    });
  }
});

describe('persisted create/update/delete', () => {
  it.each(['writer', 'admin', 'editor'])('creates exact schema UUID/ISO and canonical authorship for %s', (name) => {
    const session = signIn(name);
    savePosts([original]);
    const now = new Date('2026-04-01T12:34:56.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const saved = createPost({ ...fields, id: 'fake', authorId: 'fake', createdAt: 'fake', extra: true });
      expect(saved).toEqual({
        id: expect.stringMatching(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i),
        ...fields, createdAt: now.toISOString(), authorId: session.userId, authorName: session.displayName,
      });
      expect(getPosts()).toEqual([original, saved]);
    } finally {
      vi.useRealTimers();
    }
  });
  it.each(['writer', 'admin', 'editor'])('updates text only and deletes persisted post for %s', (name) => {
    signIn(name);
    const untouched = { ...original, id: 'untouched' };
    savePosts([original, untouched]);
    const updated = updatePost('post', { ...fields, id: 'fake', authorName: 'fake', updatedAt: 'fake' });
    expect(updated).toEqual({ ...original, ...fields });
    expect(getPosts()).toEqual([updated, untouched]);
    expect(deletePost('post')).toEqual(updated);
    expect(getPosts()).toEqual([untouched]);
    expect(() => deletePost('post')).toThrow('Post not found');
    expect(getPosts()).toEqual([untouched]);
  });
  it('requeries current metadata rather than trusting stale caller input', () => {
    signIn('admin');
    savePosts([original]);
    const fresh = { ...original, createdAt: '2026-02-01T00:00:00Z', authorId: 'other', authorName: 'Fresh name', extra: true };
    savePosts([fresh]);
    const saved = updatePost('post', { ...original, ...fields });
    expect(saved).toEqual({
      id: fresh.id, ...fields, createdAt: fresh.createdAt, authorId: fresh.authorId, authorName: fresh.authorName,
    });
    expect(getPosts()).toEqual([saved]);
  });
  it('handles large plain-text input without adding a length policy', () => {
    signIn();
    const saved = createPost({ title: 'x'.repeat(1000), content: 'x'.repeat(100000) });
    expect(getPosts()).toEqual([saved]);
    expect(saved.content).toHaveLength(100000);
  });
});

describe('mutation boundary failures', () => {
  const mutations = [
    ['create', () => createPost(fields)],
    ['update', () => updatePost('post', fields)],
    ['delete', () => deletePost('post')],
  ];
  it.each(mutations)('rejects %s without trusting a stale passed admin session', (_, mutate) => {
    signIn('admin');
    savePosts([original]);
    clearSession();
    expect(() => mutate()).toThrow(/log in again/);
    expect(getPosts()).toEqual([original]);
  });
  it.each(mutations)('rejects %s after account deletion or role drift', (_, mutate) => {
    signIn('editor');
    savePosts([original]);
    saveUsers([{ ...editor, role: 'user' }]);
    expect(() => mutate()).toThrow(/log in again/);
    saveUsers([]);
    expect(() => mutate()).toThrow(/log in again/);
    expect(getPosts()).toEqual([original]);
  });
  it.each(['update', 'delete'])('rejects %s when fresh ownership belongs to someone else', (operation) => {
    signIn();
    const fresh = { ...original, authorId: 'other' };
    savePosts([fresh]);
    const mutate = () => operation === 'update' ? updatePost('post', fields) : deletePost('post');
    expect(mutate).toThrow(/permission/);
    expect(getPosts()).toEqual([fresh]);
  });
  it('uses the new valid session rather than accepting an old supplied identity', () => {
    const stale = signIn('admin');
    savePosts([original]);
    login('other', 'demo');
    expect(() => updatePost('post', fields, stale)).toThrow(/permission/);
    expect(() => deletePost('post', stale)).toThrow(/permission/);
    const saved = createPost(fields, stale);
    expect(saved.authorId).toBe('other');
    expect(saved.authorName).toBe('Other');
  });
  it.each([undefined, null, '', 'missing', 1, {}, []])('rejects missing or invalid ID %s', (id) => {
    signIn('admin');
    savePosts([original, { id: 'broken' }]);
    expect(() => updatePost(id, fields)).toThrow('Post not found');
    expect(() => deletePost(id)).toThrow('Post not found');
    expect(getPosts()).toEqual([original, { id: 'broken' }]);
  });
  it('rejects malformed target records', () => {
    signIn('admin');
    savePosts([{ id: 'post', title: {} }]);
    expect(() => updatePost('post', fields)).toThrow('Post not found');
    expect(() => deletePost('post')).toThrow('Post not found');
  });
  it.each(mutations)('reports %s write failures without altering persisted records', (_, mutate) => {
    signIn();
    savePosts([original]);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    expect(mutate).toThrow('Unable to save data in this browser. Please try again.');
    expect(getPosts()).toEqual([original]);
  });
  it.each(mutations)('fails closed on %s when storage reads throw', (_, mutate) => {
    signIn();
    savePosts([original]);
    const denial = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Denied'); });
    expect(mutate).toThrow(/log in again/);
    denial.mockRestore();
    expect(getPosts()).toEqual([original]);
  });
  it.each(['{bad', '[]', '{}', JSON.stringify({ userId: 'writer', role: 'admin' })])(
    'rejects corrupt or forged session %s for every mutation', (session) => {
      signIn();
      savePosts([original]);
      localStorage.setItem('writespace_session', session);
      mutations.forEach(([, mutate]) => expect(mutate).toThrow(/log in again/));
      expect(getPosts()).toEqual([original]);
    },
  );
  it('does not persist when UUID generation fails', () => {
    signIn();
    savePosts([original]);
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('UUID unavailable'); });
    expect(() => createPost(fields)).toThrow('UUID unavailable');
    expect(getPosts()).toEqual([original]);
  });
  it.each(['{bad', '{}', '[null]'])('treats corrupt/unusable post collection %s as missing', (records) => {
    signIn('admin');
    localStorage.setItem('writespace_posts', records);
    expect(() => updatePost('post', fields)).toThrow('Post not found');
    expect(() => deletePost('post')).toThrow('Post not found');
    expect(localStorage.getItem('writespace_posts')).toBe(records);
  });
});
