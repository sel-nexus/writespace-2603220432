/** Verify deterministic, non-mutating presentation of untrusted browser-local records. */
import { describe, expect, it } from 'vitest';
import { authorRole, canEdit, cardAccent, excerpt, formatDate, isPost, newestPosts } from './presentation';

const post = {
  id: 'entry', title: 'A thought', content: 'Plain text', authorId: 'writer', authorName: 'Writer',
  createdAt: '2026-03-04T12:00:00.000Z',
};
const account = {
  id: 'writer', displayName: 'Writer', username: 'writer', password: 'demo', role: 'user', createdAt: post.createdAt,
};

describe('safe posts and ordering', () => {
  it('accepts plain text including empty content and an unavailable date', () => {
    expect(isPost(post)).toBe(true);
    expect(isPost({ ...post, content: '', createdAt: 'bad' })).toBe(true);
  });
  it.each([null, [], 'entry', {}, { ...post, id: ' ' }, { ...post, title: {} },
    { ...post, content: null }, { ...post, authorName: [] }, { ...post, authorId: '' }, { ...post, createdAt: 4 }])(
    'rejects malformed post %j', (value) => {
      expect(isPost(value)).toBe(false);
    },
  );
  it('sorts newest first, keeps ties stable, places invalid dates last and never mutates input', () => {
    const records = [
      { ...post, id: 'unknown', createdAt: 'bad' },
      { ...post, id: 'old', createdAt: '2025-01-01' },
      { ...post, id: 'new' },
      { ...post, id: 'tie' },
      null,
      { ...post, id: 'unknown2', createdAt: '' },
    ];
    const before = JSON.stringify(records);
    expect(newestPosts(records).map((record) => record.id)).toEqual(['new', 'tie', 'old', 'unknown', 'unknown2']);
    expect(JSON.stringify(records)).toBe(before);
  });
  it.each([null, {}, 'bad', [], [null, {}]])('returns an empty list for %j', (value) => {
    expect(newestPosts(value)).toEqual([]);
  });
});

describe('text and dates', () => {
  it('uses English UTC rather than the browser timezone', () => {
    expect(formatDate('2026-03-04T23:30:00-08:00')).toBe('Mar 05, 2026');
    expect(formatDate(post.createdAt)).toBe('Mar 04, 2026');
  });
  it.each([null, undefined, {}, 0, '', 'not-a-date'])('labels unavailable date %j', (value) => {
    expect(formatDate(value)).toBe('Date unavailable');
  });
  it('takes exactly 120 characters without an ellipsis or HTML interpretation', () => {
    const content = `<script>alert('x')</script>${'x'.repeat(150)}`;
    expect(excerpt(content)).toBe(content.slice(0, 120));
    expect(excerpt('x'.repeat(120))).toHaveLength(120);
    expect(excerpt('short')).toBe('short');
    expect(excerpt('')).toBe('');
  });
  it.each([null, {}, 12])('safely handles non-text excerpt %j', (value) => {
    expect(excerpt(value)).toBe('');
  });
});

describe('roles and permissions', () => {
  it('resolves built-in admin independently of damaged account storage', () => {
    expect(authorRole('admin', null)).toBe('admin');
    expect(authorRole('admin', [{ id: 'admin', role: 'user' }])).toBe('admin');
  });
  it('uses matching existing account role and ignores unrelated accounts', () => {
    expect(authorRole('writer', [account])).toBe('user');
    expect(authorRole('writer', [null, { ...account, id: 'other' }, { ...account, role: 'admin' }])).toBe('admin');
  });
  it.each([null, {}, [], [null], [{ ...account, role: 'owner' }], [{ ...account, password: null }],
    [{ ...account, username: 'admin' }], [{ ...account, createdAt: 'bad' }], [{ ...account, displayName: {} }]])(
    'falls back to user for deleted or malformed author accounts %j', (users) => {
      expect(authorRole('writer', users)).toBe('user');
    },
  );
  it.each([
    [null, false], [{ userId: 'writer', role: 'user' }, true], [{ userId: 'other', role: 'user' }, false],
    [{ userId: 'other', role: 'admin' }, true], [{ userId: 'writer', role: 'owner' }, false],
    [{ role: 'admin' }, false], [{ userId: '', role: 'admin' }, false],
  ])('allows only administrators or owners for %j', (session, permitted) => {
    expect(canEdit(session, post)).toBe(permitted);
  });
  it('rejects missing and malformed posts even for an administrator', () => {
    expect(canEdit({ userId: 'admin', role: 'admin' }, null)).toBe(false);
    expect(canEdit({ userId: 'admin', role: 'admin' }, {})).toBe(false);
  });
});

describe('card accents', () => {
  it('cycles the four exact accents by rendered position', () => {
    expect([0, 1, 2, 3, 4, 5].map(cardAccent)).toEqual([
      'border-indigo-500', 'border-violet-500', 'border-pink-500', 'border-teal-500', 'border-indigo-500', 'border-violet-500',
    ]);
  });
  it.each([-1, 0.5, NaN, undefined, '2'])('defaults invalid position %j to indigo', (index) => {
    expect(cardAccent(index)).toBe('border-indigo-500');
  });
});
