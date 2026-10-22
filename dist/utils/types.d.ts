/**
 * Enum for subscribe callback type values
 * @enum {string}
 */
export declare const SubscribeCallbackType: {
    EVENT: string;
    LAST_EVENT: string;
    ERROR: string;
    END: string;
    GRPC_STATUS: string;
    GRPC_KEEP_ALIVE: string;
};
/**
 * Enum for publish callback type values
 * @enum {string}
 */
export declare const PublishCallbackType: {
    PUBLISH_RESPONSE: string;
    ERROR: string;
    END: string;
    GRPC_STATUS: string;
    GRPC_KEEP_ALIVE: string;
};
/**
 * Enum for auth type values
 * @enum {string}
 */
export declare const AuthType: {
    USER_SUPPLIED: string;
    USERNAME_PASSWORD: string;
    OAUTH_CLIENT_CREDENTIALS: string;
    OAUTH_JWT_BEARER: string;
};
/**
 * Enum for managed subscription state values
 * @enum {string}
 */
export declare const EventSubscriptionAdminState: {
    RUN: string;
    STOP: string;
};
export type PublishResult = {
    replayId: number;
    correlationKey: string;
};
export type Schema = {
    id: string;
    /**
     * Avro schema type
     */
    type: Object;
};
export type SubscribeCallback = (subscription: SubscriptionInfo, callbackType: SubscribeCallbackType, data?: Object) => void;
export type Subscription = {
    info: SubscriptionInfo;
    grpcSubscription: Object;
    subscribeCallback: SubscribeCallback;
};
export type SubscriptionInfo = {
    isManaged: boolean;
    topicName: string;
    subscriptionId: string;
    subscriptionName: string;
    requestedEventCount: number;
    receivedEventCount: number;
    lastReplayId: number;
    isInfiniteEventRequest: boolean;
};
export type PublishCallback = (info: PublishStreamInfo, callbackType: PublishCallbackType, data?: Object) => void;
export type PublishStream = {
    info: PublishStreamInfo;
    grpcPublishStream: Object;
    publishCallback: PublishCallback;
};
export type PublishStreamInfo = {
    topicName: string;
    lastReplayId: number;
};
export type ProducerEvent = {
    id: string;
    payload: Object;
};
export type Configuration = {
    /**
     * Authentication type. One of `user-supplied`, `username-password`, `oauth-client-credentials` or `oauth-jwt-bearer`.
     */
    authType: AuthType;
    /**
     * A custom Pub/Sub API endpoint. The default endpoint `api.pubsub.salesforce.com:7443` is used if none is supplied.
     */
    pubSubEndpoint?: string;
    /**
     * Salesforce login host. One of `https://login.salesforce.com`, `https://test.salesforce.com` or your domain specific host.
     */
    loginUrl?: string;
    /**
     * Salesforce username.
     */
    username?: string;
    /**
     * Salesforce user password.
     */
    password?: string;
    /**
     * Salesforce user security token.
     */
    userToken?: string;
    /**
     * Connected app client ID.
     */
    clientId?: string;
    /**
     * Connected app client secret.
     */
    clientSecret?: string;
    /**
     * Private key content.
     */
    privateKey?: string;
    /**
     * Salesforce access token.
     */
    accessToken?: string;
    /**
     * Salesforce instance URL.
     */
    instanceUrl?: string;
    /**
     * Optional organization ID. If you don't provide one, we'll attempt to parse it from the accessToken.
     */
    organizationId?: string;
    /**
     * Optional flag used to accept self-signed SSL certificates for testing purposes when set to `false`. Default is `true` (client rejects self-signed SSL certificates).
     */
    rejectUnauthorizedSsl?: boolean;
    /**
     * Optional gRPC channel options passed directly to the gRPC client constructor. Use to configure transport-level settings such as keepalive (e.g. `grpc.keepalive_time_ms`, `grpc.keepalive_timeout_ms`, `grpc.keepalive_permit_without_calls`).
     */
    grpcChannelOptions?: Object;
};
export type Logger = {
    debug: Function;
    info: Function;
    error: Function;
    warn: Function;
};
export type SubscribeRequest = {
    topicName: string;
    numRequested: number;
    subscriptionId?: string;
    replayPreset?: number;
    replayId?: number;
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
 * @property {Object} [grpcChannelOptions] Optional gRPC channel options passed directly to the gRPC client constructor. Use to configure transport-level settings such as keepalive (e.g. `grpc.keepalive_time_ms`, `grpc.keepalive_timeout_ms`, `grpc.keepalive_permit_without_calls`).
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
//# sourceMappingURL=types.d.ts.map