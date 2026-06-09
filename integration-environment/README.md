# Integration Environment

This Salesforce DX project deploys the metadata required to run the integration tests of the Pub/Sub API Node.js client library.

## Metadata Components

### Platform Event: `Sample__e`

A platform event used by integration tests to verify event publishing and subscription via the Pub/Sub API.

| Field        | Type                | Description   |
| ------------ | ------------------- | ------------- |
| `Message__c` | Text(255), required | Event payload |

### External Client Apps

Two external client apps configure the OAuth 2.0 flows supported by the library:

| App                                   | Auth Flow                    | Callback URL                          |
| ------------------------------------- | ---------------------------- | ------------------------------------- |
| `PubSub_API_Client_Credentials_Tests` | OAuth 2.0 Client Credentials | `http://localhost:3000/`              |
| `PubSub_API_JWT_test`                 | OAuth 2.0 JWT Bearer         | `http://localhost:1717/OauthRedirect` |

Both apps:

- Require PKCE
- Grant the `api` and `refresh_token` OAuth scopes
- Use the `PubSub_Integration_Tests` permission set
- Allow `AdminApprovedPreAuthorized` users only

The **Client Credentials** app additionally requires specifying a dedicated flow user (`pubsub@integration.org`).

The **JWT Bearer** app uses an X.509 certificate for token signing.

### Permission Set: `PubSub_Integration_Tests`

Grants:

- **`Sample__e`** — create (publish events)
- **`Account`** — full CRUD (used for test data)
- **User permissions** — `ApiEnabled`, `ViewDeveloperName`, `ViewRoles`, `ViewSetup`

## Setup

## Test User

Tests run with an integration user (`pubsub@integration.org`) with the `PubSub_Integration_Tests` permission set.

## Configuration

Create a `.env` file at the root of the repository using the following template:

```properties
# Salesforce connection host
SALESFORCE_LOGIN_URL=

# Username/Password auth
SALESFORCE_USERNAME=
SALESFORCE_PASSWORD=

# OAuth2 Client Credentials auth
SALESFORCE_CLIENT_ID=
SALESFORCE_CLIENT_SECRET=

# OAuth2 JWT Bearer auth
SALESFORCE_JWT_LOGIN_URL=
SALESFORCE_JWT_CLIENT_ID=
SALESFORCE_PRIVATE_KEY_PATH=keys/server.key
```
