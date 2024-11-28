import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';

import avro from 'avro-js';
import certifi from 'certifi';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
// eslint-disable-next-line no-unused-vars
import { connectivityState } from '@grpc/grpc-js';

import SchemaCache from './utils/schemaCache.js';
import EventParseError from './utils/eventParseError.js';
import { CustomLongAvroType } from './utils/avroHelper.js';
import { AuthType, Configuration } from './utils/configuration.js';
import {
    parseEvent,
    encodeReplayId,
    decodeReplayId,
    toJsonString
} from './utils/eventParser.js';
import SalesforceAuth from './utils/auth.js';

/**
 * Enum for subscripe callback type values
 * @enum {string}
 */
const SubscribeCallbackType = {
    EVENT: 'event',
    LAST_EVENT: 'lastEvent',
    ERROR: 'error',
    END: 'end',
    GRPC_STATUS: 'grpcStatus',
    GRPC_KEEP_ALIVE: 'grpcKeepAlive'
};

/**
 * @typedef {Object} PublishResult
 * @property {number} replayId
 * @property {string} correlationKey
 * @global
 */

/**
 * @callback SubscribeCallback
 * @param {SubscriptionInfo} subscription
 * @param {SubscribeCallbackType} callbackType
 * @param {Object} [data]
 * @global
 */

/**
 * @typedef {Object} Subscription
 * @property {SubscriptionInfo} info
 * @property {Object} grpcSubscription
 * @property {SubscribeCallback} subscribeCallback
 * @protected
 */

/**
 * @typedef {Object} SubscriptionInfo
 * @property {string} topicName
 * @property {number} requestedEventCount
 * @property {number} receivedEventCount
 * @property {number} lastReplayId
 * @protected
 */

/**
 * @typedef {Object} Configuration
 * @property {AuthType} authType
 * @property {string} pubSubEndpoint
 * @property {string} loginUrl
 * @property {string} username
 * @property {string} password
 * @property {string} userToken
 * @property {string} clientId
 * @property {string} clientSecret
 * @property {string} privateKey
 * @property {string} accessToken
 * @property {string} instanceUrl
 * @property {string} organizationId
 * @protected
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
 * @typedef {Object} SubscribeRequest
 * @property {string} topicName
 * @property {number} numRequested
 * @property {number} [replayPreset]
 * @property {number} [replayId]
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
     * Client configuration
     * @type {Configuration}
     */
    #config;

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
     * Map of subscriptions indexed by topic name
     * @type {Map<string,Subscription>}
     */
    #subscriptions;

    /**
     * Logger
     * @type {Logger}
     */
    #logger;

    /**
     * Builds a new Pub/Sub API client
     * @param {Configuration} config the client configuration
     * @param {Logger} [logger] an optional custom logger. The client uses the console if no value is supplied.
     */
    constructor(config, logger = console) {
        this.#logger = logger;
        this.#schemaChache = new SchemaCache();
        this.#subscriptions = new Map();
        // Check and load config
        try {
            this.#config = Configuration.load(config);
        } catch (error) {
            this.#logger.error(error);
            throw new Error('Failed to initialize Pub/Sub API client', {
                cause: error
            });
        }
    }

    /**
     * Authenticates with Salesforce (if not using user-supplied authentication mode) then,
     * connects to the Pub/Sub API.
     * @returns {Promise<void>} Promise that resolves once the connection is established
     * @memberof PubSubApiClient.prototype
     */
    async connect() {
        // Retrieve access token if not using user-supplied auth
        if (this.#config.authType !== AuthType.USER_SUPPLIED) {
            // Connect to Salesforce to obtain an access token
            try {
                const auth = new SalesforceAuth(this.#config, this.#logger);
                const conMetadata = await auth.authenticate();
                this.#config.accessToken = conMetadata.accessToken;
                this.#config.username = conMetadata.username;
                this.#config.instanceUrl = conMetadata.instanceUrl;
                this.#config.organizationId = conMetadata.organizationId;
                this.#logger.info(
                    `Connected to Salesforce org ${conMetadata.instanceUrl} (${this.#config.organizationId}) as ${conMetadata.username}`
                );
            } catch (error) {
                throw new Error('Failed to authenticate with Salesforce', {
                    cause: error
                });
            }
        }

        // Connect to Pub/Sub API
        try {
            this.#logger.debug(`Connecting to Pub/Sub API`);
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
                meta.add('accesstoken', this.#config.accessToken);
                meta.add('instanceurl', this.#config.instanceUrl);
                meta.add('tenantid', this.#config.organizationId);
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
                this.#config.pubSubEndpoint,
                combCreds
            );
            this.#logger.info(
                `Connected to Pub/Sub API endpoint ${this.#config.pubSubEndpoint}`
            );
        } catch (error) {
            throw new Error('Failed to connect to Pub/Sub API', {
                cause: error
            });
        }
    }

    /**
     * Get connectivity state from current channel.
     * @returns {Promise<connectivityState>} Promise that holds channel's connectivity information {@link connectivityState}
     * @memberof PubSubApiClient.prototype
     */
    async getConnectivityState() {
        return this.#client?.getChannel()?.getConnectivityState(false);
    }

    /**
     * Subscribes to a topic and retrieves all past events in retention window.
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {SubscribeCallback} subscribeCallback callback function for handling subscription events
     * @param {number | null} [numRequested] optional number of events requested. If not supplied or null, the client keeps the subscription alive forever.
     * @memberof PubSubApiClient.prototype
     */
    subscribeFromEarliestEvent(
        topicName,
        subscribeCallback,
        numRequested = null
    ) {
        this.#subscribe(
            {
                topicName,
                numRequested,
                replayPreset: 1
            },
            subscribeCallback
        );
    }

    /**
     * Subscribes to a topic and retrieves past events starting from a replay ID.
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {SubscribeCallback} subscribeCallback callback function for handling subscription events
     * @param {number | null} numRequested number of events requested. If null, the client keeps the subscription alive forever.
     * @param {number} replayId replay ID
     * @memberof PubSubApiClient.prototype
     */
    subscribeFromReplayId(
        topicName,
        subscribeCallback,
        numRequested,
        replayId
    ) {
        this.#subscribe(
            {
                topicName,
                numRequested,
                replayPreset: 2,
                replayId: encodeReplayId(replayId)
            },
            subscribeCallback
        );
    }

    /**
     * Subscribes to a topic.
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {SubscribeCallback} subscribeCallback callback function for handling subscription events
     * @param {number | null} [numRequested] optional number of events requested. If not supplied or null, the client keeps the subscription alive forever.
     * @memberof PubSubApiClient.prototype
     */
    subscribe(topicName, subscribeCallback, numRequested = null) {
        this.#subscribe(
            {
                topicName,
                numRequested
            },
            subscribeCallback
        );
    }

    /**
     * Subscribes to a topic using the gRPC client and an event schema
     * @param {SubscribeRequest} subscribeRequest subscription request
     * @param {SubscribeCallback} subscribeCallback callback function for handling subscription events
     */
    #subscribe(subscribeRequest, subscribeCallback) {
        this.#logger.debug(
            `Preparing subscribe request: ${JSON.stringify(subscribeRequest)}`
        );
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
                    subscribeRequest.numRequested = MAX_EVENT_BATCH_SIZE;
                }
            }
            // Check client connection
            if (!this.#client) {
                throw new Error('Pub/Sub API client is not connected.');
            }

            // Check for an existing subscription
            let subscription = this.#subscriptions.get(topicName);
            let grpcSubscription;
            if (subscription) {
                // Reuse existing gRPC connection and reset event counters
                this.#logger.debug(
                    `${topicName} - Reusing cached gRPC subscription`
                );
                grpcSubscription = subscription.grpcSubscription;
                subscription.info.receivedEventCount = 0;
                subscription.info.requestedEventCount =
                    subscribeRequest.numRequested;
            } else {
                // Establish new gRPC subscription
                this.#logger.debug(
                    `${topicName} - Establishing new gRPC subscription`
                );
                grpcSubscription = this.#client.Subscribe();
                subscription = {
                    info: {
                        topicName,
                        requestedEventCount: subscribeRequest.numRequested,
                        receivedEventCount: 0,
                        lastReplayId: null
                    },
                    grpcSubscription,
                    subscribeCallback
                };
                this.#subscriptions.set(topicName, subscription);
            }

            // Listen to new events
            grpcSubscription.on('data', async (data) => {
                const latestReplayId = decodeReplayId(data.latestReplayId);
                subscription.info.lastReplayId = latestReplayId;
                if (data.events) {
                    this.#logger.info(
                        `${topicName} - Received ${data.events.length} events, latest replay ID: ${latestReplayId}`
                    );
                    for (const event of data.events) {
                        try {
                            this.#logger.debug(
                                `${topicName} - Raw event: ${toJsonString(event)}`
                            );
                            // Load event schema from cache or from the gRPC client
                            this.#logger.debug(
                                `${topicName} - Retrieving schema ID: ${event.event.schemaId}`
                            );
                            const schema = await this.#getEventSchemaFromId(
                                event.event.schemaId
                            );
                            // Retrieve subscription
                            const subscription =
                                this.#subscriptions.get(topicName);
                            if (!subscription) {
                                throw new Error(
                                    `Failed to retrieve subscription for topic ${topicName}.`
                                );
                            }
                            subscription.info.receivedEventCount++;
                            // Parse event thanks to schema
                            const parsedEvent = parseEvent(schema, event);
                            this.#logger.debug(
                                `${topicName} - Parsed event: ${toJsonString(parsedEvent)}`
                            );
                            subscribeCallback(
                                subscription.info,
                                SubscribeCallbackType.EVENT,
                                parsedEvent
                            );
                        } catch (error) {
                            // Report event parsing error with replay ID if possible
                            let replayId;
                            try {
                                if (event.replayId) {
                                    replayId = decodeReplayId(event.replayId);
                                }
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
                            subscribeCallback(
                                subscription.info,
                                SubscribeCallbackType.ERROR,
                                parseError
                            );
                            this.#logger.error(parseError);
                        }

                        // Handle last requested event
                        if (
                            subscription.info.receivedEventCount ===
                            subscription.info.requestedEventCount
                        ) {
                            this.#logger.debug(
                                `${topicName} - Reached last of ${subscription.info.requestedEventCount} requested event on channel.`
                            );
                            if (isInfiniteEventRequest) {
                                // Request additional events
                                this.requestAdditionalEvents(
                                    subscription.info.topicName,
                                    subscription.info.requestedEventCount
                                );
                            } else {
                                // Emit a 'lastevent' event when reaching the last requested event count
                                subscribeCallback(
                                    subscription.info,
                                    SubscribeCallbackType.LAST_EVENT
                                );
                            }
                        }
                    }
                } else {
                    // If there are no events then, every 270 seconds (or less) the server publishes a keepalive message with
                    // the latestReplayId and pendingNumRequested (the number of events that the client is still waiting for)
                    this.#logger.debug(
                        `${topicName} - Received keepalive message. Latest replay ID: ${latestReplayId}`
                    );
                    data.latestReplayId = latestReplayId; // Replace original value with decoded value
                    subscribeCallback(
                        subscription.info,
                        SubscribeCallbackType.GRPC_KEEP_ALIVE
                    );
                }
            });
            grpcSubscription.on('end', () => {
                this.#subscriptions.delete(topicName);
                this.#logger.info(`${topicName} - gRPC stream ended`);
                subscribeCallback(subscription.info, SubscribeCallbackType.END);
            });
            grpcSubscription.on('error', (error) => {
                this.#logger.error(
                    `${topicName} - gRPC stream error: ${JSON.stringify(error)}`
                );
                subscribeCallback(
                    subscription.info,
                    SubscribeCallbackType.ERROR,
                    error
                );
            });
            grpcSubscription.on('status', (status) => {
                this.#logger.info(
                    `${topicName} - gRPC stream status: ${JSON.stringify(status)}`
                );
                subscribeCallback(
                    subscription.info,
                    SubscribeCallbackType.GRPC_STATUS,
                    status
                );
            });

            grpcSubscription.write(subscribeRequest);
            this.#logger.info(
                `${topicName} - Subscribe request sent for ${numRequested} events`
            );
        } catch (error) {
            throw new Error(
                `Failed to subscribe to events for topic ${topicName}`,
                { cause: error }
            );
        }
    }

    /**
     * Request additional events on an existing subscription.
     * @param {string} topicName topic name
     * @param {number} numRequested number of events requested.
     */
    requestAdditionalEvents(topicName, numRequested) {
        // Retrieve existing subscription
        const subscription = this.#subscriptions.get(topicName);
        if (!subscription) {
            throw new Error(
                `Failed to request additional events for topic ${topicName}, no active subscription found.`
            );
        }

        // Request additional events
        subscription.info.receivedEventCount = 0;
        subscription.info.requestedEventCount = numRequested;
        subscription.grpcSubscription.write({
            topicName,
            numRequested: numRequested
        });
        this.#logger.debug(
            `${topicName} - Resubscribing to a batch of ${numRequested} events`
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
            this.#logger.debug(
                `${topicName} - Preparing to publish event: ${toJsonString(payload)}`
            );
            if (!this.#client) {
                throw new Error('Pub/Sub API client is not connected.');
            }
            const schema =
                await this.#fetchEventSchemaFromTopicNameWithClient(topicName);

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
        this.#logger.info('Clear subscriptions');
        this.#subscriptions.clear();

        this.#logger.info('Closing gRPC stream');
        this.#client?.close();
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
            // Query topic to obtain schema ID
            this.#client.GetTopic(
                { topicName },
                async (topicError, response) => {
                    if (topicError) {
                        reject(topicError);
                    } else {
                        // Get the schema information
                        const { schemaId } = response;
                        this.#logger.debug(
                            `${topicName} - Retrieving schema ID: ${schemaId}`
                        );
                        // Check cache for schema thanks to ID
                        let schema = this.#schemaChache.getFromId(schemaId);
                        if (!schema) {
                            // Fetch schema with gRPC client
                            schema =
                                await this.#fetchEventSchemaFromIdWithClient(
                                    schemaId
                                );
                        }
                        // Add schema to cache
                        this.#schemaChache.set(schema);
                        resolve(schema);
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
