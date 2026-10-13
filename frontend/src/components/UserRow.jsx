/** Render the same local identity as a desktop row or a mobile card. */
import PropTypes from 'prop-types';
import { Avatar } from './Avatar';
import { accountDeletionReason } from '../utils/accounts';
import { formatDate } from '../utils/presentation';

/**
 * Show identity metadata and protected deletion in the chosen responsive layout.
 * @param {object} props Account, current session, deletion callback and mobile layout switch.
 * @returns {JSX.Element} Semantic table row or stacked article.
 */
export function UserRow({ account, session, onDelete, mobile = false }) {
  const reason = accountDeletionReason(account, session);
  const date = account.id === 'admin' ? 'Built-in' : formatDate(account.createdAt);
  const badge = account.role === 'admin'
    ? 'bg-violet-100 text-violet-700 ring-violet-300'
    : 'bg-indigo-100 text-indigo-700 ring-indigo-300';
  const identity = (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar role={account.role} />
      <span className="break-words font-semibold text-slate-800">
        {account.displayName}
      </span>
    </div>
  );
  const role = (
    <span className={`inline-flex rounded-full px-3 py-0.5 text-sm font-medium ring-1 ${badge}`}>
      {account.role === 'admin' ? 'Admin' : 'user'}
    </span>
  );
  const button = (
    <span title={reason || undefined} className="inline-block">
      <button
        type="button"
        aria-label={`Delete ${account.username}`}
        title={reason || undefined}
        disabled={Boolean(reason)}
        onClick={() => onDelete(account)}
        className={'rounded-lg border border-red-200 bg-red-50 px-4 py-2 font-medium text-red-600 ' +
          'hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ' +
          'disabled:cursor-not-allowed disabled:opacity-50'}
      >
        Delete
      </button>
    </span>
  );
  if (mobile) {
    return (
      <article aria-label={`Account ${account.username}`} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        {identity}
        <dl className="grid grid-cols-2 gap-3 text-sm text-slate-600">
          <dt>
            Username
          </dt>
          <dd className="break-all">
            {account.username}
          </dd>
          <dt>
            Role
          </dt>
          <dd>
            {role}
          </dd>
          <dt>
            Created
          </dt>
          <dd>
            {date}
          </dd>
        </dl>
        {button}
      </article>
    );
  }
  return (
    <tr aria-label={`Account ${account.username}`} className="border-t border-slate-100">
      <td className="px-5 py-4">
        {identity}
      </td>
      <td className="break-all px-5 py-4 text-sm text-slate-600">
        {account.username}
      </td>
      <td className="px-5 py-4">
        {role}
      </td>
      <td className="px-5 py-4 text-sm text-slate-500">
        {date}
      </td>
      <td className="px-5 py-4 text-right">
        {button}
      </td>
    </tr>
  );
}

UserRow.propTypes = {
  account: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['admin', 'user']).isRequired,
    createdAt: PropTypes.string,
  }).isRequired,
  session: PropTypes.shape({ userId: PropTypes.string.isRequired }),
  onDelete: PropTypes.func.isRequired,
  mobile: PropTypes.bool,
};
