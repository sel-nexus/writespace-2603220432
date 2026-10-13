/**
 * Establish browser-local demo identities, not a security boundary.
 * Notes: Passwords are intentionally plaintext. Never use real passwords.
 */
import { getUsers, saveUsers } from './storage';

export const SESSION_KEY = 'writespace_session';
export const BUILT_IN_ADMIN = Object.freeze({
  id: 'admin',
  username: 'admin',
  password: 'admin',
  displayName: 'Admin',
  role: 'admin',
});

/**
 * Recognize complete stored accounts and reject collisions with the fixed admin.
 * @param {object} account Possible account record.
 * @returns {boolean} Whether this is a usable stored identity.
 */
function isAccount(account) {
  return Boolean(
    account &&
      typeof account.id === 'string' && account.id.trim() && account.id !== 'admin' &&
      typeof account.username === 'string' && account.username.trim() && account.username !== 'admin' &&
      typeof account.displayName === 'string' && account.displayName.trim() &&
      typeof account.password === 'string' && account.password.length &&
      ['admin', 'user'].includes(account.role) &&
      typeof account.createdAt === 'string' && Number.isFinite(Date.parse(account.createdAt)),
  );
}

/**
 * Project an account onto the exact password-free session schema.
 * @param {object} account Canonical account record.
 * @returns {object} Session object.
 */
function toSession(account) {
  return {
    userId: account.id,
    username: account.username,
    displayName: account.displayName,
    role: account.role,
  };
}

/**
 * Resolve a session against current accounts, failing closed on deletion or drift.
 * @param {object} candidate Possible session.
 * @returns {object|null} Canonical session, or null.
 */
function resolveSession(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  const account = candidate.userId === 'admin'
    ? BUILT_IN_ADMIN
    : getUsers().find((user) => isAccount(user) && user.id === candidate.userId);
  if (!account) return null;
  const canonical = toSession(account);
  return Object.keys(canonical).every((key) => candidate[key] === canonical[key]) ? canonical : null;
}

/**
 * Read and revalidate the session without raising storage errors.
 * @returns {object|null} Exact valid session, or null for missing/corrupt storage.
 */
export function getSession() {
  try {
    return resolveSession(JSON.parse(localStorage.getItem(SESSION_KEY)));
  } catch {
    return null;
  }
}

/**
 * Persist only a valid, canonical identity; never store passwords in the session.
 * @param {object} obj Session with userId, username, displayName and role.
 * @returns {object} Persisted canonical session.
 * @throws {Error} If identity is invalid or persistence fails.
 */
export function setSession(obj) {
  const session = resolveSession(obj);
  if (!session) throw new Error('This account is no longer available. Please log in again.');
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    throw new Error('Unable to save your session in this browser. Please try again.');
  }
  return session;
}

/**
 * Remove only the session, preserving accounts and posts.
 * @returns {void}
 * @throws {Error} If storage cannot remove the session.
 */
export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    throw new Error('Unable to clear your session in this browser. Please try again.');
  }
}

/**
 * Authenticate the built-in admin first, then valid case-sensitive local accounts.
 * @param {string} username Username, trimmed before comparison.
 * @param {string} password Exact plaintext demo password.
 * @returns {object} Persisted session.
 * @throws {Error} If credentials are invalid or session saving fails.
 */
export function login(username, password) {
  const name = typeof username === 'string' ? username.trim() : '';
  const account = name === 'admin' && password === 'admin'
    ? BUILT_IN_ADMIN
    : getUsers().find((user) => isAccount(user) && user.username === name && user.password === password);
  if (!account || typeof password !== 'string') throw new Error('Invalid username or password.');
  return setSession(toSession(account));
}

/**
 * Register only a writer and establish its session after saving the account.
 * Notes: A failed session write leaves the saved account available for login;
 * no rollback is claimed because localStorage has no multi-key transaction.
 * @param {object} fields Display name, username, password and confirmPassword.
 * @returns {object} Persisted session.
 * @throws {Error} For validation, account-save or session-save failures.
 */
export function register(fields = {}) {
  const { displayName, username, password, confirmPassword } = fields || {};
  const name = typeof displayName === 'string' ? displayName.trim() : '';
  const loginName = typeof username === 'string' ? username.trim() : '';
  if (!name || !loginName || typeof password !== 'string' || !password ||
      typeof confirmPassword !== 'string' || !confirmPassword) {
    throw new Error('All fields are required.');
  }
  if (password !== confirmPassword) throw new Error('Passwords must match.');
  const users = getUsers();
  if (loginName === 'admin' || users.some((user) => user?.username === loginName)) {
    throw new Error('Username is already taken.');
  }
  const account = {
    id: crypto.randomUUID(),
    displayName: name,
    username: loginName,
    password,
    role: 'user',
    createdAt: new Date().toISOString(),
  };
  saveUsers([...users, account]);
  try {
    return setSession(toSession(account));
  } catch {
    throw new Error('Your account was saved, but your session could not be saved. Please log in to continue.');
  }
}
