/**
 * Context keeping track of the topic name and the volume of events requested/received.
 * @alias PubSubContext
 * @global
 */
export default class PubSubContext {
    #topicName;
    #requestedEventCount;
    #receivedEventCount;
    #latestReplayId;

    /**
     * Create a new EventEmitter for Pub/Sub API events
     * @param {string} topicName
     * @param {number} requestedEventCount
     * @protected
     */
    constructor(topicName, requestedEventCount) {
        this.#topicName = topicName;
        this.#requestedEventCount = requestedEventCount;
        this.#receivedEventCount = 0;
        this.#latestReplayId = null;
    }

    /**
     * Track Pub/Sub API event counts
     * @param args the event
     */
    registerReceivedEvent(args) {
        // Track Pub/Sub API events
        this.#receivedEventCount++;
        this.#latestReplayId = args.replayId;
    }

    /**
     * Returns the number of events that were requested when subscribing.
     * @returns {number} the number of events that were requested
     */
    getRequestedEventCount() {
        return this.#requestedEventCount;
    }

    /**
     * Returns the number of events that were received since subscribing.
     * @returns {number} the number of events that were received
     */
    getReceivedEventCount() {
        return this.#receivedEventCount;
    }

    /**
     * Returns the topic name for this subscription.
     * @returns {string} the topic name
     */
    getTopicName() {
        return this.#topicName;
    }

    /**
     * Returns the replay ID of the last processed event or null if no event was processed yet.
     * @return {number} replay ID
     */
    getLatestReplayId() {
        return this.#latestReplayId;
    }

    /**
     * @protected
     * Resets the requested/received event counts.
     * This method should only be be used internally by the client when it resubscribes.
     * @param {number} newRequestedEventCount
     */
    _resetEventCount(newRequestedEventCount) {
        this.#requestedEventCount = newRequestedEventCount;
        this.#receivedEventCount = 0;
    }
}
