import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';

import avro from 'avro-js';
import certifi from 'certifi';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
// eslint-disable-next-line no-unused-vars
import { EventEmitter } from 'events';

import SchemaCache from './utils/schemaCache.js';
import EventParseError from './utils/eventParseError.js';
import PubSubEventEmitter from './utils/pubSubEventEmitter.js';
import { CustomLongAvroType } from './utils/avroHelper.js';
import Configuration from './utils/configuration.js';
import {
    parseEvent,
    encodeReplayId,
    decodeReplayId
} from './utils/eventParser.js';
import SalesforceAuth from './utils/auth.js';

/**
 * @typedef {Object} PublishResult
 * @property {number} replayId
 * @property {string} correlationKey
 * @global
 */

/**
 * @typedef {Object} Logger
 * @property {Function} debug
 * @property {Function} info
 * @property {Function} error
 * @property {Function} warn
 * @protected
 */

/**
 * Maximum event batch size suppported by the Pub/Sub API as documented here:
 * https://developer.salesforce.com/docs/platform/pub-sub-api/guide/flow-control.html
 */
const MAX_EVENT_BATCH_SIZE = 100;

/**
 * Client for the Salesforce Pub/Sub API
 * @alias PubSubApiClient
 * @global
 */
export default class PubSubApiClient {
    /**
     * gRPC client
     * @type {Object}
     */
    #client;

    /**
     * Schema cache
     * @type {SchemaCache}
     */
    #schemaChache;

    /**
     * Map of subscribitions indexed by topic name
     * @type {Map<string,Object>}
     */
    #subscriptions;

    #logger;

    /**
     * Builds a new Pub/Sub API client
     * @param {Logger} [logger] an optional custom logger. The client uses the console if no value is supplied.
     */
    constructor(logger = console) {
        this.#logger = logger;
        this.#schemaChache = new SchemaCache();
        this.#subscriptions = new Map();
        // Check and load config
        try {
            Configuration.load();
        } catch (error) {
            this.#logger.error(error);
            throw new Error('Failed to initialize Pub/Sub API client', {
                cause: error
            });
        }
    }

    /**
     * Authenticates with Salesforce then, connects to the Pub/Sub API.
     * @returns {Promise<void>} Promise that resolves once the connection is established
     * @memberof PubSubApiClient.prototype
     */
    async connect() {
        if (Configuration.isUserSuppliedAuth()) {
            throw new Error(
                'You selected user-supplied authentication mode so you cannot use the "connect()" method. Use "connectWithAuth(...)" instead.'
            );
        }

        // Connect to Salesforce to obtain an access token
        let conMetadata;
        try {
            conMetadata = await SalesforceAuth.authenticate();
            this.#logger.info(
                `Connected to Salesforce org ${conMetadata.instanceUrl} as ${conMetadata.username}`
            );
        } catch (error) {
            throw new Error('Failed to authenticate with Salesforce', {
                cause: error
            });
        }
        return this.#connectToPubSubApi(conMetadata);
    }

    /**
     * Connects to the Pub/Sub API with user-supplied authentication.
     * @param {string} accessToken Salesforce access token
     * @param {string} instanceUrl Salesforce instance URL
     * @param {string} [organizationId] optional organization ID. If you don't provide one, we'll attempt to parse it from the accessToken.
     * @returns {Promise<void>} Promise that resolves once the connection is established
     * @memberof PubSubApiClient.prototype
     */
    async connectWithAuth(accessToken, instanceUrl, organizationId) {
        if (!instanceUrl || !instanceUrl.startsWith('https://')) {
            throw new Error(
                `Invalid Salesforce Instance URL format supplied: ${instanceUrl}`
            );
        }
        let validOrganizationId = organizationId;
        if (!organizationId) {
            try {
                validOrganizationId = accessToken.split('!').at(0);
            } catch (error) {
                throw new Error(
                    'Unable to parse organizationId from given access token',
                    {
                        cause: error
                    }
                );
            }
        }
        if (
            validOrganizationId.length !== 15 &&
            validOrganizationId.length !== 18
        ) {
            throw new Error(
                `Invalid Salesforce Org ID format supplied: ${validOrganizationId}`
            );
        }
        return this.#connectToPubSubApi({
            accessToken,
            instanceUrl,
            organizationId: validOrganizationId
        });
    }

    /**
     * Connects to the Pub/Sub API.
     * @param {import('./auth.js').ConnectionMetadata} conMetadata
     * @returns {Promise<void>} Promise that resolves once the connection is established
     */
    async #connectToPubSubApi(conMetadata) {
        // Connect to Pub/Sub API
        try {
            // Read certificates
            const rootCert = fs.readFileSync(certifi);

            // Load proto definition
            const protoFilePath = fileURLToPath(
                new URL('../pubsub_api.proto', import.meta.url)
            );
            const packageDef = protoLoader.loadSync(protoFilePath, {});
            const grpcObj = grpc.loadPackageDefinition(packageDef);
            const sfdcPackage = grpcObj.eventbus.v1;

            // Prepare gRPC connection
            const metaCallback = (_params, callback) => {
                const meta = new grpc.Metadata();
                meta.add('accesstoken', conMetadata.accessToken);
                meta.add('instanceurl', conMetadata.instanceUrl);
                meta.add('tenantid', conMetadata.organizationId);
                callback(null, meta);
            };
            const callCreds =
                grpc.credentials.createFromMetadataGenerator(metaCallback);
            const combCreds = grpc.credentials.combineChannelCredentials(
                grpc.credentials.createSsl(rootCert),
                callCreds
            );

            // Return pub/sub gRPC client
            this.#client = new sfdcPackage.PubSub(
                Configuration.getPubSubEndpoint(),
                combCreds
            );
            this.#logger.info(
                `Connected to Pub/Sub API endpoint ${Configuration.getPubSubEndpoint()}`
            );
        } catch (error) {
            throw new Error('Failed to connect to Pub/Sub API', {
                cause: error
            });
        }
    }

    /**
     * Subscribes to a topic and retrieves all past events in retention window.
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {number | null} [numRequested] optional number of events requested. If not supplied or null, the client keeps the subscription alive forever.
     * @returns {Promise<EventEmitter>} Promise that holds an emitter that allows you to listen to received events and stream lifecycle events
     * @memberof PubSubApiClient.prototype
     */
    async subscribeFromEarliestEvent(topicName, numRequested = null) {
        return this.#subscribe({
            topicName,
            numRequested,
            replayPreset: 1
        });
    }

    /**
     * Subscribes to a topic and retrieves past events starting from a replay ID.
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {number | null} [numRequested] number of events requested. If null, the client keeps the subscription alive forever.
     * @param {number} replayId replay ID
     * @returns {Promise<EventEmitter>} Promise that holds an emitter that allows you to listen to received events and stream lifecycle events
     * @memberof PubSubApiClient.prototype
     */
    async subscribeFromReplayId(topicName, numRequested, replayId) {
        return this.#subscribe({
            topicName,
            numRequested,
            replayPreset: 2,
            replayId: encodeReplayId(replayId)
        });
    }

    /**
     * Subscribes to a topic.
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {number | null} [numRequested] optional number of events requested. If not supplied or null, the client keeps the subscription alive forever.
     * @returns {Promise<EventEmitter>} Promise that holds an emitter that allows you to listen to received events and stream lifecycle events
     * @memberof PubSubApiClient.prototype
     */
    async subscribe(topicName, numRequested = null) {
        return this.#subscribe({
            topicName,
            numRequested
        });
    }

    /**
     * Subscribes to a topic using the gRPC client and an event schema
     * @param {object} subscribeRequest subscription request
     * @return {PubSubEventEmitter} emitter that allows you to listen to received events and stream lifecycle events
     */
    async #subscribe(subscribeRequest) {
        let { topicName, numRequested } = subscribeRequest;
        try {
            // Check number of requested events
            let isInfiniteEventRequest = false;
            if (numRequested === null || numRequested === undefined) {
                isInfiniteEventRequest = true;
                subscribeRequest.numRequested = numRequested =
                    MAX_EVENT_BATCH_SIZE;
            } else {
                if (typeof numRequested !== 'number') {
                    throw new Error(
                        `Expected a number type for number of requested events but got ${typeof numRequested}`
                    );
                }
                if (!Number.isSafeInteger(numRequested) || numRequested < 1) {
                    throw new Error(
                        `Expected an integer greater than 1 for number of requested events but got ${numRequested}`
                    );
                }
                if (numRequested > MAX_EVENT_BATCH_SIZE) {
                    this.#logger.warn(
                        `The number of requested events for ${topicName} exceeds max event batch size (${MAX_EVENT_BATCH_SIZE}).`
                    );
                }
            }
            // Check client connection
            if (!this.#client) {
                throw new Error('Pub/Sub API client is not connected.');
            }

            // Check for an existing subscription
            let subscription = this.#subscriptions.get(topicName);

            // Send subscription request
            if (!subscription) {
                subscription = this.#client.Subscribe();
                this.#subscriptions.set(topicName, subscription);
            }

            subscription.write(subscribeRequest);
            this.#logger.info(
                `Subscribe request sent for ${numRequested} events from ${topicName}...`
            );

            // Listen to new events
            const eventEmitter = new PubSubEventEmitter(
                topicName,
                numRequested
            );
            subscription.on('data', (data) => {
                const latestReplayId = decodeReplayId(data.latestReplayId);
                if (data.events) {
                    this.#logger.info(
                        `Received ${data.events.length} events, latest replay ID: ${latestReplayId}`
                    );
                    data.events.forEach(async (event) => {
                        try {
                            let schema;
                            // Are we subscribing to a custom channel?
                            if (topicName.endsWith('__chn')) {
                                // Use schema ID instead of topic name to retrieve schema
                                schema = await this.#getEventSchemaFromId(
                                    event.event.schemaId
                                );
                            } else {
                                // Load event schema from cache or from the client
                                schema =
                                    await this.#getEventSchemaFromTopicName(
                                        topicName
                                    );
                                // Make sure that schema ID matches. If not, event fields may have changed
                                // and client needs to reload schema
                                if (schema.id !== event.event.schemaId) {
                                    this.#logger.info(
                                        `Event schema changed (${schema.id} != ${event.event.schemaId}), reloading: ${topicName}`
                                    );
                                    this.#schemaChache.deleteWithTopicName(
                                        topicName
                                    );
                                    schema =
                                        await this.#getEventSchemaFromTopicName(
                                            topicName
                                        );
                                }
                            }
                            // Parse event thanks to schema
                            const parsedEvent = parseEvent(schema, event);
                            this.#logger.debug(parsedEvent);
                            eventEmitter.emit('data', parsedEvent);
                        } catch (error) {
                            // Report event parsing error with replay ID if possible
                            let replayId;
                            try {
                                replayId = decodeReplayId(event.replayId);
                                // eslint-disable-next-line no-empty, no-unused-vars
                            } catch (error) {}
                            const message = replayId
                                ? `Failed to parse event with replay ID ${replayId}`
                                : `Failed to parse event with unknown replay ID (latest replay ID was ${latestReplayId})`;
                            const parseError = new EventParseError(
                                message,
                                error,
                                replayId,
                                event,
                                latestReplayId
                            );
                            eventEmitter.emit('error', parseError);
                            this.#logger.error(parseError);
                        }

                        // Handle last requested event
                        if (
                            eventEmitter.getReceivedEventCount() ===
                            eventEmitter.getRequestedEventCount()
                        ) {
                            if (isInfiniteEventRequest) {
                                // Request additional events
                                this.requestAdditionalEvents(
                                    eventEmitter,
                                    MAX_EVENT_BATCH_SIZE
                                );
                            } else {
                                // Emit a 'lastevent' event when reaching the last requested event count
                                eventEmitter.emit('lastevent');
                            }
                        }
                    });
                } else {
                    // If there are no events then, every 270 seconds (or less) the server publishes a keepalive message with
                    // the latestReplayId and pendingNumRequested (the number of events that the client is still waiting for)
                    this.#logger.debug(
                        `Received keepalive message. Latest replay ID: ${latestReplayId}`
                    );
                    data.latestReplayId = latestReplayId; // Replace original value with decoded value
                    eventEmitter.emit('keepalive', data);
                }
            });
            subscription.on('end', () => {
                this.#subscriptions.delete(topicName);
                this.#logger.info('gRPC stream ended');
                eventEmitter.emit('end');
            });
            subscription.on('error', (error) => {
                this.#logger.error(
                    `gRPC stream error: ${JSON.stringify(error)}`
                );
                eventEmitter.emit('error', error);
            });
            subscription.on('status', (status) => {
                this.#logger.info(
                    `gRPC stream status: ${JSON.stringify(status)}`
                );
                eventEmitter.emit('status', status);
            });
            return eventEmitter;
        } catch (error) {
            throw new Error(
                `Failed to subscribe to events for topic ${topicName}`,
                { cause: error }
            );
        }
    }

    /**
     * Request additional events on an existing subscription.
     * @param {PubSubEventEmitter} eventEmitter event emitter that was obtained in the first subscribe call
     * @param {number} numRequested number of events requested.
     */
    async requestAdditionalEvents(eventEmitter, numRequested) {
        const topicName = eventEmitter.getTopicName();

        // Retrieve existing subscription
        const subscription = this.#subscriptions.get(topicName);
        if (!subscription) {
            throw new Error(
                `Failed to request additional events for topic ${topicName}, no active subscription found.`
            );
        }

        // Request additional events
        eventEmitter._resetEventCount(numRequested);
        subscription.write({
            topicName,
            numRequested: numRequested
        });
        this.#logger.debug(
            `Resubscribing to a batch of ${numRequested} events for: ${topicName}`
        );
    }

    /**
     * Publishes a payload to a topic using the gRPC client.
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {Object} payload
     * @param {string} [correlationKey] optional correlation key. If you don't provide one, we'll generate a random UUID for you.
     * @returns {Promise<PublishResult>} Promise holding a PublishResult object with replayId and correlationKey
     * @memberof PubSubApiClient.prototype
     */
    async publish(topicName, payload, correlationKey) {
        try {
            if (!this.#client) {
                throw new Error('Pub/Sub API client is not connected.');
            }
            const schema = await this.#getEventSchemaFromTopicName(topicName);

            const id = correlationKey ? correlationKey : crypto.randomUUID();
            const response = await new Promise((resolve, reject) => {
                this.#client.Publish(
                    {
                        topicName,
                        events: [
                            {
                                id, // Correlation key
                                schemaId: schema.id,
                                payload: schema.type.toBuffer(payload)
                            }
                        ]
                    },
                    (err, response) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(response);
                        }
                    }
                );
            });
            const result = response.results[0];
            result.replayId = decodeReplayId(result.replayId);
            return result;
        } catch (error) {
            throw new Error(`Failed to publish event for topic ${topicName}`, {
                cause: error
            });
        }
    }

    /**
     * Closes the gRPC connection. The client will no longer receive events for any topic.
     * @memberof PubSubApiClient.prototype
     */
    close() {
        this.#logger.info('Closing gRPC stream');
        this.#client.close();
    }

    /**
     * Retrieves an event schema from the cache based on a topic name.
     * If it's not cached, fetches the shema with the gRPC client.
     * @param {string} topicName name of the topic that we're fetching
     * @returns {Promise<Schema>} Promise holding parsed event schema
     */
    async #getEventSchemaFromTopicName(topicName) {
        let schema = this.#schemaChache.getFromTopicName(topicName);
        if (!schema) {
            try {
                schema =
                    await this.#fetchEventSchemaFromTopicNameWithClient(
                        topicName
                    );
                this.#schemaChache.setWithTopicName(topicName, schema);
            } catch (error) {
                throw new Error(
                    `Failed to load schema for topic ${topicName}`,
                    { cause: error }
                );
            }
        }
        return schema;
    }

    /**
     * Retrieves an event schema from the cache based on its ID.
     * If it's not cached, fetches the shema with the gRPC client.
     * @param {string} schemaId ID of the schema that we're fetching
     * @returns {Promise<Schema>} Promise holding parsed event schema
     */
    async #getEventSchemaFromId(schemaId) {
        let schema = this.#schemaChache.getFromId(schemaId);
        if (!schema) {
            try {
                schema = await this.#fetchEventSchemaFromIdWithClient(schemaId);
                this.#schemaChache.set(schema);
            } catch (error) {
                throw new Error(`Failed to load schema with ID ${schemaId}`, {
                    cause: error
                });
            }
        }
        return schema;
    }

    /**
     * Requests the event schema for a topic using the gRPC client
     * @param {string} topicName name of the topic that we're fetching
     * @returns {Promise<Schema>} Promise holding parsed event schema
     */
    async #fetchEventSchemaFromTopicNameWithClient(topicName) {
        return new Promise((resolve, reject) => {
            this.#client.GetTopic(
                { topicName },
                async (topicError, response) => {
                    if (topicError) {
                        reject(topicError);
                    } else {
                        // Get the schema information
                        const { schemaId } = response;
                        const schemaInfo =
                            await this.#fetchEventSchemaFromIdWithClient(
                                schemaId
                            );
                        this.#logger.info(`Topic schema loaded: ${topicName}`);
                        resolve(schemaInfo);
                    }
                }
            );
        });
    }

    /**
     * Requests the event schema from an ID using the gRPC client
     * @param {string} schemaId schema ID that we're fetching
     * @returns {Promise<Schema>} Promise holding parsed event schema
     */
    async #fetchEventSchemaFromIdWithClient(schemaId) {
        return new Promise((resolve, reject) => {
            this.#client.GetSchema({ schemaId }, (schemaError, res) => {
                if (schemaError) {
                    reject(schemaError);
                } else {
                    const schemaType = avro.parse(res.schemaJson, {
                        registry: { long: CustomLongAvroType }
                    });
                    resolve({
                        id: schemaId,
                        type: schemaType
                    });
                }
            });
        });
    }
}
