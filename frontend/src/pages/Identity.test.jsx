/** Verify discovery, accessible forms and identity routing through the real services. */
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';
import { getSession, login, register } from '../utils/auth';
import { getUsers, savePosts, saveUsers } from '../utils/storage';

/** Expose actual route changes to assertions rather than inspecting navigation mocks. */
function LocationLabel() {
  const location = useLocation();
  return (
    <output aria-label="Current route">
      {location.pathname}
    </output>
  );
}

/** Mount the app with an explicit initial entry and observable location. */
function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
      <LocationLabel />
    </MemoryRouter>,
  );
}

/** Mount a form with real destination routes to prove its required redirect target. */
function renderForm(Page, path) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path={path} element={<Page onAuthenticated={() => {}} />} />
        <Route path="/blogs" element={<h1>Writer destination</h1>} />
        <Route path="/admin" element={<h1>Admin destination</h1>} />
      </Routes>
      <LocationLabel />
    </MemoryRouter>,
  );
}

/** Fill the registration fields through their accessible labels. */
async function fillRegistration(user, overrides = {}) {
  const values = { 'Display Name': ' Jane Doe ', Username: ' jane ', Password: 'demo', 'Confirm Password': 'demo', ...overrides };
  for (const [label, value] of Object.entries(values)) {
    if (value) await user.type(screen.getByLabelText(label), value);
  }
}

/** Inject an environmental write denial while preserving actual reads and other keys. */
function denyWrite(key) {
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (name, value) {
    if (name === key) throw new Error('quota');
    return original.call(this, name, value);
  });
}

describe('public discovery', () => {
  it('renders required copy, empty state, footer and guest navigation', async () => {
    const user = userEvent.setup();
    renderApp();
    expect(screen.getByRole('heading', { name: 'WriteSpace', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Your thoughts. Your space. Beautifully simple.')).toBeInTheDocument();
    for (const title of ['Write Freely', 'Private & Local', 'Instant & Fast']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
    expect(screen.getByText('No posts yet — check back soon!')).toBeInTheDocument();
    expect(screen.getByText(/Local demo only:/)).toHaveTextContent('plaintext passwords');
    const footer = screen.getByRole('navigation', { name: 'Footer navigation' });
    expect(within(footer).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(within(footer).getByRole('link', { name: 'All Blogs' })).toHaveAttribute('href', '/blogs');
    expect(screen.getByRole('link', { name: 'Get Started Free' })).toHaveAttribute('href', '/register');
    await user.click(screen.getByRole('link', { name: 'Start Reading' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
    expect(screen.getByText(/Built-in demo account:/)).toHaveTextContent('username admin, password admin');
    await user.click(screen.getByRole('link', { name: 'Register' }));
    expect(screen.getByRole('heading', { name: 'Begin your story.' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Login' }));
    expect(screen.getByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument();
  });

  it('shows only three newest valid previews with dates, 120-character excerpts and guarded links', async () => {
    savePosts([
      ...[1, 4, 2, 3].map((day) => ({ id: String(day), title: `Entry ${day}`, content: 'x'.repeat(121),
        createdAt: `2026-03-0${day}T12:00:00.000Z`, authorId: 'admin', authorName: 'Admin' })),
      null, { id: 'bad', title: 'Broken', content: 'text', createdAt: 'invalid' },
    ]);
    renderApp();
    const entries = screen.getAllByRole('heading', { level: 3 });
    expect(entries.map((heading) => heading.textContent)).toEqual(['Entry 4', 'Entry 3', 'Entry 2']);
    expect(screen.queryByText('Entry 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Broken')).not.toBeInTheDocument();
    expect(screen.getAllByText('x'.repeat(120))).toHaveLength(3);
    expect(screen.getByText('Mar 04, 2026')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('link', { name: /Entry 4/ }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
  });

  it.each(['{broken', '{}'])('degrades corrupt post storage %s into the empty state', (raw) => {
    localStorage.setItem('writespace_posts', raw);
    renderApp();
    expect(screen.getByText('No posts yet — check back soon!')).toBeInTheDocument();
  });

  it('updates previews after a storage event and cleans up on unmount', () => {
    const view = renderApp();
    savePosts([{ id: 'new', title: 'Fresh words', content: 'A new page', createdAt: '2026-03-04T12:00:00.000Z' }]);
    act(() => window.dispatchEvent(new Event('storage')));
    expect(screen.getByRole('heading', { name: 'Fresh words' })).toBeInTheDocument();
    view.unmount();
    act(() => window.dispatchEvent(new Event('storage')));
  });

  it.each(['admin', 'user'])('shows the correct signed-in %s dashboard link and redirects auth visits', async (role) => {
    if (role === 'admin') login('admin', 'admin');
    else register({ displayName: 'Writer', username: 'writer', password: 'demo', confirmPassword: 'demo' });
    renderApp('/login');
    const dashboard = await screen.findByRole('link', { name: 'Go to Dashboard' });
    expect(dashboard).toHaveAttribute('href', role === 'admin' ? '/admin' : '/blogs');
    expect(screen.getByText(role === 'admin' ? 'Admin' : 'Writer')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start Reading' })).toHaveAttribute('href', '/blogs');
    expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/$/);
    await userEvent.setup().click(within(screen.getByRole('navigation', { name: 'Footer navigation' }))
      .getByRole('link', { name: 'Register' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/$/);
    expect(screen.queryByRole('heading', { name: 'Begin your story.' })).not.toBeInTheDocument();
  });

  it('removes a deleted identity from public navigation after storage revalidation', async () => {
    register({ displayName: 'Writer', username: 'writer', password: 'demo', confirmPassword: 'demo' });
    renderApp();
    expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toBeInTheDocument();
    saveUsers([]);
    act(() => window.dispatchEvent(new Event('storage')));
    expect(screen.queryByRole('link', { name: 'Go to Dashboard' })).not.toBeInTheDocument();
    await userEvent.setup().click(within(screen.getByRole('navigation', { name: 'Public navigation' }))
      .getByRole('link', { name: 'Login' }));
    expect(screen.getByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument();
  });

  it.each(['/blogs', '/admin', '/blog/missing'])('redirects guest entry %s to login', (path) => {
    renderApp(path);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
  });

  it('returns unknown routes to the public landing without creating other pages', () => {
    renderApp('/unknown');
    expect(screen.getByRole('heading', { name: 'WriteSpace' })).toBeInTheDocument();
  });
});

describe('login form', () => {
  it('associates required errors with labelled fields and saves nothing', async () => {
    renderApp('/login');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Login' }));
    for (const label of ['Username', 'Password']) {
      const input = screen.getByLabelText(label);
      expect(input).toHaveAttribute('aria-required', 'true');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAccessibleDescription(`${label} is required.`);
    }
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(getSession()).toBeNull();
  });

  it('reports invalid credentials and allows correcting them into built-in admin login', async () => {
    const user = userEvent.setup();
    renderForm(LoginPage, '/login');
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid username or password.');
    expect(getSession()).toBeNull();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'admin');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByRole('heading', { name: 'Admin destination' })).toBeInTheDocument();
    expect(getSession()).toEqual({ userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' });
  });

  it('sends stored writers to the writer role home', async () => {
    register({ displayName: 'Writer', username: 'writer', password: 'demo', confirmPassword: 'demo' });
    localStorage.removeItem('writespace_session');
    renderForm(LoginPage, '/login');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Username'), 'writer');
    await user.type(screen.getByLabelText('Password'), 'demo');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByRole('heading', { name: 'Writer destination' })).toBeInTheDocument();
    expect(getSession().role).toBe('user');
  });

  it('stays on the form and preserves inputs on session write failure', async () => {
    denyWrite('writespace_session');
    renderApp('/login');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'admin');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to save your session');
    expect(screen.getByLabelText('Username')).toHaveValue('admin');
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
    expect(getSession()).toBeNull();
  });
});

describe('registration form', () => {
  it('requires every field and exposes error descriptions', async () => {
    renderApp('/register');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Register' }));
    for (const label of ['Display Name', 'Username', 'Password', 'Confirm Password']) {
      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(`${label} is required.`);
    }
    expect(screen.getByLabelText('Confirm Password')).toHaveAttribute('type', 'password');
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
  });

  it('rejects mismatches then saves trimmed writer data and navigates to blogs after correction', async () => {
    const user = userEvent.setup();
    renderForm(RegisterPage, '/register');
    await fillRegistration(user, { 'Confirm Password': 'other' });
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByLabelText('Confirm Password')).toHaveAccessibleDescription('Passwords must match.');
    expect(getUsers()).toEqual([]);
    await user.clear(screen.getByLabelText('Confirm Password'));
    await user.type(screen.getByLabelText('Confirm Password'), 'demo');
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByRole('heading', { name: 'Writer destination' })).toBeInTheDocument();
    expect(getUsers()[0]).toMatchObject({ displayName: 'Jane Doe', username: 'jane', role: 'user', password: 'demo' });
    expect(getSession().userId).toBe(getUsers()[0].id);
    expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual(getSession());
  });

  it.each(['admin', 'existing'])('rejects reserved or existing username %s without a session', async (name) => {
    if (name === 'existing') saveUsers([{ username: 'existing' }]);
    const before = getUsers();
    renderApp('/register');
    const user = userEvent.setup();
    await fillRegistration(user, { Username: name });
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Username is already taken.');
    expect(getUsers()).toEqual(before);
    expect(getSession()).toBeNull();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/register');
  });

  it.each(['writespace_users', 'writespace_session'])('reports %s write failure without navigating', async (key) => {
    denyWrite(key);
    renderApp('/register');
    const user = userEvent.setup();
    await fillRegistration(user);
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByRole('alert')).toHaveTextContent(key === 'writespace_users'
      ? 'Unable to save data' : 'Your account was saved, but your session could not be saved.');
    expect(getUsers()).toHaveLength(key === 'writespace_users' ? 0 : 1);
    expect(getSession()).toBeNull();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/register');
    expect(screen.getByLabelText('Display Name')).toHaveValue(' Jane Doe ');
  });
});
