/** Verify reading, role guards and navigation through visible UI and persisted state. */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App';
import { Avatar, getAvatar } from '../components/Avatar';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { getSession, setSession } from '../utils/auth';
import { getPosts, getUsers, savePosts, saveUsers } from '../utils/storage';

const writer = {
  id: 'writer', username: 'writer', displayName: 'Writer', password: 'demo', role: 'user',
  createdAt: '2026-03-01T00:00:00Z',
};
const editor = { ...writer, id: 'editor', username: 'editor', displayName: 'Editor', role: 'admin' };
const own = {
  id: 'own', title: 'Own thoughts', content: 'A'.repeat(121), authorId: 'writer', authorName: 'Writer',
  createdAt: '2026-03-04T12:00:00Z',
};
const other = { ...own, id: 'other', title: 'Other thoughts', content: 'Other text', authorId: 'admin', authorName: 'Admin' };

/** Seed canonical local identity, preserving the built-in admin contract. */
function signIn(role = 'user') {
  saveUsers([writer, editor]);
  const session = role === 'admin'
    ? { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' }
    : { userId: writer.id, username: writer.username, displayName: writer.displayName, role: writer.role };
  setSession(session);
  return session;
}

/** Expose router destination as visible diagnostic text for direct-entry assertions. */
function RouteLocation() {
  const location = useLocation();
  return (
    <output aria-label="Current route">
      {location.pathname}
    </output>
  );
}

/** Mount the actual application at a direct route with isolated browser-local records. */
function open(path = '/blogs') {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
      <RouteLocation />
    </MemoryRouter>,
  );
}

const protectedPaths = ['/blogs', '/blog/own', '/write', '/edit/own', '/admin', '/users'];
describe('direct URL role matrix', () => {
  it.each(protectedPaths)('redirects guest %s to navbar-free login', async (path) => {
    open(path);
    expect(await screen.findByRole('button', { name: 'Login', exact: true })).toBeVisible();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
    expect(screen.queryByRole('navigation', { name: /navigation/ })).not.toBeInTheDocument();
    expect(getSession()).toBeNull();
  });
  it.each(protectedPaths)('routes a user entering %s to reading or its reader', async (path) => {
    signIn();
    savePosts([own, other]);
    open(path);
    const destination = ['/admin', '/users'].includes(path) ? '/blogs' : path;
    await waitFor(() => expect(screen.getByLabelText('Current route')).toHaveTextContent(destination));
    expect(screen.getByRole('navigation', { name: 'Member navigation' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Users', exact: true })).not.toBeInTheDocument();
  });
  it.each(protectedPaths)('routes an admin entering %s to its finished member page', async (path) => {
    signIn('admin');
    savePosts([own]);
    open(path);
    await waitFor(() => expect(screen.getByLabelText('Current route').textContent).toBe(path));
    expect(screen.getByRole('navigation', { name: 'Member navigation' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Users', exact: true })).toHaveAttribute('href', '/users');
    if (path === '/admin') expect(screen.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    if (path === '/users') expect(screen.getByRole('heading', { name: 'Manage Users' })).toBeVisible();
  });
  it.each(['/login', '/register'])('redirects signed-in users from %s to blogs', async (path) => {
    signIn();
    open(path);
    expect(await screen.findByRole('heading', { name: 'All Blogs' })).toBeVisible();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
  });
  it.each(['/login', '/register'])('redirects signed-in admin from %s to the finished dashboard', async (path) => {
    signIn('admin');
    open(path);
    await waitFor(() => expect(screen.getByLabelText('Current route').textContent).toBe('/admin'));
    expect(screen.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  });
  it.each(['{bad', '[]', JSON.stringify({ userId: 'writer', role: 'admin' })])('rejects malformed sessions %s', async (session) => {
    saveUsers([writer]);
    localStorage.setItem('writespace_session', session);
    open();
    expect(await screen.findByRole('button', { name: 'Login', exact: true })).toBeVisible();
  });
  it('does not trust a supplied child or deleted-account session', async () => {
    signIn();
    saveUsers([]);
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProtectedRoute role="admin">
          <p>Restricted content</p>
        </ProtectedRoute>
        <RouteLocation />
      </MemoryRouter>,
    );
    expect(screen.queryByText('Restricted content')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
  });
  it('keeps unknown routes public', async () => {
    open('/unknown');
    expect(await screen.findByRole('navigation', { name: 'Public navigation' })).toBeVisible();
  });
});

describe('blog collection and reader', () => {
  it('sorts every card, truncates exactly 120 characters, cycles accents and shows only owned edit links', () => {
    signIn();
    const posts = [1, 5, 2, 4, 3].map((day) => ({
      ...own, id: String(day), title: `Entry ${day}`, createdAt: `2026-03-0${day}T00:00:00Z`,
      authorId: day === 5 ? 'writer' : 'admin',
    }));
    savePosts(posts);
    open();
    const cards = screen.getAllByRole('article');
    expect(cards.map((card) => within(card).getByRole('heading').textContent)).toEqual([
      'Entry 5', 'Entry 4', 'Entry 3', 'Entry 2', 'Entry 1',
    ]);
    expect(within(cards[0]).getByText('A'.repeat(120))).toBeVisible();
    expect(screen.queryByText('A'.repeat(121))).not.toBeInTheDocument();
    expect(within(cards[0]).getByText('Mar 05, 2026')).toBeVisible();
    ['indigo', 'violet', 'pink', 'teal', 'indigo'].forEach((color, index) => {
      expect(cards[index]).toHaveClass(`border-${color}-500`);
    });
    expect(screen.getAllByRole('link', { name: /^Edit / })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Edit Entry 5' })).toHaveAttribute('href', '/edit/5');
    expect(getPosts()).toEqual(posts);
  });
  it('allows admin edits on every card and identifies existing and deleted authors by account role', () => {
    signIn('admin');
    savePosts([own, other, { ...own, id: 'editor-post', title: 'Editor post', authorId: 'editor', authorName: 'Editor' },
      { ...own, id: 'deleted', title: 'Saved author', authorId: 'deleted', authorName: 'Former Admin' }]);
    open();
    const cards = screen.getAllByRole('article');
    expect(screen.getAllByRole('link', { name: /^Edit / })).toHaveLength(4);
    expect(within(cards[0]).getByRole('img', { name: 'user avatar' })).toBeVisible();
    expect(within(cards[1]).getByRole('img', { name: 'Admin avatar' })).toBeVisible();
    expect(within(cards[2]).getByRole('img', { name: 'Admin avatar' })).toBeVisible();
    expect(within(cards[3]).getByRole('img', { name: 'user avatar' })).toBeVisible();
    expect(within(cards[3]).getByText('Former Admin')).toBeVisible();
  });
  it.each(['[]', '{bad', '{}', '[null,{},42]'])('shows empty state for empty or damaged posts %s', (records) => {
    signIn();
    localStorage.setItem('writespace_posts', records);
    open();
    expect(screen.getByRole('heading', { name: 'No blogs yet. Be the first to write one!' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Write a Blog' })).toHaveAttribute('href', '/write');
    expect(localStorage.getItem('writespace_posts')).toBe(records);
  });
  it('offers the empty write CTA to admin too', () => {
    signIn('admin');
    open();
    expect(screen.getByRole('link', { name: 'Write a Blog' })).toBeVisible();
  });
  it('skips malformed records while displaying safe plain text and unavailable dates', () => {
    signIn();
    savePosts([null, {}, { ...own, title: '<img src=x onerror=alert(1)>', content: '<script>alert(1)</script>', createdAt: 'bad' }]);
    open();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: '<img src=x onerror=alert(1)>' })).toBeVisible();
    expect(screen.getByText('<script>alert(1)</script>')).toBeVisible();
    expect(screen.getByText('Date unavailable')).toBeVisible();
    expect(document.querySelector('script, img')).toBeNull();
  });
  it.each([['user', 'own', true], ['user', 'other', false], ['admin', 'own', true], ['admin', 'other', true]])(
    'reader edit permission for %s reading %s is %s', (role, id, permitted) => {
      signIn(role);
      savePosts([own, other]);
      open(`/blog/${id}`);
      expect(Boolean(screen.queryByRole('link', { name: 'Edit', exact: true }))).toBe(permitted);
      expect(screen.getByRole('link', { name: 'Back to All Posts' })).toHaveAttribute('href', '/blogs');
      expect(Boolean(screen.queryByRole('button', { name: 'Delete' }))).toBe(permitted);
    },
  );
  it('reads full content as plain text with whitespace preserved and navigates back', async () => {
    signIn();
    const content = '  First line\n\n  <script>alert(1)</script>\n' + 'x'.repeat(150);
    savePosts([{ ...own, content }]);
    open();
    await userEvent.click(screen.getByRole('link', { name: /Own thoughts.*First line/ }));
    const body = screen.getByText((_, element) => element.tagName === 'P' && element.textContent === content);
    expect(body).toHaveClass('whitespace-pre-wrap');
    expect(body.textContent).toBe(content);
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Own thoughts');
    await userEvent.click(screen.getByRole('link', { name: 'Back to All Posts' }));
    expect(screen.getByRole('heading', { name: 'All Blogs' })).toBeVisible();
    expect(getPosts()[0].content).toBe(content);
  });
  it.each(['/blog/missing', '/blog/own'])('handles missing or malformed reader %s with a back link', (path) => {
    signIn();
    savePosts([{ id: 'own', content: {} }]);
    open(path);
    expect(screen.getByRole('heading', { name: 'Post not found' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to All Posts' })).toHaveAttribute('href', '/blogs');
    expect(screen.queryByRole('link', { name: 'Edit', exact: true })).not.toBeInTheDocument();
  });
  it('shows deleted reader author name and user avatar, even when account storage is corrupt', () => {
    signIn('admin');
    savePosts([{ ...own, authorId: 'deleted', authorName: 'Saved name' }]);
    localStorage.setItem('writespace_users', '{bad');
    open('/blog/own');
    expect(screen.getByText('Saved name')).toBeVisible();
    expect(within(screen.getByRole('article')).getByRole('img', { name: 'user avatar' })).toBeVisible();
  });
  it('opens real write and edit forms through member links without saving on navigation', async () => {
    signIn();
    savePosts([own]);
    open('/blog/own');
    await userEvent.click(screen.getByRole('link', { name: 'Edit', exact: true }));
    expect(await screen.findByRole('heading', { name: 'Edit Blog' })).toBeVisible();
    expect(screen.getByLabelText('Title')).toHaveValue(own.title);
    await userEvent.click(screen.getByRole('button', { name: 'Toggle navigation' }));
    await userEvent.click(screen.getByRole('link', { name: 'Write', exact: true }));
    expect(screen.getByRole('heading', { name: 'Write a Blog' })).toBeVisible();
    expect(screen.getByLabelText('Title')).toHaveValue('');
    expect(getPosts()).toEqual([own]);
  });
});

describe('confirmed reader deletion', () => {
  it.each(['user', 'admin'])('cancels then confirms deletion for %s and refreshes persisted collection', async (role) => {
    signIn(role);
    savePosts([own, other]);
    open('/blog/own');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(confirm).toHaveBeenCalledWith('Delete “Own thoughts”? This cannot be undone.');
    expect(getPosts()).toEqual([own, other]);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blog/own');
    confirm.mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('heading', { name: 'All Blogs' })).toBeVisible();
    expect(getPosts()).toEqual([other]);
    expect(screen.queryByRole('heading', { name: own.title })).not.toBeInTheDocument();
  });
  it('permits admin deletion of another author and handles an empty result', async () => {
    signIn('admin');
    savePosts([other]);
    open('/blog/other');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('heading', { name: 'No blogs yet. Be the first to write one!' })).toBeVisible();
    expect(getPosts()).toEqual([]);
  });
  it('reports failed deletion and allows retry without claiming persistence', async () => {
    signIn();
    savePosts([own]);
    open('/blog/own');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const denial = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Denied'); });
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to save data in this browser. Please try again.');
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blog/own');
    expect(getPosts()).toEqual([own]);
    denial.mockRestore();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('heading', { name: 'All Blogs' })).toBeVisible();
    expect(getPosts()).toEqual([]);
  });
  it.each(['logout', 'ownership', 'missing', 'deleted account', 'changed session'])('rejects stale %s after confirm and stays with feedback', async (change) => {
    signIn();
    savePosts([own]);
    open('/blog/own');
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      if (change === 'logout') localStorage.removeItem('writespace_session');
      if (change === 'ownership') savePosts([{ ...own, authorId: 'admin' }]);
      if (change === 'missing') savePosts([]);
      if (change === 'deleted account') saveUsers([]);
      if (change === 'changed session') {
        localStorage.setItem('writespace_session', JSON.stringify({
          userId: 'editor', username: 'editor', displayName: 'Editor', role: 'user',
        }));
      }
      return true;
    });
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      change === 'missing' ? 'Post not found' : change === 'ownership' ? /permission/ : /log in again/,
    );
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blog/own');
    expect(getPosts()).toEqual(change === 'missing' ? [] : change === 'ownership' ? [{ ...own, authorId: 'admin' }] : [own]);
  });
});

describe('navigation, avatars and revalidation', () => {
  it('exports accessible static role avatars and defaults unknown roles to user', () => {
    render(
      <div>
        <Avatar role="admin" />
        <Avatar />
        {getAvatar('unknown')}
      </div>,
    );
    expect(screen.getByRole('img', { name: 'Admin avatar' })).toHaveClass('bg-violet-600');
    screen.getAllByRole('img', { name: 'user avatar' }).forEach((avatar) => expect(avatar).toHaveClass('bg-indigo-500'));
  });
  it('toggles navigation and dropdown both ways and marks the active link', async () => {
    signIn();
    open();
    const toggle = screen.getByRole('button', { name: 'Toggle navigation' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'All Blogs', exact: true })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'All Blogs', exact: true })).toHaveClass('bg-indigo-600');
    expect(screen.getByRole('link', { name: 'Write', exact: true })).not.toHaveAttribute('aria-current');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const account = screen.getByRole('button', { name: 'Account for Writer' });
    await userEvent.click(account);
    expect(screen.getByRole('button', { name: 'Logout' })).toBeVisible();
    await userEvent.click(account);
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
  });
  it.each(['user', 'admin'])('logs out %s to the public navbar preserving both collections', async (role) => {
    signIn(role);
    savePosts([own]);
    const accounts = getUsers();
    open();
    await userEvent.click(screen.getByRole('button', { name: `Account for ${role === 'admin' ? 'Admin' : 'Writer'}` }));
    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));
    expect(await screen.findByRole('navigation', { name: 'Public navigation' })).toBeVisible();
    expect(getSession()).toBeNull();
    expect(localStorage.getItem('writespace_session')).toBeNull();
    expect(getUsers()).toEqual(accounts);
    expect(getPosts()).toEqual([own]);
  });
  it('reports failed logout, stays signed in, preserves records and permits retry', async () => {
    const session = signIn();
    savePosts([own]);
    const accounts = getUsers();
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Account for Writer' }));
    const denial = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('Denied'); });
    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to clear your session in this browser. Please try again.');
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
    expect(getSession()).toEqual(session);
    expect(getPosts()).toEqual([own]);
    expect(getUsers()).toEqual(accounts);
    denial.mockRestore();
    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));
    expect(await screen.findByRole('navigation', { name: 'Public navigation' })).toBeVisible();
    expect(getSession()).toBeNull();
  });
  it('selects public navbar for signed-in landing and closes member popovers on logo navigation', async () => {
    signIn();
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Toggle navigation' }));
    await userEvent.click(screen.getByRole('button', { name: 'Account for Writer' }));
    await userEvent.click(screen.getByRole('link', { name: 'WriteSpace', exact: true }));
    expect(screen.getByRole('navigation', { name: 'Public navigation' })).toBeVisible();
    expect(screen.queryByRole('navigation', { name: 'Member navigation' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Go to Dashboard' }));
    expect(await screen.findByRole('button', { name: 'Toggle navigation' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
  });
  it('refreshes collections and canonical role after a cross-tab storage event', async () => {
    signIn();
    open();
    savePosts([own]);
    act(() => window.dispatchEvent(new Event('storage')));
    expect(await screen.findByRole('heading', { name: 'Own thoughts' })).toBeVisible();
    saveUsers([{ ...writer, role: 'admin' }]);
    localStorage.setItem('writespace_session', JSON.stringify({
      userId: 'writer', username: 'writer', displayName: 'Writer', role: 'admin',
    }));
    act(() => window.dispatchEvent(new Event('storage')));
    await userEvent.click(screen.getByRole('button', { name: 'Toggle navigation' }));
    expect(screen.getByRole('link', { name: 'Users', exact: true })).toBeVisible();
  });
  it('invalidates a deleted account on storage events and never exposes its reading page', async () => {
    signIn();
    savePosts([own]);
    open();
    saveUsers([]);
    act(() => window.dispatchEvent(new Event('storage')));
    expect(await screen.findByRole('button', { name: 'Login', exact: true })).toBeVisible();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(getPosts()).toEqual([own]);
  });
  it('rechecks same-tab deletion during navigation instead of trusting cached session', async () => {
    signIn();
    savePosts([own]);
    open();
    saveUsers([]);
    await userEvent.click(screen.getByRole('link', { name: /^Own thoughts/ }));
    expect(await screen.findByRole('button', { name: 'Login', exact: true })).toBeVisible();
    expect(screen.queryByRole('navigation', { name: 'Member navigation' })).not.toBeInTheDocument();
  });
});
