# WriteSpace

A browser-local, plain-text writing demo built with React 18, JavaScript JSX, Vite 5, React Router 6 and Tailwind CSS 3. The deployable application is in `frontend/`. There is no backend, network API, database server, encryption or shared publishing service.

## Start locally

Use Node.js 20 and npm. Run these commands from the repository root:

```sh
cd frontend
npm ci
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). Use localhost for local development or HTTPS when hosted; generated IDs require the browser's `crypto.randomUUID()` secure-context API. The scripts invoke Node entry files directly and work without platform-specific executable links.

### Dummy credentials and normal workflow

The immutable built-in account is **username `admin`, password `admin`**, display name Admin. These are public dummy credentials, not secrets. It always exists in source even after account storage is cleared. Self-registration creates only role `user`; Admins can create either Admin or user from Manage Users. Use only dummy passwords: all stored passwords are **plaintext**.

- Guests discover the app at `/`, then log in or register.
- Members browse `/blogs`, read `/blog/:id`, write at `/write`, and edit permitted posts at `/edit/:id`.
- Admin login opens `/admin`: exact local counts, five most recent posts, Write New Post and Manage Users.
- `/users` provides required Display Name, Username, Password and Role fields, a desktop table and mobile cards. Accounts support create/list/delete only; account profile updates are out of scope.
- Admins can edit/delete every post; regular users can edit/delete only their own. Delete opens a browser confirmation. Cancel does not persist changes. Logout clears only the session.

## Data and security boundaries

Data belongs to the **current browser origin and profile**. Separate ports, schemes, hostnames, profiles and devices have separate datasets; nothing synchronizes. Clearing browser site data removes local writing and stored accounts. Storage quota, browser policy and private browsing can prevent persistence. This is not a backup system.

| localStorage key | Contract |
| --- | --- |
| `writespace_posts` | Array of `{ id, title, content, createdAt, authorId, authorName }` |
| `writespace_users` | Array of `{ id, displayName, username, password, role, createdAt }`, excluding built-in Admin |
| `writespace_session` | `{ userId, username, displayName, role }`, without a password |

Client-side route guards and freshly rechecked mutation permissions govern normal UI workflows only. They are **not server security**: anyone with browser access can inspect or alter localStorage, passwords, roles and posts. Public landing previews expose local summaries. Do not enter sensitive information or real passwords; do not use this demo for production authentication or confidential publishing. No secure cross-tab revocation guarantee is made.

## Chosen interpretations

These decisions settle the PRD's open or ambiguous behaviors without adding another story:

- Preserve posts and their exact saved `authorName` when deleting an account. Missing authors use the existing user-avatar fallback; do not add an author-role field.
- Resolve every session against current canonical accounts on reads, route changes and storage events. A deleted account is unauthenticated on the next check. Mutations recheck `getSession()` rather than trusting a passed/cached identity.
- Show persistence failures inline; retain form values/data and avoid success feedback or redirects on failed writes. localStorage has no multi-key transaction. If registration saves an account but cannot save its session, the account remains available for login.
- Trim usernames and display names. Username comparison is case-sensitive; the exact normalized username `admin` is reserved. Passwords are stored verbatim; Admin creation requires non-whitespace password text. No invented strength or length thresholds.
- Built-in Admin has fixed ID `admin`, cannot be deleted and displays date **Built-in**, not a fabricated timestamp. The active Admin also cannot delete their own account.
- **Total Posts** counts the post-array length. **Total Users** counts usable local identities plus built-in Admin. **Total Admins** includes built-in Admin and stored Admins. **Total users** counts regular `user` identities. The capitalization distinction is intentional. Malformed identities are not rendered or counted as usable accounts.
- Post edits change only title/content, preserving ID, creation time and authorship. Missing editor IDs show Post not found. Editor Cancel uses useful in-app history, otherwise `/blogs`.
- Confirmation names the affected entity. Account prompts state that authored posts will remain.
- Preserve the existing white/slate editorial design and required palette. Gradients are bounded focal accents, including the Admin header; no full-page indigo/violet/pink wallpaper. The landing illustration uses built-in CSS-only motion-safe pulse rather than custom keyframes or a theme extension.

## Tests, build and preview

From `frontend/`:

```sh
npm test
node node_modules/vitest/vitest.mjs run src/utils/accounts.test.js src/pages/Admin.test.jsx
node node_modules/@playwright/test/cli.js install chromium
npm run test:e2e
npm run build
npm run preview
```

`npm test` runs Vitest/jsdom unit and component tests. Playwright runs the JavaScript specs in `e2e/` on desktop Chrome and Pixel 7 layouts, starts Vite automatically, and uses shared fixtures that fail on console errors and uncaught page errors. Its configuration defaults to `127.0.0.1:5173`; `PLAYWRIGHT_HOST` and `PLAYWRIGHT_PORT` may be set in your shell. `frontend/.env.example` documents these non-secret test-server values; it is not automatically loaded by the Playwright config. Browser installation may require OS libraries (`install --with-deps chromium` on supported Linux hosts).

The production build writes `frontend/dist/`. Preview normally serves at port 4173. Test direct routes and reloads on the actual deployment as well as in-app navigation; a local passing build is not evidence of a live Vercel deployment.

Story4 worker verification: the permitted Vitest command above passed **99 tests** (57 service, 42 UI). E2E specs were authored but not executed by that worker. Whole-app tests, production build, browser/visual review and release evidence belong to the parent release verification; no passing result for those is claimed here.

## Static deployment

### Vercel

Set the Vercel project's **Root Directory to `frontend`**. Configure the Vite framework/build settings in Vercel or the deployment API: install `npm ci`, build `npm run build`, output `dist`. Both root and frontend `vercel.json` files contain only the SPA rewrite:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Do not add `builds`, `framework`, `buildCommand`, `outputDirectory` or `installCommand` keys to `vercel.json`; they conflict with the prescribed deployment contract. The rewrite serves the entry document for deep links; React then applies the appropriate route guard. Verify `/blogs`, `/blog/:id`, `/write`, `/edit/:id`, `/admin` and `/users` reload without a hosting 404.

### Docker static server

From the repository root, with Docker installed:

```sh
docker build -t writespace-demo frontend
docker run --rm -p 8080:80 writespace-demo
```

Open `http://localhost:8080`. The existing multistage Dockerfile builds with Node 20 and serves static assets through Nginx. `frontend/nginx.conf` provides SPA history fallback. No API or database container is needed; data remains in browser localStorage, not in the image or container. Docker instructions are supplied, not claimed executed by the Story4 worker.

## Dependencies and scope caveat

Pinned dependency versions and the committed lockfile make installation reproducible, not vulnerability-free. The PRD mandates the Vite 5 / Tailwind 3 baseline; older build/test dependencies can have security advisories. Review `npm audit` and upstream advisories before public deployment, especially development-server exposure, and make separately reviewed compatible updates. Do not treat this README or successful tests as a clean audit; no audit was executed by the Story4 worker.

This MVP retains one epic and four stories. It does not include rich text, images, comments, tags, recovery flows, account updates, OAuth, password hashing or cloud persistence.
