/**
 * Enum for subscribe callback type values
 */
export type SubscribeCallbackType = string;
export namespace SubscribeCallbackType {
    let EVENT: string;
    let LAST_EVENT: string;
    let ERROR: string;
    let END: string;
    let GRPC_STATUS: string;
    let GRPC_KEEP_ALIVE: string;
}
/**
 * Enum for publish callback type values
 */
export type PublishCallbackType = string;
export namespace PublishCallbackType {
    export let PUBLISH_RESPONSE: string;
    let ERROR_1: string;
    export { ERROR_1 as ERROR };
    let GRPC_STATUS_1: string;
    export { GRPC_STATUS_1 as GRPC_STATUS };
    let GRPC_KEEP_ALIVE_1: string;
    export { GRPC_KEEP_ALIVE_1 as GRPC_KEEP_ALIVE };
}
/**
 * Enum for auth type values
 */
export type AuthType = string;
export namespace AuthType {
    let USER_SUPPLIED: string;
    let USERNAME_PASSWORD: string;
    let OAUTH_CLIENT_CREDENTIALS: string;
    let OAUTH_JWT_BEARER: string;
}
/**
 * Enum for managed subscription state values
 */
export type EventSubscriptionAdminState = string;
export namespace EventSubscriptionAdminState {
    let RUN: string;
    let STOP: string;
}
export type PublishResult = {
    replayId: number;
    correlationKey: string;
};
export type Schema = {
    id: string;
    /**
     * Avro schema type
     */
    type: any;
};
export type SubscribeCallback = (subscription: SubscriptionInfo, callbackType: SubscribeCallbackType, data?: any) => void;
export type Subscription = {
    info: SubscriptionInfo;
    grpcSubscription: any;
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
export type PublishCallback = (info: PublishStreamInfo, callbackType: PublishCallbackType, data?: any) => void;
export type PublishStream = {
    info: PublishStreamInfo;
    grpcPublishStream: any;
    publishCallback: PublishCallback;
};
export type PublishStreamInfo = {
    topicName: string;
    lastReplayId: number;
};
export type ProducerEvent = {
    id: string;
    payload: any;
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
//# sourceMappingURL=types.d.ts.map