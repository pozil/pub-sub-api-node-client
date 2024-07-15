// eslint-disable-next-line no-unused-vars
import PubSubEventEmitter from './pubSubEventEmitter.js';

/**
 *
 */
export class Subscriber {
    /**
     * @protected
     */
    _context

    /**
     * @param {PubSubContext | PubSubEventEmitter} context
     */
    constructor(context) {
        this._context = context
    }

    /**
     * Callback on stream end
     *
     * @returns {Promise<void>}
     */
    async onEnd() {}

    /**
     * Callback on stream error / parsed event error
     *
     * @param error handled error
     * @returns {Promise<void>}
     */
    // eslint-disable-next-line no-unused-vars
    async onError(error) {}

    /**
     * Callback on keepalive event
     *
     * @param event keepalive event
     * @returns {Promise<void>}
     */
    // eslint-disable-next-line no-unused-vars
    async onKeepAlive(event) {}

    /**
     * Callback on last event
     *
     * @returns {Promise<void>}
     */
    async onLastEvent() {}

    /**
     * Callback on parsed data
     *
     * @param event parsed event data
     * @returns {Promise<void>}
     */
    // eslint-disable-next-line no-unused-vars
    async onData(event) {
        this._context.registerReceivedEvent(event);
    }

    /**
     * Callback on event status update
     *
     * @param status status event data
     * @returns {Promise<void>}
     */
    // eslint-disable-next-line no-unused-vars
    async onStatus(status) {}

    isLastRequestedEvent() {
        return this._context.getReceivedEventCount() === this._context.getRequestedEventCount();
    }

    getContext() {
        return this._context;
    }
}



/**
 * @return {Subscriber}
 * @param  {PubSubEventEmitter} eventEmitter
 */
export class EventEmitterSubscriber extends Subscriber {
    /**
     * @param {PubSubEventEmitter} eventEmitter
     */
    constructor(eventEmitter) {
        super(eventEmitter)
    }

    async onEnd() {
        this._context.emit('end');

        return super.onEnd();
    }

    async onError(error) {
        this._context.emit('error', error);

        return super.onError(error);
    }

    async onKeepAlive(event) {
        this._context.emit('keepalive', event);

        return super.onKeepAlive(event);
    }

    async onLastEvent() {
        this._context.emit('lastevent');

        return super.onLastEvent();
    }

    async onData(event) {
        this._context.emit('data', event);

        return super.onData(event);
    }

    async onStatus(status) {
        this._context.emit('status', status);

        return super.onStatus(status);
    }
}