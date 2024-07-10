import { EventEmitter } from 'events';

/**
 * EventEmitter wrapper for processing incoming Pub/Sub API events
 * while keeping track of the topic name and the volume of events requested/received.
 * @alias PubSubEventEmitter
 * @global
 */
export default class PubSubEventEmitter extends EventEmitter {
    /**
     * Create a new EventEmitter for Pub/Sub API events
     * @protected
     */
    constructor() {
        super();
    }

    emit(eventName, args) {
        return super.emit(eventName, args);
    }
}
