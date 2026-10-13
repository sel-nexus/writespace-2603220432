/** Verify actual Admin routes, forms, controls and persisted state without mocking app services. */
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App';
import AdminDashboard from './AdminDashboard';
import UserManagement from './UserManagement';
import { StatCard } from '../components/StatCard';
import { UserRow } from '../components/UserRow';
import { getSession, login, SESSION_KEY } from '../utils/auth';
import { getPosts, getUsers, savePosts, saveUsers } from '../utils/storage';

const writer = {
  id: 'writer', username: 'writer', displayName: 'Writer', password: 'demo', role: 'user',
  createdAt: '2026-03-01T00:00:00.000Z',
};
const editor = { ...writer, id: 'editor', username: 'editor', displayName: 'Editor', role: 'admin' };
const posts = [1, 6, 3, 5, 2, 4].map((day) => ({
  id: String(day), title: `Entry ${day}`, content: `Text ${day}`, createdAt: `2026-03-0${day}T00:00:00.000Z`,
  authorId: day === 6 ? 'editor' : 'writer', authorName: day === 6 ? 'Editor' : 'Writer',
}));

/** Expose current route for assertions without replacing actual page behavior. */
function Location() {
  const location = useLocation();
  return (
    <span aria-label="Current route">
      {location.pathname}
    </span>
  );
}

/** Mount the actual guarded application with canonical local identities. */
function open(path = '/admin', identity = 'admin') {
  saveUsers([writer, editor]);
  savePosts(posts);
  if (identity) login(identity, identity === 'admin' ? 'admin' : 'demo');
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
      <Location />
    </MemoryRouter>,
  );
}

/** Fill required account fields through labelled controls. */
async function fill(role = 'user', username = 'new') {
  await userEvent.type(screen.getByLabelText('Display Name'), 'New Name');
  await userEvent.type(screen.getByLabelText('Username', { exact: true }), username);
  await userEvent.type(screen.getByLabelText('Password'), 'dummy');
  await userEvent.selectOptions(screen.getByLabelText('Role', { exact: true }), role);
}

/** Select a semantic desktop row; mobile rendering is asserted independently. */
function row(username) {
  return within(screen.getByRole('table', { name: 'Local accounts' })).getByRole('row', { name: `Account ${username}` });
}

/** Read an exact capitalization-sensitive statistic card. */
function count(label, value) {
  expect(within(screen.getByRole('region', { name: label, exact: true })).getByText(String(value))).toBeVisible();
}

describe('Admin route destinations', () => {
  it.each(['/admin', '/users'])('renders guarded %s with member navigation', (path) => {
    open(path);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(path === '/admin' ? 'Admin Dashboard' : 'Manage Users');
    expect(screen.getByRole('navigation', { name: 'Member navigation' })).toBeVisible();
    expect(screen.getByLabelText('Current route').textContent).toBe(path);
  });
  it.each(['/admin', '/users'])('redirects guest %s to login', async (path) => {
    open(path, null);
    expect(await screen.findByRole('button', { name: 'Login', exact: true })).toBeVisible();
    expect(screen.getByLabelText('Current route').textContent).toBe('/login');
  });
  it.each(['/admin', '/users'])('redirects regular writer %s without Admin controls', async (path) => {
    open(path, 'writer');
    expect(await screen.findByRole('heading', { name: 'All Blogs' })).toBeVisible();
    expect(screen.getByLabelText('Current route').textContent).toBe('/blogs');
    expect(screen.queryByRole('link', { name: 'Users', exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Create User' })).not.toBeInTheDocument();
    expect(getUsers()).toEqual([writer, editor]);
  });
  it.each(['/login', '/register'])('redirects signed-in Admin %s to actual dashboard', async (path) => {
    open(path);
    expect(await screen.findByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    expect(screen.getByLabelText('Current route').textContent).toBe('/admin');
  });
  it('revalidates deleted account on a storage event', async () => {
    open('/users', 'editor');
    act(() => {
      saveUsers([writer]);
      window.dispatchEvent(new Event('storage'));
    });
    expect(await screen.findByRole('button', { name: 'Login', exact: true })).toBeVisible();
    expect(getSession()).toBeNull();
  });
});

describe('responsive accounts and creation', () => {
  it('lists builtin dates, avatars, role badges and desktop/mobile protected controls', () => {
    open('/users', 'editor');
    const table = screen.getByRole('table', { name: 'Local accounts' });
    expect(table.parentElement).toHaveClass('hidden', 'md:block');
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Display Name', 'Username', 'Role', 'Created', 'Actions',
    ]);
    expect(within(row('admin')).getByText('Built-in')).toBeVisible();
    expect(within(row('admin')).getByRole('img', { name: 'Admin avatar' })).toBeVisible();
    expect(within(row('writer')).getByRole('img', { name: 'user avatar' })).toBeVisible();
    expect(within(row('writer')).getByText('Mar 01, 2026')).toBeVisible();
    expect(within(row('editor')).getByText('Admin')).toHaveClass('bg-violet-100');
    expect(within(row('writer')).getByText('user')).toHaveClass('bg-indigo-100');
    const reasonIds = [];
    for (const [layoutName, layout] of [
      ['desktop', table],
      ['mobile', screen.getByLabelText('Mobile accounts')],
    ]) {
      const builtin = within(layout).getByRole('button', { name: 'Delete admin' });
      const self = within(layout).getByRole('button', { name: 'Delete editor' });
      expect(builtin).toBeDisabled();
      expect(builtin).toHaveAttribute('title', 'Default admin cannot be deleted.');
      expect(self).toBeDisabled();
      expect(self).toHaveAttribute('title', 'You cannot delete your own account.');
      for (const [button, accountId, reason] of [
        [builtin, 'admin', 'Default admin cannot be deleted.'],
        [self, 'editor', 'You cannot delete your own account.'],
      ]) {
        const reasonId = `deletion-reason-${layoutName}-${accountId}`;
        expect(button).toHaveAttribute('aria-describedby', reasonId);
        expect(button).toHaveAccessibleDescription(reason);
        const target = document.getElementById(reasonId);
        expect(target).toBeVisible();
        expect(target.textContent).toBe(reason);
        expect(within(layout).getByText(reason, { exact: true })).toBe(target);
        reasonIds.push(reasonId);
      }
      const enabled = within(layout).getByRole('button', { name: 'Delete writer' });
      expect(enabled).toBeEnabled();
      expect(enabled).not.toHaveAttribute('aria-describedby');
      expect(enabled).toHaveAccessibleDescription('');
    }
    expect(new Set(reasonIds).size).toBe(4);
    const mobile = screen.getByLabelText('Mobile accounts');
    expect(mobile).toHaveClass('md:hidden');
    expect(within(mobile).getAllByRole('article')).toHaveLength(3);
  });
  it('shows required field associations and retains empty storage on invalid submission', async () => {
    open('/users');
    await userEvent.click(screen.getByRole('button', { name: 'Create User' }));
    for (const label of ['Display Name', 'Username', 'Password']) {
      const input = screen.getByLabelText(label, { exact: true });
      expect(input).toHaveAttribute('aria-required', 'true');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(document.getElementById(input.getAttribute('aria-describedby'))).toHaveTextContent(/required/);
    }
    expect(screen.getByLabelText('Role')).toHaveAttribute('aria-required', 'true');
    expect(getUsers()).toEqual([writer, editor]);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
  it.each(['user', 'admin'])('creates %s, refreshes both layouts and clears fields only after saving', async (role) => {
    open('/users');
    const session = getSession();
    await fill(role);
    await userEvent.click(screen.getByRole('button', { name: 'Create User' }));
    const saved = getUsers().at(-1);
    expect(saved).toMatchObject({ displayName: 'New Name', username: 'new', password: 'dummy', role });
    expect(saved.id).toMatch(/^[a-f0-9-]{36}$/i);
    expect(new Date(saved.createdAt).toISOString()).toBe(saved.createdAt);
    expect(getSession()).toEqual(session);
    expect(within(row('new')).getByText(role === 'admin' ? 'Admin' : 'user')).toBeVisible();
    expect(within(screen.getByLabelText('Mobile accounts')).getByRole('article', { name: 'Account new' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Account “new” created.');
    expect(screen.getByLabelText('Display Name')).toHaveValue('');
    expect(screen.getByLabelText('Username')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Role')).toHaveValue('user');
  });
  it.each(['admin', 'writer'])('rejects duplicate/reserved %s inline, retaining fields', async (username) => {
    open('/users');
    await fill('admin', username);
    await userEvent.click(screen.getByRole('button', { name: 'Create User' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Username is already taken.');
    expect(screen.getByLabelText('Username')).toHaveValue(username);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(getUsers()).toEqual([writer, editor]);
  });
  it('retains form on failed persistence then retries successfully', async () => {
    open('/users');
    await fill();
    const denial = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Denied'); });
    await userEvent.click(screen.getByRole('button', { name: 'Create User' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Unable to save data/);
    expect(screen.getByLabelText('Password')).toHaveValue('dummy');
    expect(getUsers()).toEqual([writer, editor]);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    denial.mockRestore();
    await userEvent.click(screen.getByRole('button', { name: 'Create User' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(getUsers()).toHaveLength(3);
  });
  it('rejects stale creation identity without trusting the rendered Admin', async () => {
    open('/users');
    await fill();
    login('writer', 'demo');
    await userEvent.click(screen.getByRole('button', { name: 'Create User' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Admin access/);
    expect(getUsers()).toEqual([writer, editor]);
  });
  it('refreshes accounts after storage events without losing unsaved fields', async () => {
    open('/users');
    await fill();
    act(() => {
      saveUsers([writer]);
      window.dispatchEvent(new Event('storage'));
    });
    expect(within(screen.getByRole('table')).queryByRole('row', { name: 'Account editor' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toHaveValue('new');
  });
  it('handles damaged storage with only builtin visible', () => {
    login('admin', 'admin');
    localStorage.setItem('writespace_users', '{bad');
    render(
      <UserManagement />,
    );
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
    expect(within(screen.getByLabelText('Mobile accounts')).getAllByRole('article')).toHaveLength(1);
  });
});

describe('account confirmation and failure states', () => {
  it.each(['writer', 'editor'])('cancel leaves %s unchanged; confirm removes both rows and keeps posts', async (username) => {
    open('/users');
    const before = getPosts();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await userEvent.click(within(row(username)).getByRole('button', { name: `Delete ${username}` }));
    expect(confirm).toHaveBeenCalledWith(`Delete account “${username}”? Authored posts will be kept.`);
    expect(getUsers()).toEqual([writer, editor]);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    confirm.mockReturnValue(true);
    await userEvent.click(within(row(username)).getByRole('button', { name: `Delete ${username}` }));
    expect(getUsers().map((account) => account.username)).toEqual([username === 'writer' ? 'editor' : 'writer']);
    expect(screen.queryByRole('row', { name: `Account ${username}` })).not.toBeInTheDocument();
    expect(screen.queryByRole('article', { name: `Account ${username}` })).not.toBeInTheDocument();
    expect(getPosts()).toEqual(before);
    expect(screen.getByRole('status')).toHaveTextContent(/deleted.*kept/);
  });
  it('mobile delete delegates the same confirm action', async () => {
    open('/users');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await userEvent.click(within(screen.getByLabelText('Mobile accounts')).getByRole('button', { name: 'Delete writer' }));
    expect(getUsers()).toEqual([editor]);
  });
  it('disabled default and self buttons never open confirm or write', async () => {
    open('/users', 'editor');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await userEvent.click(within(row('admin')).getByRole('button'));
    await userEvent.click(within(row('editor')).getByRole('button'));
    expect(confirm).not.toHaveBeenCalled();
    expect(getUsers()).toEqual([writer, editor]);
  });
  it('failed account deletion stays inline and unchanged, then retry clears error', async () => {
    open('/users');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const denial = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Denied'); });
    await userEvent.click(within(row('writer')).getByRole('button'));
    expect(screen.getByRole('alert')).toHaveTextContent(/Unable to save data/);
    expect(row('writer')).toBeVisible();
    expect(getUsers()).toEqual([writer, editor]);
    expect(getPosts()).toEqual(posts);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    denial.mockRestore();
    await userEvent.click(within(row('writer')).getByRole('button'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(getUsers()).toEqual([editor]);
  });
  it.each(['logout', 'user', 'deleted Admin', 'self', 'missing'])(
    'rechecks %s changed during account confirmation', async (change) => {
      open('/users', 'editor');
      vi.spyOn(window, 'confirm').mockImplementation(() => {
        if (change === 'logout') localStorage.removeItem(SESSION_KEY);
        if (change === 'user') login('writer', 'demo');
        if (change === 'deleted Admin') saveUsers([writer]);
        if (change === 'self') saveUsers([{ ...writer, role: 'admin' }, editor]);
        if (change === 'self') login('writer', 'demo');
        if (change === 'missing') saveUsers([editor]);
        return true;
      });
      await userEvent.click(within(row('writer')).getByRole('button'));
      expect(screen.getByRole('alert')).toHaveTextContent(
        change === 'self' ? /own account/ : change === 'missing' ? /not found/ : /Admin access/,
      );
      expect(screen.getByRole('status')).toBeEmptyDOMElement();
      expect(getPosts()).toEqual(posts);
      expect(getUsers().some((account) => account.id === 'writer')).toBe(change !== 'missing');
    },
  );
});

describe('dashboard counts, recent activity and quick actions', () => {
  it('renders exact four counts, bounded gradient and five newest entries with controls', () => {
    open();
    count('Total Posts', 6);
    count('Total Users', 3);
    count('Total Admins', 2);
    count('Total users', 1);
    expect(screen.getByRole('heading', { level: 1 }).parentElement).toHaveClass('from-violet-600', 'to-indigo-600');
    const recent = screen.getByRole('region', { name: 'Recent Posts' });
    expect(within(recent).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      'Entry 6', 'Entry 5', 'Entry 4', 'Entry 3', 'Entry 2',
    ]);
    expect(within(recent).getAllByRole('button', { name: /^Delete / })).toHaveLength(5);
    expect(within(recent).getByRole('link', { name: 'Edit Entry 6' })).toHaveAttribute('href', '/edit/6');
    expect(within(recent).getByRole('link', { name: 'Entry 6', exact: true })).toHaveAttribute('href', '/blog/6');
    expect(within(recent).getAllByRole('img', { name: 'Admin avatar' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Write New Post' })).toHaveAttribute('href', '/write');
    expect(screen.getByRole('link', { name: 'Manage Users' })).toHaveAttribute('href', '/users');
    expect(getPosts()).toEqual(posts);
  });
  it('quick actions and recent edit reach finished pages, Cancel retains posts', async () => {
    open();
    await userEvent.click(screen.getByRole('link', { name: 'Edit Entry 6' }));
    expect(await screen.findByRole('heading', { name: 'Edit Blog' })).toBeVisible();
    expect(screen.getByLabelText('Title')).toHaveValue('Entry 6');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    await userEvent.click(screen.getByRole('link', { name: 'Manage Users' }));
    expect(screen.getByRole('heading', { name: 'Manage Users' })).toBeVisible();
    await userEvent.click(screen.getByRole('link', { name: 'WriteSpace' }));
    await userEvent.click(screen.getByRole('link', { name: 'Go to Dashboard' }));
    await userEvent.click(screen.getByRole('link', { name: 'Write New Post' }));
    expect(screen.getByRole('heading', { name: 'Write a Blog' })).toBeVisible();
    expect(getPosts()).toEqual(posts);
  });
  it('cancel then confirm deletion updates counts and brings sixth entry into recent list', async () => {
    open();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await userEvent.click(screen.getByRole('button', { name: 'Delete Entry 6' }));
    expect(confirm).toHaveBeenCalledWith('Delete “Entry 6”? This cannot be undone.');
    expect(getPosts()).toEqual(posts);
    count('Total Posts', 6);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    confirm.mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: 'Delete Entry 6' }));
    expect(getPosts()).toEqual(posts.filter((post) => post.id !== '6'));
    count('Total Posts', 5);
    expect(screen.getByRole('link', { name: 'Entry 1', exact: true })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Entry 6', exact: true })).not.toBeInTheDocument();
  });
  it('reports post write failure with unchanged counts then retries', async () => {
    open();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const denial = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Denied'); });
    await userEvent.click(screen.getByRole('button', { name: 'Delete Entry 6' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Unable to save data/);
    expect(getPosts()).toEqual(posts);
    count('Total Posts', 6);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    denial.mockRestore();
    await userEvent.click(screen.getByRole('button', { name: 'Delete Entry 6' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    count('Total Posts', 5);
  });
  it.each(['logout', 'user', 'missing', 'deleted Admin'])(
    'rechecks %s during dashboard confirmation', async (change) => {
      open('/admin', 'editor');
      vi.spyOn(window, 'confirm').mockImplementation(() => {
        if (change === 'logout') localStorage.removeItem(SESSION_KEY);
        if (change === 'user') login('writer', 'demo');
        if (change === 'missing') savePosts(posts.filter((post) => post.id !== '6'));
        if (change === 'deleted Admin') saveUsers([writer]);
        return true;
      });
      await userEvent.click(screen.getByRole('button', { name: 'Delete Entry 6' }));
      expect(screen.getByRole('alert')).toHaveTextContent(
        change === 'missing' ? 'Post not found' : change === 'user' ? /permission/ : /log in again/,
      );
      expect(screen.getByRole('status')).toBeEmptyDOMElement();
      expect(getPosts()).toEqual(change === 'missing' ? posts.filter((post) => post.id !== '6') : posts);
    },
  );
  it('refreshes counts and recent posts on storage changes', () => {
    open();
    act(() => {
      saveUsers([writer]);
      savePosts([]);
      window.dispatchEvent(new Event('storage'));
    });
    count('Total Posts', 0);
    count('Total Users', 2);
    count('Total Admins', 1);
    expect(screen.getByText('No posts yet. Write your first story.')).toBeVisible();
  });
  it('survives damaged collections and does not offer actions for an unauthenticated display', () => {
    localStorage.setItem('writespace_users', '{bad');
    localStorage.setItem('writespace_posts', '{}');
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AdminDashboard />
      </MemoryRouter>,
    );
    count('Total Users', 1);
    count('Total Posts', 0);
    expect(screen.getByText('No posts yet. Write your first story.')).toBeVisible();
  });
  it('hides permission controls for non-owner even when dashboard is rendered outside its guard', () => {
    saveUsers([writer, editor]);
    login('writer', 'demo');
    savePosts([posts.find((post) => post.id === '6')]);
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AdminDashboard />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: /^Delete / })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Edit / })).not.toBeInTheDocument();
  });
});

describe('shared Admin components', () => {
  it('stat card uses the default accent and displays zero', () => {
    render(
      <StatCard label="Empty" value={0} />,
    );
    expect(screen.getByText('0')).toBeVisible();
    expect(document.querySelector('svg').parentElement).toHaveClass('bg-indigo-100');
  });
  it('mobile row renders missing-date fallback and invokes its callback', async () => {
    const remove = vi.fn();
    render(
      <UserRow account={{ ...writer, createdAt: undefined }} onDelete={remove} mobile />,
    );
    expect(screen.getByText('Date unavailable')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Delete writer' }));
    expect(remove).toHaveBeenCalledWith({ ...writer, createdAt: undefined });
  });
});
