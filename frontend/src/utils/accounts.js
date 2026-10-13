/** Manage local demo accounts; plaintext passwords and browser guards are not server security. */
import { BUILT_IN_ADMIN, getSession } from './auth';
import { getPosts, getUsers, saveUsers } from './storage';

/**
 * Recognize accounts safe to display, matching the authentication schema.
 * @param {*} account Possible persisted identity.
 * @returns {boolean} Whether the stored identity is complete and non-reserved.
 */
function isAccount(account) {
  return Boolean(account && typeof account === 'object' && !Array.isArray(account) &&
    typeof account.id === 'string' && account.id.trim() && account.id !== 'admin' &&
    typeof account.username === 'string' && account.username.trim() && account.username !== 'admin' &&
    typeof account.displayName === 'string' && account.displayName.trim() &&
    typeof account.password === 'string' && account.password.length &&
    ['admin', 'user'].includes(account.role) && typeof account.createdAt === 'string' &&
    Number.isFinite(Date.parse(account.createdAt)));
}

/**
 * List usable identities with the immutable built-in Admin first, without rewriting storage.
 * @returns {Array} Account records, including the built-in identity without a fabricated date.
 */
export function listAccounts() {
  return [BUILT_IN_ADMIN, ...getUsers().filter(isAccount)];
}

/**
 * Count the local dataset using the specified capitalization-sensitive labels.
 * @returns {object} Total posts, all identities, Admins and regular users.
 */
export function getAccountStats() {
  const accounts = listAccounts();
  return {
    'Total Posts': getPosts().length,
    'Total Users': accounts.length,
    'Total Admins': accounts.filter((account) => account.role === 'admin').length,
    'Total users': accounts.filter((account) => account.role === 'user').length,
  };
}

/**
 * Validate all creation fields without coercing non-string values.
 * @param {*} fields Candidate displayName, username, password and role.
 * @returns {object} Field-associated validation errors, or an empty object.
 */
export function validateAccountFields(fields) {
  const errors = {};
  if (typeof fields?.displayName !== 'string' || !fields.displayName.trim()) errors.displayName = 'Display Name is required.';
  if (typeof fields?.username !== 'string' || !fields.username.trim()) errors.username = 'Username is required.';
  if (typeof fields?.password !== 'string' || !fields.password.trim()) errors.password = 'Password is required.';
  if (typeof fields?.role !== 'string' || !fields.role.trim()) errors.role = 'Role is required.';
  else if (!['admin', 'user'].includes(fields.role)) errors.role = 'Choose Admin or user.';
  return errors;
}

/**
 * Revalidate the actual current identity, never a caller-provided session.
 * @returns {object} Canonical Admin session.
 * @throws {Error} If identity is missing, stale, deleted or not an Admin.
 */
function requireAdmin() {
  const session = getSession();
  if (!session || session.role !== 'admin') throw new Error('Admin access is required to manage accounts.');
  return session;
}

/**
 * Create either role with UUID and ISO metadata, preserving the current Admin session.
 * @param {*} fields Required account fields; supplied metadata is ignored.
 * @returns {object} Saved account, only after persistence succeeds.
 * @throws {Error} For denied access, validation, duplicate username, UUID or storage failures.
 * Notes: Passwords are intentionally plaintext demo values. Never use real passwords.
 */
export function createAccount(fields) {
  requireAdmin();
  const errors = validateAccountFields(fields);
  if (Object.keys(errors).length) throw new Error(Object.values(errors).join(' '));
  const username = fields.username.trim();
  const users = getUsers();
  if (username === 'admin' || users.some((account) => account?.username === username)) {
    throw new Error('Username is already taken.');
  }
  const account = {
    id: crypto.randomUUID(),
    displayName: fields.displayName.trim(),
    username,
    password: fields.password,
    role: fields.role,
    createdAt: new Date().toISOString(),
  };
  saveUsers([...users, account]);
  return account;
}

/**
 * Explain protected deletion controls for the built-in and active Admin identities.
 * @param {*} account Listed identity.
 * @param {*} session Current display session; service authorization is checked separately.
 * @returns {string} Disabled-control tooltip, or an empty string for a deletable account.
 */
export function accountDeletionReason(account, session) {
  if (account?.id === BUILT_IN_ADMIN.id) return 'Default admin cannot be deleted.';
  if (account?.id && account.id === session?.userId) return 'You cannot delete your own account.';
  return '';
}

/**
 * Delete a freshly queried account only after canonical Admin and protected-identity checks.
 * @param {*} id Exact persisted account ID; callers own confirmation.
 * @returns {object} Removed account, only after successful persistence.
 * @throws {Error} For denied access, protected identity, missing record or failed writes.
 * Notes: Preserve all posts and saved author names. getSession rejects deleted identities on its next read.
 */
export function deleteAccount(id) {
  const session = requireAdmin();
  const reason = accountDeletionReason({ id }, session);
  if (reason) throw new Error(reason);
  const users = getUsers();
  const account = typeof id === 'string' && id.trim()
    ? users.find((record) => isAccount(record) && record.id === id) : null;
  if (!account) throw new Error('Account not found.');
  saveUsers(users.filter((record) => record !== account));
  return account;
}
