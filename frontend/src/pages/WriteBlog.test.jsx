/** Verify editor UI, real persistence, navigation and stale permission rejection. */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App';
import { login, clearSession } from '../utils/auth';
import { getPosts, savePosts, saveUsers } from '../utils/storage';

const writer = {
  id: 'writer', username: 'writer', displayName: 'Writer', password: 'demo', role: 'user',
  createdAt: '2026-03-01T00:00:00Z',
};
const other = { ...writer, id: 'other', username: 'other', displayName: 'Other' };
const editor = { ...writer, id: 'editor', username: 'editor', displayName: 'Editor', role: 'admin' };
const original = {
  id: 'post', title: 'Original', content: '  Original\n\nText', createdAt: '2026-03-02T00:00:00Z',
  authorId: 'writer', authorName: 'Saved Writer',
};

/** Seed valid identities and select the current role. */
function signIn(name = 'writer') {
  saveUsers([writer, other, editor]);
  login(name, name === 'admin' ? 'admin' : 'demo');
}

/** Expose route destination without inspecting component internals. */
function Location() {
  const location = useLocation();
  return (
    <output aria-label="Route">
      {location.pathname}
    </output>
  );
}

/** Mount the real route wiring at one initial entry. */
function open(path = '/write') {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
      <Location />
    </MemoryRouter>,
  );
}

/** Fill both required controls via user-visible labels. */
async function fill(title = 'New title', content = 'New content') {
  await userEvent.clear(screen.getByLabelText('Title'));
  await userEvent.type(screen.getByLabelText('Title'), title);
  await userEvent.clear(screen.getByLabelText('Content'));
  await userEvent.type(screen.getByLabelText('Content'), content);
}

describe('create and edit UI', () => {
  it('renders required text controls, a 256px textarea and live character counter with field errors', async () => {
    signIn();
    open();
    const title = screen.getByLabelText('Title');
    const content = screen.getByLabelText('Content');
    expect(title).toHaveAttribute('type', 'text');
    expect(title).toBeRequired();
    expect(content).toBeRequired();
    expect(content.tagName).toBe('TEXTAREA');
    expect(content).toHaveClass('min-h-[256px]', 'w-full');
    expect(screen.getByText('0 characters')).toHaveAttribute('aria-live', 'polite');
    await userEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
    expect(screen.getByText('Title is required.')).toHaveAttribute('id', 'title-error');
    expect(screen.getByText('Content is required.')).toHaveAttribute('id', 'content-error');
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveAttribute('aria-describedby', 'title-error');
    expect(content).toHaveAttribute('aria-describedby', 'content-error content-counter');
    expect(getPosts()).toEqual([]);
    await fill(' ', ' \n ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    await fill('Title', 'abc\ndef');
    expect(screen.getByText('7 characters')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('heading', { name: 'Title' })).toBeVisible();
    expect(getPosts()[0].content).toBe('abc\ndef');
  });
  it.each(['writer', 'admin', 'editor'])('creates as %s and reads exact persisted plain text', async (name) => {
    signIn(name);
    savePosts([original]);
    open();
    const title = '<img src=x onerror=alert(1)>';
    const content = '  <script>alert(1)</script>\n\n  End';
    await fill(title, content);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('heading', { name: title })).toBeVisible();
    const saved = getPosts()[1];
    expect(saved.title).toBe(title);
    expect(saved.content).toBe(content);
    expect(saved.authorId).toBe(name === 'admin' ? 'admin' : name);
    expect(saved.id).toMatch(/^[\da-f-]{36}$/i);
    expect(new Date(saved.createdAt).toISOString()).toBe(saved.createdAt);
    expect(Object.keys(saved).sort()).toEqual(['authorId', 'authorName', 'content', 'createdAt', 'id', 'title']);
    expect(screen.getByLabelText('Route')).toHaveTextContent(`/blog/${saved.id}`);
    expect(document.querySelector('main img, main script')).toBeNull();
  });
  it.each(['writer', 'admin', 'editor'])('prefills and saves permitted edits for %s preserving metadata', async (name) => {
    signIn(name);
    savePosts([original]);
    open('/edit/post');
    expect(screen.getByLabelText('Title')).toHaveValue(original.title);
    expect(screen.getByLabelText('Content')).toHaveValue(original.content);
    expect(screen.getByText(`${original.content.length} characters`)).toBeVisible();
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('heading', { name: 'New title' })).toBeVisible();
    expect(getPosts()).toEqual([{ ...original, title: 'New title', content: 'New content' }]);
    await userEvent.click(screen.getByRole('link', { name: 'Back to All Posts' }));
    expect(screen.getByRole('heading', { name: 'New title' })).toBeVisible();
  });
  it('preserves freshly requeried metadata after a concurrent stored change', async () => {
    signIn('admin');
    savePosts([original]);
    open('/edit/post');
    await fill();
    const fresh = { ...original, authorId: 'other', authorName: 'Fresh name', createdAt: '2026-01-01T00:00:00Z' };
    savePosts([fresh]);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('heading', { name: 'New title' })).toBeVisible();
    expect(getPosts()).toEqual([{ ...fresh, title: 'New title', content: 'New content' }]);
  });
  it('redirects a different writer to blogs without changing another author post', async () => {
    signIn('other');
    savePosts([original]);
    open('/edit/post');
    expect(await screen.findByRole('heading', { name: 'All Blogs' })).toBeVisible();
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    expect(getPosts()).toEqual([original]);
  });
  it.each(['/edit/missing', '/edit/post'])('shows Post not found for missing or malformed editor %s', (path) => {
    signIn();
    savePosts([{ id: 'post', title: null }]);
    open(path);
    expect(screen.getByRole('heading', { name: 'Post not found' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to All Posts' })).toHaveAttribute('href', '/blogs');
  });
  it.each(['/write', '/edit/post'])('sends guest %s to login', (path) => {
    open(path);
    expect(screen.getByRole('button', { name: 'Login', exact: true })).toBeVisible();
    expect(screen.queryByLabelText('Content')).not.toBeInTheDocument();
  });
});

describe('cancel and save failure paths', () => {
  it.each(['/write', '/edit/post'])('uses direct-entry /blogs cancel fallback for %s without saving', async (path) => {
    signIn();
    savePosts([original]);
    open(path);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('heading', { name: 'All Blogs' })).toBeVisible();
    expect(getPosts()).toEqual([original]);
  });
  it('uses actual in-app history on edit cancel without saving changed text', async () => {
    signIn();
    savePosts([original]);
    open('/blog/post');
    await userEvent.click(screen.getByRole('link', { name: 'Edit', exact: true }));
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('heading', { name: 'Original' })).toBeVisible();
    expect(screen.getByLabelText('Route')).toHaveTextContent('/blog/post');
    expect(getPosts()).toEqual([original]);
  });
  it('uses in-app history from the empty-list write link without persisting', async () => {
    signIn();
    open('/blogs');
    await userEvent.click(screen.getByRole('link', { name: 'Write a Blog' }));
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('heading', { name: 'All Blogs' })).toBeVisible();
    expect(getPosts()).toEqual([]);
  });
  it.each(['/write', '/edit/post'])('shows storage save errors and allows retry on %s', async (path) => {
    signIn();
    savePosts([original]);
    open(path);
    await fill();
    const denial = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to save data in this browser. Please try again.');
    expect(screen.getByLabelText('Route').textContent).toBe(path);
    expect(screen.getByLabelText('Title')).toHaveValue('New title');
    expect(getPosts()).toEqual([original]);
    denial.mockRestore();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('heading', { name: 'New title' })).toBeVisible();
  });
  it.each(['/write', '/edit/post'])('rejects stale logged-out identity on %s without a success redirect', async (path) => {
    signIn();
    savePosts([original]);
    open(path);
    await fill();
    clearSession();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please log in again before changing posts.');
    expect(screen.getByLabelText('Route').textContent).toBe(path);
    expect(getPosts()).toEqual([original]);
  });
  it.each(['deleted account', 'role drift'])('rejects %s at editor save', async (change) => {
    signIn('editor');
    savePosts([original]);
    open('/edit/post');
    await fill();
    saveUsers(change === 'deleted account' ? [writer, other] : [writer, other, { ...editor, role: 'user' }]);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/log in again/);
    expect(screen.getByLabelText('Route')).toHaveTextContent('/edit/post');
    expect(getPosts()).toEqual([original]);
  });
  it.each(['Title', 'Content'])('shows only the missing %s field error', async (field) => {
    signIn();
    open();
    await fill();
    await userEvent.clear(screen.getByLabelText(field));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent(`${field} is required.`);
    expect(getPosts()).toEqual([]);
  });
  it('rejects newly changed ownership at save and retains form feedback', async () => {
    signIn();
    savePosts([original]);
    open('/edit/post');
    await fill();
    const fresh = { ...original, authorId: 'other' };
    savePosts([fresh]);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/permission/);
    expect(getPosts()).toEqual([fresh]);
    expect(screen.getByLabelText('Route')).toHaveTextContent('/edit/post');
  });
  it('rejects a post removed after the editor was opened', async () => {
    signIn();
    savePosts([original]);
    open('/edit/post');
    await fill();
    savePosts([]);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(getPosts()).toEqual([]));
    expect(screen.getByRole('alert')).toHaveTextContent('Post not found');
    expect(screen.getByLabelText('Title')).toHaveValue('New title');
    expect(screen.getByLabelText('Route')).toHaveTextContent('/edit/post');
  });
});
