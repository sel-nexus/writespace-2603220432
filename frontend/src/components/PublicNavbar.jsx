/** Present public navigation appropriate to the current local identity. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

const linkStyle = 'rounded-lg px-3 py-2 text-sm font-semibold focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';

/**
 * Show guest links or a role-aware dashboard link without adding a member shell.
 * @param {object} props Valid session or null.
 * @returns {JSX.Element} Sticky public header.
 */
export function PublicNavbar({ session = null }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-100 bg-white shadow-sm">
      <nav aria-label="Public navigation" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <Link to="/" className={`${linkStyle} text-xl tracking-tight text-indigo-600`}>
          WriteSpace
        </Link>
        {session ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-2 text-sm font-medium">
              <span
                aria-hidden="true"
                className={'flex h-9 w-9 items-center justify-center rounded-full ' +
                  (session.role === 'admin' ? 'bg-violet-600' : 'bg-indigo-500')}
              >
                {session.role === 'admin' ? '👑' : '📖'}
              </span>
              {session.displayName}
            </span>
            <Link to={session.role === 'admin' ? '/admin' : '/blogs'} className={`${linkStyle} text-indigo-600 hover:bg-indigo-50`}>
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Link to="/login" className={`${linkStyle} text-slate-800 hover:bg-slate-50`}>
              Login
            </Link>
            <Link to="/register" className={`${linkStyle} bg-indigo-600 text-white hover:bg-indigo-700`}>
              Get Started
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
PublicNavbar.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['admin', 'user']).isRequired,
  }),
};
