# OIDC sign-in (Authentik and Authelia)

OpenBoard accepts any discovery-based OIDC provider. Configuration is entirely environment variables; nothing is hard-coded and nothing is set at build time.

## How the callback URL is built

Sign-in goes through better-auth's generic OAuth plugin (better-auth 1.7). Generic providers register under the standard social sign-in endpoints, so the provider callback URL always follows this shape:

```
https://YOUR-OPENBOARD-HOST/api/auth/callback/<providerId>
```

`<providerId>` is the value of `OIDC_PROVIDER_NAME`, or `oidc` when that variable is empty or unset. Register exactly this URL with your identity provider. The app derives the same URL on its side from `ORIGIN`, so no redirect URI needs to be configured inside OpenBoard.

## Authentik

1. Create a Provider of type "OAuth2/OpenID Connect" with:
   - Client type: Confidential
   - Redirect URL: `https://YOUR-OPENBOARD-HOST/api/auth/callback/authentik`
   - Scopes: `openid email profile`
2. Note the client ID and secret.
3. Set environment variables:

```
OIDC_ISSUER_URL=https://authentik.example.com/application/o/openboard/
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_PROVIDER_NAME=authentik
```

The issuer URL is the slug URL of the provider application; OpenBoard appends the well-known discovery path itself. Because `OIDC_PROVIDER_NAME` is set to `authentik` here, the callback path ends in `/authentik`. Keep the redirect URL in your provider and this variable in agreement at all times.

## Authelia

1. In configuration.yml, add an OAuth client under `identity_providers.oidc`:

```yaml
clients:
  - id: openboard
    description: OpenBoard
    secret: '$plaintext$your-client-secret'
    redirect_uris:
      - https://YOUR-OPENBOARD-HOST/api/auth/callback/authelia
    scopes: [openid, email, profile]
    token_endpoint_auth_method: client_secret_basic
    pkce: true
```

2. Set:

```
OIDC_ISSUER_URL=https://auth.example.com
OIDC_CLIENT_ID=openboard
OIDC_CLIENT_SECRET=your-client-secret
OIDC_PROVIDER_NAME=authelia
```

## Sign-in button

The login page receives both the button label and the provider identifier passed to `signIn.social({ provider })` from the server load, which reads them from `OIDC_PROVIDER_NAME`. There are no `VITE_` variables involved, so renaming a provider takes one environment change and a container restart. No frontend rebuild is required.

Restart the app container after changing these values. An existing local account with the same verified email signs into the OIDC identity automatically rather than creating a duplicate.
