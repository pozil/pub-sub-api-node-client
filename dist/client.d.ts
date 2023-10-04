/**
 * @typedef {Object} Schema
 * @property {string} id
 * @property {Object} type
 */
/**
 * @typedef {Object} PublishResult
 * @property {number} replayId
 * @property {string} correlationKey
 */
/**
 * @typedef {Object} Logger
 * @property {Function} debug
 * @property {Function} info
 * @property {Function} error
 */
/**
 * Client for the Salesforce Pub/Sub API
 */
export default class PubSubApiClient {
    /**
     * Builds a new Pub/Sub API client
     * @param {Logger} logger an optional custom logger. The client uses the console if no value is supplied.
     */
    constructor(logger?: Logger);
    /**
     * Authenticates with Salesforce then, connects to the Pub/Sub API
     * @returns {Promise<void>} Promise that resolves once the connection is established
     */
    connect(): Promise<void>;
    /**
     * Connects to the Pub/Sub API with user-supplied authentication
     * @param {string} accessToken
     * @param {string} instanceUrl
     * @param {string} organizationId
     * @param {string} username
     * @returns {Promise<void>} Promise that resolves once the connection is established
     */
    connectWithAuth(accessToken: string, instanceUrl: string, organizationId: string, username: string): Promise<void>;
    /**
     * Subscribes to a topic and retrieves all past events in retention window
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {number} numRequested number of events requested
     * @returns {Promise<EventEmitter>} Promise that holds an emitter that allows you to listen to received events and stream lifecycle events
     */
    subscribeFromEarliestEvent(topicName: string, numRequested: number): Promise<EventEmitter>;
    /**
     * Subscribes to a topic and retrieve past events starting from a replay ID
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {number} numRequested number of events requested
     * @param {number} replayId replay ID
     * @returns {Promise<EventEmitter>} Promise that holds an emitter that allows you to listen to received events and stream lifecycle events
     */
    subscribeFromReplayId(topicName: string, numRequested: number, replayId: number): Promise<EventEmitter>;
    /**
     * Subscribes to a topic
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {number} numRequested number of events requested
     * @returns {Promise<EventEmitter>} Promise that holds an emitter that allows you to listen to received events and stream lifecycle events
     */
    subscribe(topicName: string, numRequested: number): Promise<EventEmitter>;
    /**
     * Publishes a payload to a topic using the gRPC client
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {Object} payload
     * @param {string} [correlationKey] optional correlation key. If you don't provide one, we'll generate a random UUID for you.
     * @returns {Promise<PublishResult>} Promise holding a PublishResult object with replayId and correlationKey
     */
    publish(topicName: string, payload: any, correlationKey?: string): Promise<PublishResult>;
    /**
     * Closes the gRPC connection. The client will no longer receive events for any topic.
     */
    close(): void;
    #private;
}
export type Schema = {
    id: string;
    type: any;
};
export type PublishResult = {
    replayId: number;
    correlationKey: string;
};
export type Logger = {
    debug: Function;
    info: Function;
    error: Function;
};
//# sourceMappingURL=client.d.ts.map