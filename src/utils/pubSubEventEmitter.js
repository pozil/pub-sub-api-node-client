import { EventEmitter } from 'events';
import PubSubContext from './pubSubContext.js';

/**
 * EventEmitter wrapper for processing incoming Pub/Sub API events
 * while keeping track of the topic name and the volume of events requested/received.
 * @alias PubSubEventEmitter
 * @global
 */
export default class PubSubEventEmitter extends EventEmitter {
    /**
     *
     */
    #subscriptionContext;

    /**
     * Create a new EventEmitter for Pub/Sub API events
     * @param {string} topicName
     * @param {number} requestedEventCount
     * @protected
     */
    constructor(topicName, requestedEventCount) {
        super()
        this.#subscriptionContext = new PubSubContext(topicName, requestedEventCount)
    }


    emit(eventName, args) {
        return super.emit(eventName, args);
    }

    registerReceivedEvent(args) {
        this.#subscriptionContext.registerReceivedEvent(args)
    }


    /**
     * Returns the number of events that were requested when subscribing.
     * @returns {number} the number of events that were requested
     */
    getRequestedEventCount() {
        return this.#subscriptionContext.getRequestedEventCount();
    }

    /**
     * Returns the number of events that were received since subscribing.
     * @returns {number} the number of events that were received
     */
    getReceivedEventCount() {
        return this.#subscriptionContext.getReceivedEventCount();
    }

    /**
     * Returns the topic name for this subscription.
     * @returns {string} the topic name
     */
    getTopicName() {
        return this.#subscriptionContext.getTopicName();
    }

    /**
     * Returns the replay ID of the last processed event or null if no event was processed yet.
     * @return {number} replay ID
     */
    getLatestReplayId() {
        return this.#subscriptionContext.getLatestReplayId();
    }

    /**
     * @protected
     * Resets the requested/received event counts.
     * This method should only be be used internally by the client when it resubscribes.
     * @param {number} newRequestedEventCount
     */
    _resetEventCount(newRequestedEventCount) {
        this.#subscriptionContext._resetEventCount(newRequestedEventCount)
    }

}
