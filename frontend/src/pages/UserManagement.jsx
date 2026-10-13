/** Create and delete local accounts without profile updates or post cascades. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { FormField } from '../components/FormField';
import { UserRow } from '../components/UserRow';
import { createAccount, deleteAccount, listAccounts, validateAccountFields } from '../utils/accounts';
import { getSession } from '../utils/auth';

const emptyFields = { displayName: '', username: '', password: '', role: 'user' };

/**
 * Render required creation fields and responsive account listings with confirmation and failure feedback.
 * @param {object} props Optional callback after a successfully persisted account change.
 * @returns {JSX.Element} Local account management surface, guarded by App.
 */
export default function UserManagement({ onAccountsChanged }) {
  const [accounts, setAccounts] = useState(listAccounts);
  const [fields, setFields] = useState(emptyFields);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const session = getSession();

  useEffect(() => {
    /** Refresh displayed identities without discarding unfinished form text. */
    function refresh() {
      setAccounts(listAccounts());
    }
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);

  /** Update a single creation field while keeping input identity stable. */
  function change(key, value) {
    setFields({ ...fields, [key]: value });
  }

  /** Refresh only after successful persistence and notify the shared shell. */
  function changed(message) {
    setAccounts(listAccounts());
    setStatus(message);
    onAccountsChanged?.();
  }

  /** Validate required fields, then create using canonical service authorization. */
  function create(event) {
    event.preventDefault();
    setError('');
    setStatus('');
    const validation = validateAccountFields(fields);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    try {
      const account = createAccount(fields);
      setFields(emptyFields);
      changed(`Account “${account.username}” created.`);
    } catch (failure) {
      setError(failure.message);
    }
  }

  /** Confirm before requerying identity and the account at the deletion boundary. */
  function remove(account) {
    setError('');
    setStatus('');
    if (!window.confirm(`Delete account “${account.username}”? Authored posts will be kept.`)) return;
    try {
      deleteAccount(account.id);
      changed(`Account “${account.username}” deleted. Authored posts were kept.`);
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-12 text-slate-800">
      <h1 className="font-['Libre_Baskerville',serif] text-4xl leading-tight">
        Manage Users
      </h1>
      <p className="mt-4 text-slate-600">
        Local identities, all in this browser. Deleting an account keeps its writing.
      </p>
      <form onSubmit={create} noValidate className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">
          Create User
        </h2>
        <p className="text-sm text-slate-500">
          Demo passwords are plaintext. Never use a real password.
        </p>
        <div className="grid gap-5 md:grid-cols-2">
          <FormField
            id="displayName"
            label="Display Name"
            value={fields.displayName}
            onChange={(event) => change('displayName', event.target.value)}
            error={errors.displayName}
            autoComplete="off"
          />
          <FormField
            id="username"
            label="Username"
            value={fields.username}
            onChange={(event) => change('username', event.target.value)}
            error={errors.username}
            autoComplete="off"
          />
          <FormField
            id="password"
            label="Password"
            type="password"
            value={fields.password}
            onChange={(event) => change('password', event.target.value)}
            error={errors.password}
            autoComplete="new-password"
          />
          <div className="space-y-2">
            <label htmlFor="role" className="block text-sm font-semibold">
              Role
            </label>
            <select
              id="role"
              value={fields.role}
              onChange={(event) => change('role', event.target.value)}
              required
              aria-required="true"
              aria-invalid={Boolean(errors.role)}
              aria-describedby={errors.role ? 'role-error' : undefined}
              className={'w-full rounded-lg border border-slate-300 bg-white px-3 py-3 outline-none ' +
                'focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'}
            >
              <option value="user">
                user
              </option>
              <option value="admin">
                Admin
              </option>
            </select>
            {errors.role && (
              <p id="role-error" role="alert" className="text-sm text-red-600">
                {errors.role}
              </p>
            )}
          </div>
        </div>
        <button
          type="submit"
          className={'rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 ' +
            'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'}
        >
          Create User
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-red-600">
          {error}
        </p>
      )}
      <p role="status" className="mt-5 text-sm text-teal-700">
        {status}
      </p>
      <section aria-labelledby="accounts-heading" className="mt-8">
        <h2 id="accounts-heading" className="mb-5 text-2xl font-semibold">
          Accounts
        </h2>
        <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
          <table className="w-full text-left" aria-label="Local accounts">
            <thead className="bg-slate-50 text-sm text-slate-600">
              <tr>
                {['Display Name', 'Username', 'Role', 'Created', 'Actions'].map((label) => (
                  <th key={label} scope="col" className="px-5 py-4">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <UserRow key={account.id} account={account} session={session} onDelete={remove} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-4 md:hidden" aria-label="Mobile accounts">
          {accounts.map((account) => (
            <UserRow key={account.id} account={account} session={session} onDelete={remove} mobile />
          ))}
        </div>
      </section>
    </main>
  );
}

UserManagement.propTypes = { onAccountsChanged: PropTypes.func };
