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
     * Authenticates with Salesforce (if not using user-supplied authentication mode) then,
     * connects to the Pub/Sub API.
     * @returns {Promise<void>} Promise that resolves once the connection is established
     * @memberof PubSubApiClient.prototype
     */
    connect(): Promise<void>;
    /**
     * Gets the gRPC connectivity state from the current channel.
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
     * Subscribes to a topic thanks to a managed subscription.
     * @param {string} subscriptionIdOrName managed subscription ID or developer name
     * @param {SubscribeCallback} subscribeCallback callback function for handling subscription events
     * @param {number | null} [numRequested] optional number of events requested. If not supplied or null, the client keeps the subscription alive forever.
     * @throws Throws an error if the managed subscription does not exist or is not in the `RUN` state.
     * @memberof PubSubApiClient.prototype
     */
    subscribeWithManagedSubscription(subscriptionIdOrName: string, subscribeCallback: SubscribeCallback, numRequested?: number | null): Promise<void>;
    /**
     * Request additional events on an existing subscription.
     * @param {string} topicName topic name
     * @param {number} numRequested number of events requested
     */
    requestAdditionalEvents(topicName: string, numRequested: number): void;
    /**
     * Request additional events on an existing managed subscription.
     * @param {string} subscriptionId managed subscription ID
     * @param {number} numRequested number of events requested
     */
    requestAdditionalManagedEvents(subscriptionId: string, numRequested: number): void;
    /**
     * Commits a replay ID on a managed subscription.
     * @param {string} subscriptionId managed subscription ID
     * @param {number} replayId event replay ID
     * @returns {string} commit request UUID
     */
    commitReplayId(subscriptionId: string, replayId: number): string;
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
export type PublishResult = import("./utils/types.js").PublishResult;
export type Subscription = import("./utils/types.js").Subscription;
export type SubscriptionInfo = import("./utils/types.js").SubscriptionInfo;
export type Configuration = import("./utils/types.js").Configuration;
export type Logger = import("./utils/types.js").Logger;
export type SubscribeRequest = import("./utils/types.js").SubscribeRequest;
import { connectivityState } from '@grpc/grpc-js';
import Configuration from './utils/configuration.js';
//# sourceMappingURL=client.d.ts.map