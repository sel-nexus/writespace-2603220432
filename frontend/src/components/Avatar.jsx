/** Render the fixed role identity markers required by the local demo. */
import PropTypes from 'prop-types';

/**
 * Return a static role-colored avatar; unknown roles use the writer fallback.
 * @param {string} role Account role.
 * @returns {JSX.Element} Accessible crown or book marker.
 */
export function getAvatar(role) {
  if (role === 'admin') {
    return (
      <span
        role="img"
        aria-label="Admin avatar"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600"
      >
        👑
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label="user avatar"
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500"
    >
      📖
    </span>
  );
}

/**
 * Render the shared role avatar as a component.
 * @param {object} props Account role.
 * @returns {JSX.Element} Static identity marker.
 */
export function Avatar({ role = 'user' }) {
  return getAvatar(role);
}
Avatar.propTypes = { role: PropTypes.string };
