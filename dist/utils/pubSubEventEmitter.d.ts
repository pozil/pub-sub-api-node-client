/**
 * EventEmitter wrapper for processing incoming Pub/Sub API events
 * while keeping track of the topic name and the volume of events requested/received.
 * @alias PubSubEventEmitter
 * @global
 */
export default class PubSubEventEmitter extends EventEmitter {
    /**
     * Create a new EventEmitter for Pub/Sub API events
     * @param {string} topicName
     * @param {number} requestedEventCount
     * @protected
     */
    protected constructor();
    emit(eventName: any, args: any): boolean;
    /**
     * Returns the number of events that were requested when subscribing.
     * @returns {number} the number of events that were requested
     */
    getRequestedEventCount(): number;
    /**
     * Returns the number of events that were received since subscribing.
     * @returns {number} the number of events that were received
     */
    getReceivedEventCount(): number;
    /**
     * Returns the topic name for this subscription.
     * @returns {string} the topic name
     */
    getTopicName(): string;
    /**
     * Returns the replay ID of the last processed event or null if no event was processed yet.
     * @return {number} replay ID
     */
    getLatestReplayId(): number;
    /**
     * @protected
     * Resets the requested/received event counts.
     * This method should only be be used internally by the client when it resubscribes.
     * @param {number} newRequestedEventCount
     */
    protected _resetEventCount(newRequestedEventCount: number): void;
    #private;
}
import { EventEmitter } from 'events';
//# sourceMappingURL=pubSubEventEmitter.d.ts.map