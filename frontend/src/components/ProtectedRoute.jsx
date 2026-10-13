/** Enforce browser-local navigation permissions, not server-side security. */
import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';
import { getSession } from '../utils/auth';

/**
 * Recheck canonical storage identity before rendering any protected content.
 * @param {object} props Optional children and required admin role, if any.
 * @param {React.ReactNode} [props.children] Protected content; null is valid for guests.
 * @param {'admin'} [props.role] Restrict access to a canonical admin session.
 * @returns {React.ReactNode} Protected content, including null, or a safe redirect.
 */
export function ProtectedRoute({ children, role }) {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  if (role === 'admin' && session.role !== 'admin') return <Navigate to="/blogs" replace />;
  return children;
}
ProtectedRoute.propTypes = {
  children: PropTypes.node,
  role: PropTypes.oneOf(['admin']),
};
