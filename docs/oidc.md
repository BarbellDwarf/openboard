# OIDC sign-in (Authentik and Authelia)

OpenBoard accepts any discovery-based OIDC provider. Configuration is entirely environment variables; nothing is hard-coded.

## Authentik

1. Create a Provider of type "OAuth2/OpenID Connect" with:
   - Client type: Confidential
   - Redirect URL: `https://YOUR-OPENBOARD-HOST/api/auth/callback/oidc`
   - Scopes: `openid email profile`
2. Note the client ID and secret.
3. Set environment variables:

```
OIDC_ISSUER_URL=https://authentik.example.com/application/o/openboard/
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_PROVIDER_NAME=authentik
```

The issuer URL is the slug URL of the provider application; OpenBoard appends the well-known discovery path itself.

## Authelia

1. In configuration.yml, add an OAuth client under `identity_providers.oidc`:

```yaml
clients:
  - id: openboard
    description: OpenBoard
    secret: '$plaintext$your-client-secret'
    redirect_uris:
      - https://YOUR-OPENBOARD-HOST/api/auth/callback/oidc
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

Restart the app container after changing these values. An existing local account with the same verified email signs into the OIDC identity automatically rather than creating a duplicate.
