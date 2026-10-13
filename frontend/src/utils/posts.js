/** Mutate browser-local plain-text posts; these checks are demo controls, not server security. */
import { getSession } from './auth';
import { getPosts, savePosts } from './storage';
import { canEdit, isPost } from './presentation';

/**
 * Report required fields without coercing non-string input or changing plain text.
 * @param {*} fields Candidate title and content; extra fields are ignored.
 * @returns {object} Field-keyed errors, empty when both strings contain non-whitespace text.
 */
export function validatePostFields(fields) {
  const errors = {};
  if (typeof fields?.title !== 'string' || !fields.title.trim()) errors.title = 'Title is required.';
  if (typeof fields?.content !== 'string' || !fields.content.trim()) errors.content = 'Content is required.';
  return errors;
}

/**
 * Reject invalid form values at the persistence boundary.
 * @param {*} fields Candidate title/content.
 * @returns {void}
 * @throws {Error} If either required string is absent or blank.
 */
function requireFields(fields) {
  const errors = validatePostFields(fields);
  if (Object.keys(errors).length) throw new Error(Object.values(errors).join(' '));
}

/**
 * Resolve the actual current identity, never a caller's cached session.
 * @returns {object} Canonical authenticated session.
 * @throws {Error} When the session is absent, corrupt, stale or unavailable.
 */
function requireSession() {
  const session = getSession();
  if (!session) throw new Error('Please log in again before changing posts.');
  return session;
}

/**
 * Find the persisted post and recheck ownership against the current identity.
 * @param {Array} posts Freshly read local collection.
 * @param {*} id Exact post ID.
 * @param {object} session Canonical current identity.
 * @returns {object} Current stored record, not a stale form copy.
 * @throws {Error} For a missing/invalid record or denied ownership.
 */
function requireOwnedPost(posts, id, session) {
  const post = typeof id === 'string' && id.trim()
    ? posts.find((record) => isPost(record) && record.id === id) : null;
  if (!post) throw new Error('Post not found');
  if (!canEdit(session, post)) throw new Error('You do not have permission to change this post.');
  return post;
}

/**
 * Create and persist an exact-schema post using current session authorship.
 * @param {object} fields Required title and content strings; metadata is ignored.
 * @returns {object} Saved post with a new crypto UUID and ISO creation timestamp.
 * @throws {Error} For invalid input, invalid session, UUID failure or failed storage writes.
 * Notes: No session argument is accepted or trusted. Text is stored verbatim and rendered as text.
 */
export function createPost(fields) {
  const session = requireSession();
  requireFields(fields);
  const posts = getPosts();
  const post = {
    id: crypto.randomUUID(),
    title: fields.title,
    content: fields.content,
    createdAt: new Date().toISOString(),
    authorId: session.userId,
    authorName: session.displayName,
  };
  savePosts([...posts, post]);
  return post;
}

/**
 * Update only text, requerying the record to preserve its current ownership and creation metadata.
 * @param {string} id Persisted post ID.
 * @param {object} fields Required title and content strings; metadata is ignored.
 * @returns {object} Saved exact-schema post with original ID, createdAt, authorId and authorName.
 * @throws {Error} For invalid session/input, missing record, denied ownership or write failure.
 */
export function updatePost(id, fields) {
  const session = requireSession();
  requireFields(fields);
  const posts = getPosts();
  const original = requireOwnedPost(posts, id, session);
  const post = {
    id: original.id,
    title: fields.title,
    content: fields.content,
    createdAt: original.createdAt,
    authorId: original.authorId,
    authorName: original.authorName,
  };
  savePosts(posts.map((record) => record === original ? post : record));
  return post;
}

/**
 * Delete a persisted post after rechecking current identity and stored ownership.
 * @param {string} id Exact post ID; the caller owns window.confirm and navigation.
 * @returns {object} Deleted record, only after a successful write.
 * @throws {Error} For invalid session, missing record, denied ownership or write failure.
 * Notes: Shared by the reader and future dashboard. Cancellation must not call this service.
 */
export function deletePost(id) {
  const session = requireSession();
  const posts = getPosts();
  const post = requireOwnedPost(posts, id, session);
  savePosts(posts.filter((record) => record !== post));
  return post;
}
