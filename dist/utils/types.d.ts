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
export type UserSuppliedAuthConfiguration = {
    authType: "user-supplied";
    accessToken: string;
    instanceUrl: string;
    organizationId: string;
};
export type UsernamePasswordAuthConfiguration = {
    authType: "username-password";
    loginUrl: string;
    username: string;
    password: string;
    userToken: string;
};
export type OAuthClientCredentialsAuthConfiguration = {
    authType: "oauth-client-credentials";
    loginUrl: string;
    clientId: string;
    clientSecret: string;
};
export type OAuthJwtBearerAuthConfiguration = {
    authType: "oauth-jwt-bearer";
    loginUrl: string;
    clientId: string;
    username: string;
    privateKey: string;
};
export type PubSubEndpoint = {
    pubSubEndpoint?: string;
};
export type Configuration = PubSubEndpoint & (UserSuppliedAuthConfiguration | UsernamePasswordAuthConfiguration | OAuthClientCredentialsAuthConfiguration | OAuthJwtBearerAuthConfiguration);
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