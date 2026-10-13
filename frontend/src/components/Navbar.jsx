/** Share role-aware member navigation and report failed local logout honestly. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Avatar } from './Avatar';
import { clearSession } from '../utils/auth';

/**
 * Render member links, mobile navigation and the account dropdown.
 * @param {object} props Canonical session.
 * @returns {JSX.Element} Responsive member navigation.
 */
export function Navbar({ session }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const links = [{ to: '/blogs', label: 'All Blogs' }, { to: '/write', label: 'Write' }];
  if (session.role === 'admin') links.push({ to: '/users', label: 'Users' });

  /** Close both navigation popovers after following a link. */
  function close() {
    setMobileOpen(false);
    setAccountOpen(false);
  }

  /** Remove only the session and leave the current page unchanged on failure. */
  function logout() {
    try {
      clearSession();
      // App's navigation effect refreshes identity after leaving the protected URL.
      navigate('/');
      close();
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-100 bg-white shadow-sm">
      <nav aria-label="Member navigation" className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-4">
        <Link to="/" onClick={close} className="font-['Libre_Baskerville',serif] text-2xl text-indigo-600 focus-visible:ring-2">
          WriteSpace
        </Link>
        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
          aria-controls="member-links"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg p-2 text-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-500 md:hidden"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d={mobileOpen ? 'M6 6l12 12M6 18L18 6' : 'M3 6h18M3 12h18M3 18h18'} />
          </svg>
        </button>
        <div className="relative ml-auto">
          <button
            type="button"
            aria-label={`Account for ${session.displayName}`}
            aria-expanded={accountOpen}
            aria-controls="account-actions"
            onClick={() => setAccountOpen(!accountOpen)}
            className="flex items-center gap-2 rounded-full p-1 pr-3 text-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Avatar role={session.role} />
            <span className="max-w-32 truncate text-sm font-medium sm:max-w-48">
              {session.displayName}
            </span>
          </button>
          {accountOpen && (
            <div id="account-actions" className="absolute right-0 mt-3 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
              <button type="button" onClick={logout} className="w-full rounded-lg px-4 py-2 text-left hover:bg-slate-100 focus-visible:ring-2">
                Logout
              </button>
              {error && (
                <p role="alert" className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>
        <div
          id="member-links"
          className={`${mobileOpen ? 'flex' : 'hidden'} order-last w-full flex-col gap-2 md:order-none md:flex md:w-auto md:flex-row`}
        >
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={close}
              className={({ isActive }) => [
                'rounded-full px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-indigo-500',
                isActive ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-600',
              ].join(' ')}
            >
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  );
}
Navbar.propTypes = {
  session: PropTypes.shape({ role: PropTypes.oneOf(['admin', 'user']).isRequired, displayName: PropTypes.string.isRequired }).isRequired,
};
