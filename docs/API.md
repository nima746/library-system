# FOLIO API v2

All API responses are JSON and use `Cache-Control: no-store`. Errors have the shape `{ "error": { "code": "conflict" } }`. UI translations use the stable error code.

## Authentication and ownership

Production runs behind the Sites gateway. The gateway authenticates ChatGPT sessions and supplies the trusted `oai-authenticated-user-id` header. Every data query and mutation is scoped to that identity. A signed-in account is the administrator of its own library; this version does **not** implement shared libraries, staff invitations or reader login accounts.

The production Worker must not be exposed through a separate public origin that accepts client-supplied identity headers. Do not add a public `workers.dev` route without replacing this trust boundary with verified authentication.

Browser sign-in and sign-out use top-level navigation to `/signin-with-chatgpt?return_to=%2F` and `/signout-with-chatgpt?return_to=%2F`; these routes belong to Sites, not this Worker. Production has no password database or default password. The local development server binds only to `127.0.0.1` and injects a local developer identity after removing inbound identity headers. This local convenience is never included in the production Worker.

All mutation requests require `Content-Type: application/json` and an `Origin` equal to the request URL origin. No cross-origin API access is enabled. SQL values use bound parameters; resource table names are selected from fixed allowlists.

## Routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness and schema availability; no user data |
| GET | `/api/session` | Current account ID, email and owner role |
| GET | `/api/state` | Account's books, patrons and historical loans |
| GET | `/api/audit` | Latest 100 database-generated audit events |
| GET | `/api/export` | JSON backup with schema version and export timestamp |
| POST | `/api/books` | Create a physical book copy |
| PUT | `/api/books/:id` | Edit an active book, requiring its current `version` |
| POST | `/api/books/:id/archive` | Soft archive; body `{ "version": 1 }` |
| POST | `/api/books/:id/restore` | Restore archived copy; requires current version |
| POST | `/api/readers` | Create patron |
| PUT | `/api/readers/:id` | Edit active patron; requires current version |
| POST | `/api/readers/:id/archive` | Archive patron without active loans |
| POST | `/api/readers/:id/restore` | Restore patron |
| POST | `/api/loans` | Check out; body `{ "book": "id", "reader": "id", "due": "YYYY-MM-DD" }` |
| POST | `/api/loans/:id/return` | Return an active loan; requires current version |
| POST | `/api/loans/:id/renew` | Extend eligible loan by 14 days; requires version |
| POST | `/api/import` | Atomic import into an empty, never-imported account |

Book fields: `title`, `author`, `category`, `isbn`, `shelf`, optional `color` (six-digit hex). Each physical copy needs a unique item number (`isbn` field) within the account, including archived copies. Category storage values remain the six original Traditional Chinese strings; their display labels are translated in the UI.

Patron fields: `name`, `card`, optional `email`. Card numbers are unique within an account, including archived patrons. Text fields have a maximum of 160 characters.

## Consistency rules

- Only unarchived books and patrons can start new loans.
- A partial SQL unique index allows one active loan per book and account, even for concurrent requests.
- New loan due dates range from today to 60 days ahead; the UI defaults to 14 days.
- One renewal adds 14 days; returned or overdue loans cannot be renewed.
- The business day uses `Asia/Taipei`, consistently in frontend and server.
- Updates, archive/restore, returns and renewals require an optimistic `version`. Conflicting or stale requests return 409 and never overwrite a newer record.
- Archiving preserves records and history. Active loans prevent archiving either related book or patron. Restore is reversible.
- SQL triggers record successful writes in the audit table; failed operations do not produce audit entries.

## Import

Use `{ "books": [], "readers": [], "loans": [] }` from the legacy browser version or a v2 JSON export. A nonempty import is limited to 2 MB and 2,000 total records. IDs, uniqueness, dates, emails, categories and all loan references are validated. At most one active loan per imported book is permitted. Import uses one transactional D1 batch and JSON table insertion; any constraint failure rolls back all imported rows and audit events.

Import never merges into or replaces an existing library. Archived records still count as existing data. The original browser backup is not removed. Backups are plaintext and can contain patron contact information; keep them private.

## Errors

401: `signInRequired`. 403: `forbidden`. 409: `conflict`, `importNotEmpty`. 413: `tooLarge`. 415/422/400: `invalidData`, `invalidDate`, `invalidEmail`. 404: `notFound`. 503: `unavailable`.

`conflict` deliberately does not reveal whether an inaccessible record belongs to another account. A network error can occur after a server commit; refresh before retrying to inspect the actual saved state.

## Current scale

The UI retrieves an account snapshot and paginates the catalog locally. It suits small libraries; large installations should add server-side search, cursor pagination, retention policies and operational monitoring. Email delivery, fines/payments, MARC metadata, barcode hardware integration and scheduled backups are not included.
