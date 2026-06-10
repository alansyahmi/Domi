# WorkOS Setup for Domi

The app already has the WorkOS login flow wired up through Netlify Functions:

- `/login` starts the AuthKit sign-in flow
- `/callback` completes the login and creates the sealed session cookie
- `/logout` clears the session and sends the user through WorkOS sign-out

## 1. Create the WorkOS app

In the WorkOS dashboard:

1. Create or open the app for Domi.
2. Enable AuthKit.
3. Add the production callback URL:
   - `https://YOUR-SITE.netlify.app/callback`
4. Add the sign-out return URL:
   - `https://YOUR-SITE.netlify.app/login`

If you also use a custom domain, add the matching callback and sign-out URLs for that domain too.

## 2. Set the Netlify environment variables

Add these variables in Netlify Site Settings > Environment Variables:

- `WORKOS_API_KEY`
- `WORKOS_CLIENT_ID`
- `WORKOS_REDIRECT_URI`
- `WORKOS_SIGN_OUT_REDIRECT_URI`
- `WORKOS_COOKIE_PASSWORD`
- `CSRF_SECRET`
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

Recommended values:

- `WORKOS_REDIRECT_URI` should be the absolute callback URL, for example:
  - `https://YOUR-SITE.netlify.app/callback`
- `WORKOS_SIGN_OUT_REDIRECT_URI` should be the post-logout landing page, for example:
  - `https://YOUR-SITE.netlify.app/login`
- `WORKOS_COOKIE_PASSWORD` should be a long random secret at least 32 characters.
- `CSRF_SECRET` should also be a long random secret at least 32 characters.

## 3. Set up local development

Put the same values into your local env file, such as `.env.local` or `.dev.vars`, so the auth flow works outside production.

Example:

```env
WORKOS_API_KEY=...
WORKOS_CLIENT_ID=...
WORKOS_REDIRECT_URI=http://127.0.0.1:58234/callback
WORKOS_SIGN_OUT_REDIRECT_URI=http://127.0.0.1:58234/login
WORKOS_COOKIE_PASSWORD=replace-with-a-long-random-string
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
