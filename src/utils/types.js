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
 * @global
 */

/**
 * @callback SubscribeCallback
 * @param {SubscriptionInfo} subscription
 * @param {SubscribeCallbackType} callbackType
 * @param {Object} [data]
 * @global
 */

/**
 * @typedef {Object} Subscription
 * @property {SubscriptionInfo} info
 * @property {Object} grpcSubscription
 * @property {SubscribeCallback} subscribeCallback
 * @protected
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
 * @protected
 */

/**
 * @typedef {Object} Configuration
 * @property {AuthType} authType
 * @property {string} pubSubEndpoint
 * @property {string} loginUrl
 * @property {string} username
 * @property {string} password
 * @property {string} userToken
 * @property {string} clientId
 * @property {string} clientSecret
 * @property {string} privateKey
 * @property {string} accessToken
 * @property {string} instanceUrl
 * @property {string} organizationId
 * @protected
 */

/**
 * @typedef {Object} Logger
 * @property {Function} debug
 * @property {Function} info
 * @property {Function} error
 * @property {Function} warn
 * @protected
 */

/**
 * @typedef {Object} SubscribeRequest
 * @property {string} topicName
 * @property {number} numRequested
 * @property {string} [subscriptionId]
 * @property {number} [replayPreset]
 * @property {number} [replayId]
 * @protected
 */
