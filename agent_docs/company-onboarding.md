# Company Google sign-in and bulk roles

Employees sign in directly with their company Google Workspace account.
The server verifies the Google Workspace identity, its verified email, and its
hosted domain. New members become developers. Existing members retain their roles.

## Activate Google Workspace sign-in

Create a Google OAuth **Web application** client owned by your company. Configure
the Google Auth Platform audience as **Internal** in the company's Workspace
organization. Only the `openid` and `email` scopes are requested.

Add the exact callback URL for each environment used by the client:

- Production: `https://hyperdx.platform.prd.msgsndr.net/api/auth/google/callback`
- Staging: `https://hyperdx.servers.stg.msgsndr.net/api/auth/google/callback`

Set these environment variables on the HyperDX **API/app container**:

| Variable | Value |
| --- | --- |
| `GOOGLE_CLIENT_ID` | The web OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Reference a Kubernetes Secret populated from GSM through External Secrets |
| `GOOGLE_WORKSPACE_DOMAIN` | `gohighlevel.com` |
| `GOOGLE_WORKSPACE_TEAM_ID` | The existing company team's MongoDB ID in this environment; direct sign-in joins this team |
| `GOOGLE_REDIRECT_URI` | The callback URL for this environment, exactly as registered above |
| `FRONTEND_URL` | The public HTTPS HyperDX URL for this environment |

Do not put the OAuth secret in Git, dashboard JSON, or public frontend variables.
The client ID, secret, domain, and callback are required; without them sign-in stays
disabled and existing password login works as before. The callback must reach
the same API/session store used by login. Forward HTTPS correctly through the
ingress so the secure session cookie is sent on the Google callback.

See Google's [web-server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server)
and [Workspace identity requirements](https://developers.google.com/identity/openid-connect/openid-connect).

## Join the company

1. Share the normal HyperDX login URL with employees.
2. They click **Continue with Google** using their company account.
3. On first sign-in, HyperDX creates their account in the configured company team
   with developer access to all logs and restricted shared configuration.
4. Existing accounts keep their team, password, and assigned role.

No invitation or joining token is required. The target team must already exist;
sign-in does not create another team or bootstrap a new admin. Legacy admin
allowlist migration runs before creating a new Google user, so new employees
always start as developers. A missing or invalid team ID fails closed.

Sign-in permits **any verified `@gohighlevel.com` Workspace account**, not just the
19 addresses originally supplied. Personal Google accounts, other Workspace
domains, unverified emails, and suffix lookalikes are rejected. Email matching
is case-insensitive; the Google subject identifies returning users.

Optional joining links remain available in Team settings. Only a hash of the
joining link is stored. Copy it when created; after leaving
the page, use **Replace joining link** if you need a new copy. Replacing or
revoking it blocks subsequent joins using the old link, including an OAuth flow
that has not yet checked the link on its callback. Existing members keep access.
There is no automatic expiry for the shared link. It is separate from the
existing individual invitations, which retain their current behavior.

An existing password account in the configured team can link Google directly
after verification. Its password and role are preserved. A new Google-only
account has no password. No emails are sent by this flow.

Removing a member does not ban their company identity: while they still have a
valid company account, they can join again as a developer.
For employee offboarding, disable the Workspace account and remove the HyperDX
member to invalidate existing HyperDX sessions. Google authentication does not
provide automatic directory provisioning/deprovisioning.

## Change roles in bulk

In **Team settings → Team members**, use **Change roles in bulk** to search and
select emails (up to 500), or **Select all members**, then **Make developer** or
**Make admin**. Confirm the change. The server checks team membership for the
whole selection and changes the roles in one atomic update. It rejects the
whole batch if a target is outside the team or if no admin would remain.

## Verification and deployment

Local integration tests use an isolated MongoDB database and mock only Google's
external responses. They cover domain checks, OAuth state/PKCE, link revocation,
role preservation, returning login, and bulk role authorization/concurrency.
A real Google login must also be tested after configuring the OAuth client and
deploying the image. No live Google OAuth client or production user was created
by this code change.
