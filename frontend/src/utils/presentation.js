/** Present untrusted local records without mutating or interpreting their plain text. */
import { BUILT_IN_ADMIN } from './auth';

/**
 * Recognize records safe to render as posts.
 * @param {*} post Possible local record.
 * @returns {boolean} Whether all displayed fields have safe primitive values.
 */
export function isPost(post) {
  return Boolean(post && typeof post === 'object' && !Array.isArray(post) &&
    ['id', 'title', 'authorId', 'authorName'].every((key) => typeof post[key] === 'string' && post[key].trim()) &&
    typeof post.content === 'string' && typeof post.createdAt === 'string');
}

/**
 * Copy valid posts into newest-first order, keeping undated records last and ties stable.
 * @param {*} posts Possible local collection.
 * @returns {Array} Safe, ordered records; the original collection is unchanged.
 */
export function newestPosts(posts) {
  if (!Array.isArray(posts)) return [];
  return posts.filter(isPost).sort((left, right) => {
    const a = Date.parse(left.createdAt);
    const b = Date.parse(right.createdAt);
    if (!Number.isFinite(a)) return Number.isFinite(b) ? 1 : 0;
    if (!Number.isFinite(b)) return -1;
    return b - a;
  });
}

/**
 * Format a creation date consistently across time zones.
 * @param {*} value Stored timestamp.
 * @returns {string} English UTC date or an explicit unknown-date label.
 */
export function formatDate(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(value));
}

/**
 * Return exactly the first 120 characters, without HTML interpretation or added ellipses.
 * @param {*} content Stored plain text.
 * @returns {string} Safe excerpt.
 */
export function excerpt(content) {
  return typeof content === 'string' ? content.slice(0, 120) : '';
}

/**
 * Resolve authorship from an existing account, falling back to the writer role after deletion.
 * @param {*} authorId Saved author identity.
 * @param {*} users Local account collection.
 * @returns {string} Admin or user avatar role.
 */
export function authorRole(authorId, users) {
  if (authorId === BUILT_IN_ADMIN.id) return BUILT_IN_ADMIN.role;
  const account = Array.isArray(users) ? users.find((user) => user && user.id === authorId &&
    typeof user.id === 'string' && user.id.trim() &&
    typeof user.username === 'string' && user.username.trim() && user.username !== 'admin' &&
    typeof user.displayName === 'string' && user.displayName.trim() &&
    typeof user.password === 'string' && user.password.length &&
    typeof user.createdAt === 'string' && Number.isFinite(Date.parse(user.createdAt)) &&
    ['admin', 'user'].includes(user.role)) : null;
  return account?.role || 'user';
}

/**
 * Offer edit navigation only to an administrator or the current post owner.
 * @param {*} session Canonical session, or null.
 * @param {*} post Possible post.
 * @returns {boolean} Whether edit navigation is permitted.
 */
export function canEdit(session, post) {
  return Boolean(isPost(post) && session && typeof session.userId === 'string' && session.userId.trim() &&
    (session.role === 'admin' || (session.role === 'user' && session.userId === post.authorId)));
}

/**
 * Cycle explicit Tailwind accents by rendered index.
 * @param {number} index Position in the sorted list.
 * @returns {string} One of four static border utilities.
 */
export function cardAccent(index) {
  const accents = ['border-indigo-500', 'border-violet-500', 'border-pink-500', 'border-teal-500'];
  const position = Number.isInteger(index) && index >= 0 ? index : 0;
  return accents[position % accents.length];
}
