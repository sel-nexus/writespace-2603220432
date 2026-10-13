/** Verify exact collection keys, resilient reads and reported persistence failures. */
import { describe, expect, it, vi } from 'vitest';
import { getPosts, savePosts, getUsers, saveUsers } from './storage';

describe.each([
  ['writespace_posts', getPosts, savePosts],
  ['writespace_users', getUsers, saveUsers],
])('%s collection', (key, read, save) => {
  it('starts empty, replaces data, and preserves unrelated keys', () => {
    expect(read()).toEqual([]);
    localStorage.setItem('unrelated', 'keep');
    const records = [{ id: 'one', title: 'A thought' }];
    save(records);
    expect(JSON.parse(localStorage.getItem(key))).toEqual(records);
    expect(read()).toEqual(records);
    save([]);
    expect(read()).toEqual([]);
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });

  it.each(['broken{', '{}', 'null', '"text"', '42'])('returns empty for malformed collection %s', (raw) => {
    localStorage.setItem(key, raw);
    expect(read()).toEqual([]);
    expect(localStorage.getItem(key)).toBe(raw);
  });

  it('returns empty when reads are denied', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    expect(read()).toEqual([]);
  });

  it.each([null, {}, 'text', 42, undefined])('rejects non-array writes without changing storage: %s', (value) => {
    save([{ id: 'before' }]);
    expect(() => save(value)).toThrow('Expected an array');
    expect(read()).toEqual([{ id: 'before' }]);
  });

  it('reports quota failures and retains the previous collection', () => {
    save([{ id: 'before' }]);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => save([{ id: 'after' }])).toThrow('Unable to save data');
    expect(read()).toEqual([{ id: 'before' }]);
  });

  it('reports serialization failures without replacing existing data', () => {
    save([{ id: 'before' }]);
    const circular = [];
    circular.push(circular);
    expect(() => save(circular)).toThrow('Unable to save data');
    expect(read()).toEqual([{ id: 'before' }]);
  });
});
