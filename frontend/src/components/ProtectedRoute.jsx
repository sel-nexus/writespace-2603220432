/** Enforce browser-local navigation permissions, not server-side security. */
import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';
import { getSession } from '../utils/auth';

/**
 * Recheck canonical storage identity before rendering any protected content.
 * @param {object} props Children and optional required admin role.
 * @returns {JSX.Element} Protected content or a safe redirect.
 */
export function ProtectedRoute({ children, role }) {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  if (role === 'admin' && session.role !== 'admin') return <Navigate to="/blogs" replace />;
  return children;
}
ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  role: PropTypes.oneOf(['admin']),
};
