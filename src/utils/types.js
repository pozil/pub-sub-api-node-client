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
 * @typedef {Object} UserSuppliedAuthConfiguration
 * @property {'user-supplied'} authType
 * @property {string} accessToken
 * @property {string} instanceUrl
 * @property {string} organizationId
 */

/**
 * @typedef {Object} UsernamePasswordAuthConfiguration
 * @property {'username-password'} authType
 * @property {string} loginUrl
 * @property {string} username
 * @property {string} password
 * @property {string} userToken
 */

/**
 * @typedef {Object} OAuthClientCredentialsAuthConfiguration
 * @property {'oauth-client-credentials'} authType
 * @property {string} loginUrl
 * @property {string} clientId
 * @property {string} clientSecret
 */

/**
 * @typedef {Object} OAuthJwtBearerAuthConfiguration
 * @property {'oauth-jwt-bearer'} authType
 * @property {string} loginUrl
 * @property {string} clientId
 * @property {string} username
 * @property {string} privateKey
 */

/**
 * @typedef {Object} PubSubEndpoint
 * @property {string} [pubSubEndpoint]
 */

/**
 * @typedef Configuration
 * @type {PubSubEndpoint & (UserSuppliedAuthConfiguration | UsernamePasswordAuthConfiguration | OAuthClientCredentialsAuthConfiguration | OAuthJwtBearerAuthConfiguration)}
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
