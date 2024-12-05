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
export type SubscribeCallback = (subscription: SubscriptionInfo, callbackType: SubscribeCallbackType, data?: any) => any;
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
export type Configuration = {
    authType: AuthType;
    pubSubEndpoint: string;
    loginUrl: string;
    username: string;
    password: string;
    userToken: string;
    clientId: string;
    clientSecret: string;
    privateKey: string;
    accessToken: string;
    instanceUrl: string;
    organizationId: string;
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