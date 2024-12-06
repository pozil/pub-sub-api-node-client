/**
 * Client for the Salesforce Pub/Sub API
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
     */
    connect(): Promise<void>;
    /**
     * Gets the gRPC connectivity state from the current channel.
     * @returns {Promise<connectivityState>} Promise that holds channel's connectivity information {@link connectivityState}
     */
    getConnectivityState(): Promise<connectivityState>;
    /**
     * Subscribes to a topic and retrieves all past events in retention window.
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {SubscribeCallback} subscribeCallback callback function for handling subscription events
     * @param {number | null} [numRequested] optional number of events requested. If not supplied or null, the client keeps the subscription alive forever.
     */
    subscribeFromEarliestEvent(topicName: string, subscribeCallback: SubscribeCallback, numRequested?: number | null): void;
    /**
     * Subscribes to a topic and retrieves past events starting from a replay ID.
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {SubscribeCallback} subscribeCallback callback function for handling subscription events
     * @param {number | null} numRequested number of events requested. If null, the client keeps the subscription alive forever.
     * @param {number} replayId replay ID
     */
    subscribeFromReplayId(topicName: string, subscribeCallback: SubscribeCallback, numRequested: number | null, replayId: number): void;
    /**
     * Subscribes to a topic.
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {SubscribeCallback} subscribeCallback callback function for handling subscription events
     * @param {number | null} [numRequested] optional number of events requested. If not supplied or null, the client keeps the subscription alive forever.
     */
    subscribe(topicName: string, subscribeCallback: SubscribeCallback, numRequested?: number | null): void;
    /**
     * Subscribes to a topic thanks to a managed subscription.
     * @param {string} subscriptionIdOrName managed subscription ID or developer name
     * @param {SubscribeCallback} subscribeCallback callback function for handling subscription events
     * @param {number | null} [numRequested] optional number of events requested. If not supplied or null, the client keeps the subscription alive forever.
     * @throws Throws an error if the managed subscription does not exist or is not in the `RUN` state.
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
     * Publishes a payload to a topic using the gRPC client. This is a synchronous operation, use `publishBatch` when publishing event batches.
     * @param {string} topicName name of the topic that we're publishing on
     * @param {Object} payload payload of the event that is being published
     * @param {string} [correlationKey] optional correlation key. If you don't provide one, we'll generate a random UUID for you.
     * @returns {Promise<PublishResult>} Promise holding a PublishResult object with replayId and correlationKey
     */
    publish(topicName: string, payload: any, correlationKey?: string): Promise<PublishResult>;
    /**
     * Publishes a batch of events using the gRPC client's publish stream.
     * @param {string} topicName name of the topic that we're publishing on
     * @param {ProducerEvent[]} events events to be published
     * @param {PublishCallback} publishCallback callback function for handling publish responses
     */
    publishBatch(topicName: string, events: ProducerEvent[], publishCallback: PublishCallback): Promise<void>;
    /**
     * Closes the gRPC connection. The client will no longer receive events for any topic.
     */
    close(): void;
    #private;
}
export type Configuration = import("./utils/types.js").Configuration;
export type Logger = import("./utils/types.js").Logger;
export type ProducerEvent = import("./utils/types.js").ProducerEvent;
export type PublishCallback = import("./utils/types.js").PublishCallback;
export type PublishStream = import("./utils/types.js").PublishStream;
export type PublishStreamInfo = import("./utils/types.js").PublishStreamInfo;
export type PublishResult = import("./utils/types.js").PublishResult;
export type Schema = import("./utils/types.js").Schema;
export type SubscribeCallback = import("./utils/types.js").SubscribeCallback;
export type SubscribeRequest = import("./utils/types.js").SubscribeRequest;
export type Subscription = import("./utils/types.js").Subscription;
export type SubscriptionInfo = import("./utils/types.js").SubscriptionInfo;
import { connectivityState } from '@grpc/grpc-js';
//# sourceMappingURL=client.d.ts.map