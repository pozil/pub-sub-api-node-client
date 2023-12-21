/**
 * Client for the Salesforce Pub/Sub API
 * @alias PubSubApiClient
 * @global
 */
export default class PubSubApiClient {
    /**
     * Builds a new Pub/Sub API client
     * @param {Logger} [logger] an optional custom logger. The client uses the console if no value is supplied.
     */
    constructor(logger?: Logger);
    /**
     * Authenticates with Salesforce then, connects to the Pub/Sub API.
     * @returns {Promise<void>} Promise that resolves once the connection is established
     * @memberof PubSubApiClient.prototype
     */
    connect(): Promise<void>;
    /**
     * Connects to the Pub/Sub API with user-supplied authentication.
     * @param {string} accessToken Salesforce access token
     * @param {string} instanceUrl Salesforce instance URL
     * @param {string} [organizationId] optional organization ID. If you don't provide one, we'll attempt to parse it from the accessToken.
     * @returns {Promise<void>} Promise that resolves once the connection is established
     * @memberof PubSubApiClient.prototype
     */
    connectWithAuth(accessToken: string, instanceUrl: string, organizationId?: string): Promise<void>;
    /**
     * Subscribes to a topic and retrieves all past events in retention window.
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {number} [numRequested] optional number of events requested. If not supplied or null, the client keeps the subscription alive forever.
     * @returns {Promise<EventEmitter>} Promise that holds an emitter that allows you to listen to received events and stream lifecycle events
     * @memberof PubSubApiClient.prototype
     */
    subscribeFromEarliestEvent(topicName: string, numRequested?: number): Promise<EventEmitter>;
    /**
     * Subscribes to a topic and retrieves past events starting from a replay ID.
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {number} numRequested number of events requested. If null, the client keeps the subscription alive forever.
     * @param {number} replayId replay ID
     * @returns {Promise<EventEmitter>} Promise that holds an emitter that allows you to listen to received events and stream lifecycle events
     * @memberof PubSubApiClient.prototype
     */
    subscribeFromReplayId(topicName: string, numRequested: number, replayId: number): Promise<EventEmitter>;
    /**
     * Subscribes to a topic.
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {number} [numRequested] optional number of events requested. If not supplied or null, the client keeps the subscription alive forever.
     * @returns {Promise<EventEmitter>} Promise that holds an emitter that allows you to listen to received events and stream lifecycle events
     * @memberof PubSubApiClient.prototype
     */
    subscribe(topicName: string, numRequested?: number): Promise<EventEmitter>;
    /**
     * Request additional events on an existing subscription.
     * @param {PubSubEventEmitter} eventEmitter event emitter that was obtained in the first subscribe call
     * @param {number} numRequested number of events requested.
     */
    requestAdditionalEvents(eventEmitter: PubSubEventEmitter, numRequested: number): Promise<void>;
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
export type Schema = {
    id: string;
    type: any;
};
export type Logger = {
    debug: Function;
    info: Function;
    error: Function;
    warn: Function;
};
import PubSubEventEmitter from './utils/pubSubEventEmitter.js';
//# sourceMappingURL=client.d.ts.map