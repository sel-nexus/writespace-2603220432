/** Create browser-local writer accounts with accessible validation feedback. */
import PropTypes from 'prop-types';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FormField } from '../components/FormField';
import { register } from '../utils/auth';

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';
const fields = [
  ['displayName', 'Display Name', 'text', 'nickname'],
  ['username', 'Username', 'text', 'username'],
  ['password', 'Password', 'password', 'new-password'],
  ['confirmPassword', 'Confirm Password', 'password', 'new-password'],
];

/**
 * Save only a user identity and remain on the form when either write fails.
 * @param {object} props Callback to refresh application session state.
 * @returns {JSX.Element} Registration form with local-demo warning.
 */
export default function RegisterPage({ onAuthenticated }) {
  const [values, setValues] = useState({ displayName: '', username: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const navigate = useNavigate();

  /** Validate each field before calling the shared registration service. */
  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    fields.forEach(([key, label]) => {
      const value = key === 'username' || key === 'displayName' ? values[key].trim() : values[key];
      if (!value) nextErrors[key] = `${label} is required.`;
    });
    if (values.password && values.confirmPassword && values.password !== values.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords must match.';
    }
    setErrors(nextErrors);
    setError('');
    if (Object.keys(nextErrors).length) return;
    try {
      register(values);
      onAuthenticated();
      navigate('/blogs', { replace: true });
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
              Make room for your ideas
            </p>
            <h1 className="mt-4 font-['Libre_Baskerville',serif] text-3xl">
              Begin your story.
            </h1>
            <p className="mt-3 leading-6 text-slate-600">
              Create a writer account in this browser.
            </p>
            <form noValidate onSubmit={handleSubmit} className="mt-7 space-y-5">
              {fields.map(([key, label, type, autoComplete]) => (
                <FormField
                  key={key}
                  id={key}
                  label={label}
                  type={type}
                  value={values[key]}
                  onChange={(event) => setValues({ ...values, [key]: event.target.value })}
                  error={errors[key]}
                  autoComplete={autoComplete}
                />
              ))}
              {error && (
                <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-600">
                  {error}
                </p>
              )}
              <button type="submit" className={`w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700 ${focus}`}>
                Register
              </button>
            </form>
            <p className="mt-6 text-sm text-slate-600">
              Already have a space?{' '}
              <Link to="/login" className={`rounded font-semibold text-indigo-600 hover:underline ${focus}`}>
                Login
              </Link>
            </p>
          </div>
        </section>
        <p className="mt-6 text-sm leading-6 text-slate-600">
          Local demo only. Passwords are stored in plaintext in this browser. No secure authentication or encryption.
          Never use a real password or sensitive data. Accounts do not sync across devices.
        </p>
      </div>
    </main>
  );
}
RegisterPage.propTypes = { onAuthenticated: PropTypes.func.isRequired };
