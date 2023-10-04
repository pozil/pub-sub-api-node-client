import { EventEmitter } from 'events';

/**
 * EventEmitter wrapper for processing Pub/Sub API events
 * while keeping track of the topic name and the volume of events requested/received.
 */
export default class PubSubEventEmitter extends EventEmitter {
    #topicName;
    #requestedEventCount;
    #receivedEventCount;

    /**
     * Create a new EventEmitter for Pub/Sub API events
     * @param {string} topicName
     * @param {number} requestedEventCount
     */
    constructor(topicName, requestedEventCount) {
        super();
        this.#topicName = topicName;
        this.#requestedEventCount = requestedEventCount;
        this.#receivedEventCount = 0;
    }

    emit(eventName, args) {
        // Track Pub/Sub API events
        if (eventName === 'data') {
            this.#receivedEventCount++;
        }
        return super.emit(eventName, args);
    }

    /**
     * Returns the number of events that were requested during the subscription
     * @returns {number} the number of events that were requested
     */
    getRequestedEventCount() {
        return this.#requestedEventCount;
    }

    /**
     * Returns the number of events that were received since the subscription
     * @returns {number} the number of events that were received
     */
    getReceivedEventCount() {
        return this.#receivedEventCount;
    }

    /**
     * Returns the topic name for this subscription
     * @returns {string} the topic name
     */
    getTopicName() {
        return this.#topicName;
    }
}
