# WorkOS Setup for re:AI

The app already has the WorkOS login flow wired up through Netlify Functions:

- `/login` starts the AuthKit sign-in flow
- `/callback` completes the login and creates the sealed session cookie
- `/logout` clears the session and sends the user through WorkOS sign-out

## 1. Create the WorkOS app

In the WorkOS dashboard:

1. Create or open the app for re:AI.
2. Enable AuthKit.
3. Add the production callback URL:
   - `https://re-ai.app/callback`
4. Add the sign-out return URL:
   - `https://re-ai.app/login`

If you also use a custom domain, add the matching callback and sign-out URLs for that domain too.

If you want to avoid a mismatch between WorkOS and Netlify, keep the callback URL and sign-out return URL as full absolute URLs, not relative paths.

## 2. Set the Netlify environment variables

Add these variables in Netlify Site Settings > Environment Variables:

- `WORKOS_API_KEY`
- `WORKOS_CLIENT_ID`
- `WORKOS_REDIRECT_URI`
- `WORKOS_SIGN_OUT_REDIRECT_URI`
- `VITE_WORKOS_CLIENT_ID`
- `VITE_WORKOS_REDIRECT_URI`
- `VITE_RE_AI_AUTH_MODE`
- `WORKOS_COOKIE_PASSWORD`
- `CSRF_SECRET`
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

Recommended values:

- `WORKOS_REDIRECT_URI` should be the absolute callback URL, for example:
  - `https://re-ai.app/callback`
- `WORKOS_SIGN_OUT_REDIRECT_URI` should be the post-logout landing page, for example:
  - `https://re-ai.app/login`
- `VITE_WORKOS_CLIENT_ID` should match `WORKOS_CLIENT_ID` so the browser AuthKit provider and the server-side functions stay in sync.
- `VITE_WORKOS_REDIRECT_URI` should be the browser SDK redirect URL. AuthKit will process the callback there, then re:AI returns users to `/dashboard` via `state.returnTo`:
  - local: `http://127.0.0.1:58234`
  - production: `https://re-ai.app`
- `VITE_RE_AI_AUTH_MODE` can be `demo` or `workos`. Local dev defaults to `demo`; production forces `workos`.
- `WORKOS_COOKIE_PASSWORD` should be a long random secret at least 32 characters.
- `CSRF_SECRET` should also be a long random secret at least 32 characters.

## 3. Set up local development

The server-side Netlify function code now reads from `.env` and `.env.local` directly if the Netlify runtime does not inject those values. That makes local auth usable without extra CLI setup.

Put the same values into your local env file, such as `.env.local`, so the auth flow works outside production.

Example:

```env
WORKOS_API_KEY=...
WORKOS_CLIENT_ID=...
WORKOS_CLAIM_TOKEN=...
WORKOS_REDIRECT_URI=http://127.0.0.1:58234/callback
WORKOS_SIGN_OUT_REDIRECT_URI=http://127.0.0.1:58234/login
WORKOS_COOKIE_PASSWORD=replace-with-a-long-random-string
VITE_WORKOS_CLIENT_ID=...
VITE_WORKOS_REDIRECT_URI=http://127.0.0.1:58234
VITE_RE_AI_AUTH_MODE=demo
CSRF_SECRET=replace-with-a-long-random-string
TURSO_DATABASE_URL=...
TURSO_AUTH_TOKEN=...
```

## 4. Verify the flow

1. Visit the deployed site.
2. Click `Sign in with WorkOS`.
3. Confirm the browser returns to `/callback` and then lands back on the requested page.
4. Confirm logout redirects through WorkOS and ends on `/login`.

## Notes

- The app uses sealed WorkOS sessions, so the cookie password must stay secret and consistent across deploys.
- The login route currently falls back to demo mode only when auth is unavailable in local or preview contexts.
- If the local Netlify dev middleware is not reading your shell environment, the fallback env loader in `src/server/runtime-env.ts` reads `.env` and `.env.local` instead.
