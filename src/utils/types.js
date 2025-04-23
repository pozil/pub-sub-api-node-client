/**
 * Enum for subscribe callback type values
 * @enum {string}
 */
export const SubscribeCallbackType = {
    EVENT: 'event',
    LAST_EVENT: 'lastEvent',
    ERROR: 'error',
    END: 'end',
    GRPC_STATUS: 'grpcStatus',
    GRPC_KEEP_ALIVE: 'grpcKeepAlive'
};

/**
 * Enum for publish callback type values
 * @enum {string}
 */
export const PublishCallbackType = {
    PUBLISH_RESPONSE: 'publishResponse',
    ERROR: 'error',
    GRPC_STATUS: 'grpcStatus',
    GRPC_KEEP_ALIVE: 'grpcKeepAlive'
};

/**
 * Enum for auth type values
 * @enum {string}
 */
export const AuthType = {
    USER_SUPPLIED: 'user-supplied',
    USERNAME_PASSWORD: 'username-password',
    OAUTH_CLIENT_CREDENTIALS: 'oauth-client-credentials',
    OAUTH_JWT_BEARER: 'oauth-jwt-bearer'
};

/**
 * Enum for managed subscription state values
 * @enum {string}
 */
export const EventSubscriptionAdminState = {
    RUN: 'RUN',
    STOP: 'STOP'
};

/**
 * @typedef {Object} PublishResult
 * @property {number} replayId
 * @property {string} correlationKey
 */

/**
 * @typedef {Object} Schema
 * @property {string} id
 * @property {Object} type Avro schema type
 */

/**
 * @callback SubscribeCallback
 * @param {SubscriptionInfo} subscription
 * @param {SubscribeCallbackType} callbackType
 * @param {Object} [data]
 * @returns {void}
 */

/**
 * @typedef {Object} Subscription
 * @property {SubscriptionInfo} info
 * @property {Object} grpcSubscription
 * @property {SubscribeCallback} subscribeCallback
 */

/**
 * @typedef {Object} SubscriptionInfo
 * @property {boolean} isManaged
 * @property {string} topicName
 * @property {string} subscriptionId
 * @property {string} subscriptionName
 * @property {number} requestedEventCount
 * @property {number} receivedEventCount
 * @property {number} lastReplayId
 * @property {boolean} isInfiniteEventRequest
 */

/**
 * @callback PublishCallback
 * @param {PublishStreamInfo} info
 * @param {PublishCallbackType} callbackType
 * @param {Object} [data]
 * @returns {void}
 */

/**
 * @typedef {Object} PublishStream
 * @property {PublishStreamInfo} info
 * @property {Object} grpcPublishStream
 * @property {PublishCallback} publishCallback
 */

/**
 * @typedef {Object} PublishStreamInfo
 * @property {string} topicName
 * @property {number} lastReplayId
 */

/**
 * @typedef {Object} ProducerEvent
 * @property {string} id
 * @property {Object} payload
 */

/**
 * @typedef {Object} Configuration
 * @property {AuthType} authType Authentication type. One of `user-supplied`, `username-password`, `oauth-client-credentials` or `oauth-jwt-bearer`.
 * @property {string} [pubSubEndpoint] A custom Pub/Sub API endpoint. The default endpoint `api.pubsub.salesforce.com:7443` is used if none is supplied.
 * @property {string} [loginUrl] Salesforce login host. One of `https://login.salesforce.com`, `https://test.salesforce.com` or your domain specific host.
 * @property {string} [username] Salesforce username.
 * @property {string} [password] Salesforce user password.
 * @property {string} [userToken] Salesforce user security token.
 * @property {string} [clientId] Connected app client ID.
 * @property {string} [clientSecret] Connected app client secret.
 * @property {string} [privateKey] Private key content.
 * @property {string} [accessToken] Salesforce access token.
 * @property {string} [instanceUrl] Salesforce instance URL.
 * @property {string} [organizationId] Optional organization ID. If you don't provide one, we'll attempt to parse it from the accessToken.
 * @property {boolean} [rejectUnauthorizedSsl] Optional flag used to accept self-signed SSL certificates for testing purposes when set to `false`. Default is `true` (client rejects self-signed SSL certificates).
 */

/**
 * @typedef {Object} Logger
 * @property {Function} debug
 * @property {Function} info
 * @property {Function} error
 * @property {Function} warn
 */

/**
 * @typedef {Object} SubscribeRequest
 * @property {string} topicName
 * @property {number} numRequested
 * @property {string} [subscriptionId]
 * @property {number} [replayPreset]
 * @property {number} [replayId]
 */
