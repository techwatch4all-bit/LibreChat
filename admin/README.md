# Satchida Admin Panel

A lightweight, dependency-free admin panel served by the LibreChat API process at
`/admin`. It reuses the existing operator session (the same JWT cookie set when you
log in to the main app), so no separate login is required when you are already
signed in as an operator-capable account.

## Layout

- `login.html` - local admin login form (POSTs to `/api/admin/auth/login/local`).
- `index.html` - authenticated dashboard shell.
- `styles.css` - shared dark stylesheet.
- `app.js` - auth guard + dashboard logic (users / roles / groups / audit tabs).

## Serving

The API server mounts this directory at `/admin` (see `api/server/index.js`, the
"Admin panel" block added before the SPA fallback). No build step is required; edits
to these files are served directly after a plain `pm2 restart librechat`.

## API surface used

- `GET /api/admin/verify` - auth + current admin user.
- `GET /api/admin/users` - user list (the "see the users" view).
- `GET /api/admin/roles`, `/api/admin/groups`, `/api/admin/audit-log` - rendered.
- `POST /api/auth/logout` - sign out.
