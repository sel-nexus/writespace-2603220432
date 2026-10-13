/** Offer plaintext demo login with clear local-storage failure feedback. */
import PropTypes from 'prop-types';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FormField } from '../components/FormField';
import { login } from '../utils/auth';

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';

/**
 * Authenticate a guest without navigating on validation or write failure.
 * @param {object} props Callback to refresh application session state.
 * @returns {JSX.Element} Login form and demo credential hints.
 */
export default function LoginPage({ onAuthenticated }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const navigate = useNavigate();

  /** Validate required fields, then persist and navigate to the role home. */
  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!username.trim()) nextErrors.username = 'Username is required.';
    if (!password) nextErrors.password = 'Password is required.';
    setErrors(nextErrors);
    setError('');
    if (Object.keys(nextErrors).length) return;
    try {
      const session = login(username, password);
      onAuthenticated();
      navigate(session.role === 'admin' ? '/admin' : '/blogs', { replace: true });
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className={`inline-block rounded text-xl font-bold text-indigo-600 ${focus}`}>
          WriteSpace
        </Link>
        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
          <div aria-hidden="true" className="h-2 bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-500" />
          <div className="p-7 sm:p-9">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
              Your words are waiting
            </p>
            <h1 className="mt-4 font-['Libre_Baskerville',serif] text-3xl">
              Welcome back.
            </h1>
            <p className="mt-3 leading-6 text-slate-600">
              Login to your local writing space.
            </p>
            <form noValidate onSubmit={handleSubmit} className="mt-7 space-y-5">
              <FormField
                id="username"
                label="Username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                error={errors.username}
                autoComplete="username"
              />
              <FormField
                id="password"
                label="Password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                error={errors.password}
                autoComplete="current-password"
              />
              {error && (
                <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-600">
                  {error}
                </p>
              )}
              <button type="submit" className={`w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700 ${focus}`}>
                Login
              </button>
            </form>
            <p className="mt-6 text-sm text-slate-600">
              New here?{' '}
              <Link to="/register" className={`rounded font-semibold text-indigo-600 hover:underline ${focus}`}>
                Register
              </Link>
            </p>
            <aside className="mt-7 border-t border-slate-200 pt-5 text-sm leading-6 text-slate-600">
              Built-in demo account: username <strong>admin</strong>, password <strong>admin</strong>.
            </aside>
          </div>
        </section>
        <p className="mt-6 text-sm leading-6 text-slate-600">
          Local demo only. Passwords are stored in plaintext in this browser. No secure authentication or encryption.
          Never use a real password or sensitive data.
        </p>
      </div>
    </main>
  );
}
LoginPage.propTypes = { onAuthenticated: PropTypes.func.isRequired };
