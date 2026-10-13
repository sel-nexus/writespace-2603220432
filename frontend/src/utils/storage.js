/** Persist browser-local collections; this demo does not encrypt any data. */
export const POSTS_KEY = 'writespace_posts';
export const USERS_KEY = 'writespace_users';

/**
 * Read an array without throwing when storage is unavailable or corrupt.
 * @param {string} key Collection storage key.
 * @returns {Array} Stored array, or an empty array.
 */
function readArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/**
 * Save a collection without concealing persistence failures.
 * @param {string} key Collection storage key.
 * @param {Array} value Entire replacement collection.
 * @returns {void}
 * @throws {Error} If the input is not an array or storage cannot save it.
 */
function writeArray(key, value) {
  if (!Array.isArray(value)) throw new Error('Expected an array to save.');
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new Error('Unable to save data in this browser. Please try again.');
  }
}

/** @returns {Array} Local posts, or an empty array on read failure. */
export function getPosts() {
  return readArray(POSTS_KEY);
}

/**
 * Replace local posts; callers must perform permission and schema validation.
 * @param {Array} arr Post collection.
 * @returns {void}
 * @throws {Error} If saving fails.
 */
export function savePosts(arr) {
  writeArray(POSTS_KEY, arr);
}

/** @returns {Array} Local accounts, or an empty array on read failure. */
export function getUsers() {
  return readArray(USERS_KEY);
}

/**
 * Replace local accounts; callers must validate roles and uniqueness.
 * @param {Array} arr Account collection, excluding the built-in identity.
 * @returns {void}
 * @throws {Error} If saving fails.
 */
export function saveUsers(arr) {
  writeArray(USERS_KEY, arr);
}
