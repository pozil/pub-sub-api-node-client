/**
 * Client for the Salesforce Pub/Sub API
 * @alias PubSubApiClient
 * @global
 */
export default class PubSubApiClient {
    /**
     * Builds a new Pub/Sub API client
     * @param {Configuration} config the client configuration
     * @param {Logger} [logger] an optional custom logger. The client uses the console if no value is supplied.
     */
    constructor(config: Configuration, logger?: Logger);
    /**
     * Authenticates with Salesforce then, connects to the Pub/Sub API.
     * @returns {Promise<void>} Promise that resolves once the connection is established
     * @memberof PubSubApiClient.prototype
     */
    connect(): Promise<void>;
    /**
     * Get connectivity state from current channel.
     * @returns {Promise<connectivityState>} Promise that holds channel's connectivity information {@link connectivityState}
     * @memberof PubSubApiClient.prototype
     */
    getConnectivityState(): Promise<connectivityState>;
    /**
     * Subscribes to a topic and retrieves all past events in retention window.
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {SubscribeCallback} subscribeCallback callback function for handling subscription events
     * @param {number | null} [numRequested] optional number of events requested. If not supplied or null, the client keeps the subscription alive forever.
     * @memberof PubSubApiClient.prototype
     */
    subscribeFromEarliestEvent(topicName: string, subscribeCallback: SubscribeCallback, numRequested?: number | null): void;
    /**
     * Subscribes to a topic and retrieves past events starting from a replay ID.
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {SubscribeCallback} subscribeCallback callback function for handling subscription events
     * @param {number | null} numRequested number of events requested. If null, the client keeps the subscription alive forever.
     * @param {number} replayId replay ID
     * @memberof PubSubApiClient.prototype
     */
    subscribeFromReplayId(topicName: string, subscribeCallback: SubscribeCallback, numRequested: number | null, replayId: number): void;
    /**
     * Subscribes to a topic.
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {SubscribeCallback} subscribeCallback callback function for handling subscription events
     * @param {number | null} [numRequested] optional number of events requested. If not supplied or null, the client keeps the subscription alive forever.
     * @memberof PubSubApiClient.prototype
     */
    subscribe(topicName: string, subscribeCallback: SubscribeCallback, numRequested?: number | null): void;
    /**
     * Request additional events on an existing subscription.
     * @param {string} topicName topic name
     * @param {number} numRequested number of events requested.
     */
    requestAdditionalEvents(topicName: string, numRequested: number): void;
    /**
     * Publishes a payload to a topic using the gRPC client.
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {Object} payload
     * @param {string} [correlationKey] optional correlation key. If you don't provide one, we'll generate a random UUID for you.
     * @returns {Promise<PublishResult>} Promise holding a PublishResult object with replayId and correlationKey
     * @memberof PubSubApiClient.prototype
     */
    publish(topicName: string, payload: any, correlationKey?: string): Promise<PublishResult>;
    /**
     * Closes the gRPC connection. The client will no longer receive events for any topic.
     * @memberof PubSubApiClient.prototype
     */
    close(): void;
    #private;
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
    topicName: string;
    requestedEventCount: number;
    receivedEventCount: number;
    lastReplayId: number;
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
    replayPreset?: number;
    replayId?: number;
};
import { connectivityState } from '@grpc/grpc-js';
import { Configuration } from './utils/configuration.js';
/**
 * Enum for subscripe callback type values
 */
type SubscribeCallbackType = string;
declare namespace SubscribeCallbackType {
    let EVENT: string;
    let LAST_EVENT: string;
    let ERROR: string;
    let END: string;
    let GRPC_STATUS: string;
    let GRPC_KEEP_ALIVE: string;
}
import { AuthType } from './utils/configuration.js';
export {};
//# sourceMappingURL=client.d.ts.map