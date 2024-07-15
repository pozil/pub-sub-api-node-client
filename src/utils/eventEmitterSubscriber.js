// eslint-disable-next-line no-unused-vars
import PubSubEventEmitter from './pubSubEventEmitter.js';

/**
 * @typedef {{
 *      onEnd?: () => Promise<void>,
 *      onError?: (error: Error) => Promise<void>,
 *      onLastEvent?: () => Promise<void>,
 *      onData: () => Promise<void>,
 *      onKeepAlive?: (data: any) => Promise<void>
 *      onStatus?: (status: any) => Promise<void>
 *     }} Subscriber subscriber instance holding subscriptions callbacks
 * @type Subscriber subscriber instance
 * @param  {PubSubEventEmitter} eventEmitter
 */
export const EventEmitterSubscriber =  (eventEmitter) => ({
    onEnd: () => eventEmitter.emit('end'),
    onError: (error) => eventEmitter.emit('error', error),
    onKeepAlive: (event) => eventEmitter.emit('keepalive', event),
    onLastEvent: () => eventEmitter.emit('lastevent'),
    onData: (event) => eventEmitter.emit('data', event),
    onStatus: (status) => eventEmitter.emit('status', status)
})

export default EventEmitterSubscriber