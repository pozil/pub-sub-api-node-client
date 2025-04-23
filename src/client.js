import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';

import avro from 'avro-js';
import certifi from 'certifi';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
// eslint-disable-next-line no-unused-vars
import { connectivityState } from '@grpc/grpc-js';

import {
    AuthType,
    SubscribeCallbackType,
    EventSubscriptionAdminState,
    PublishCallbackType
} from './utils/types.js';
import EventParseError from './utils/eventParseError.js';
import { CustomLongAvroType } from './utils/avroHelper.js';
import ConfigurationLoader from './utils/configurationLoader.js';
import {
    parseEvent,
    encodeReplayId,
    decodeReplayId,
    toJsonString
} from './utils/eventParser.js';
import { getManagedSubscription } from './utils/toolingApiHelper.js';
import SalesforceAuth from './utils/auth.js';

/**
 * @typedef {import('./utils/types.js').Configuration} Configuration
 * @typedef {import('./utils/types.js').Logger} Logger
 * @typedef {import('./utils/types.js').ProducerEvent} ProducerEvent
 * @typedef {import('./utils/types.js').PublishCallback} PublishCallback
 * @typedef {import('./utils/types.js').PublishStream} PublishStream
 * @typedef {import('./utils/types.js').PublishStreamInfo} PublishStreamInfo
 * @typedef {import('./utils/types.js').PublishResult} PublishResult
 * @typedef {import('./utils/types.js').Schema} Schema
 * @typedef {import('./utils/types.js').SubscribeCallback} SubscribeCallback
 * @typedef {import('./utils/types.js').SubscribeRequest} SubscribeRequest
 * @typedef {import('./utils/types.js').Subscription} Subscription
 * @typedef {import('./utils/types.js').SubscriptionInfo} SubscriptionInfo
 */

/**
 * Maximum event batch size suppported by the Pub/Sub API as documented here:
 * https://developer.salesforce.com/docs/platform/pub-sub-api/guide/flow-control.html
 */
const MAX_EVENT_BATCH_SIZE = 100;

/**
 * Client for the Salesforce Pub/Sub API
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
     * Map of schemas indexed by ID
     * @type {Map<string,Schema>}
     */
    #schemas;

    /**
     * Map of subscriptions indexed by topic name
     * @type {Map<string,Subscription>}
     */
    #subscriptions;

    /**
     * Map of managed subscriptions indexed by subscription ID
     * @type {Map<string,Subscription>}
     */
    #managedSubscriptions;

    /**
     * Map of publish streams indexed by topic name
     * @type {Map<string,PublishStream>}
     */
    #publishStreams;

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
        this.#schemas = new Map();
        this.#subscriptions = new Map();
        this.#managedSubscriptions = new Map();
        this.#publishStreams = new Map();
        // Check and load config
        try {
            this.#config = ConfigurationLoader.load(config);
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
                grpc.credentials.createSsl(rootCert, null, null, {
                    rejectUnauthorized: this.#config.rejectUnauthorizedSsl
                }),
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
     * Gets the gRPC connectivity state from the current channel.
     * @returns {Promise<connectivityState>} Promise that holds channel's connectivity information {@link connectivityState}
     */
    async getConnectivityState() {
        return this.#client?.getChannel()?.getConnectivityState(false);
    }

    /**
     * Subscribes to a topic and retrieves all past events in retention window.
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {SubscribeCallback} subscribeCallback callback function for handling subscription events
     * @param {number | null} [numRequested] optional number of events requested. If not supplied or null, the client keeps the subscription alive forever.
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
            `Preparing subscribe request: ${toJsonString(subscribeRequest)}`
        );
        if (!this.#client) {
            throw new Error('Pub/Sub API client is not connected.');
        }
        let { topicName, numRequested } = subscribeRequest;
        try {
            // Check number of requested events
            let isInfiniteEventRequest = false;
            if (numRequested === null || numRequested === undefined) {
                isInfiniteEventRequest = true;
                subscribeRequest.numRequested = numRequested =
                    MAX_EVENT_BATCH_SIZE;
            } else {
                subscribeRequest.numRequested =
                    this.#validateRequestedEventCount(topicName, numRequested);
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
                subscription.info.isInfiniteEventRequest =
                    isInfiniteEventRequest;
            } else {
                // Establish new gRPC subscription
                this.#logger.debug(
                    `${topicName} - Establishing new gRPC subscription`
                );
                grpcSubscription = this.#client.Subscribe();
                subscription = {
                    info: {
                        isManaged: false,
                        topicName,
                        requestedEventCount: subscribeRequest.numRequested,
                        receivedEventCount: 0,
                        lastReplayId: null,
                        isInfiniteEventRequest
                    },
                    grpcSubscription,
                    subscribeCallback
                };
                this.#subscriptions.set(topicName, subscription);
            }

            // Prepare event handling logic
            this.#injectEventHandlingLogic(subscription);

            // Write subscribe request
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
     * Subscribes to a topic thanks to a managed subscription.
     * @param {string} subscriptionIdOrName managed subscription ID or developer name
     * @param {SubscribeCallback} subscribeCallback callback function for handling subscription events
     * @param {number | null} [numRequested] optional number of events requested. If not supplied or null, the client keeps the subscription alive forever.
     * @throws Throws an error if the managed subscription does not exist or is not in the `RUN` state.
     */
    async subscribeWithManagedSubscription(
        subscriptionIdOrName,
        subscribeCallback,
        numRequested = null
    ) {
        this.#logger.debug(
            `Preparing managed subscribe request: ${toJsonString({ subscriptionIdOrName, numRequested })}`
        );
        if (!this.#client) {
            throw new Error('Pub/Sub API client is not connected.');
        }

        // Get managed subscription
        const managedSubscription = await getManagedSubscription(
            this.#config.instanceUrl,
            this.#config.accessToken,
            subscriptionIdOrName
        );
        const subscriptionId = managedSubscription.Id;
        const subscriptionName = managedSubscription.DeveloperName;
        const subscriptionLabel = `${subscriptionName} (${subscriptionId})`;
        const { topicName, state } = managedSubscription.Metadata;
        this.#logger.info(
            `Retrieved managed subscription ${subscriptionLabel}: ${toJsonString(managedSubscription.Metadata)}`
        );
        // Check subscription state
        if (state !== EventSubscriptionAdminState.RUN) {
            throw new Error(
                `Can't subscribe to managed subscription ${subscriptionLabel}: subscription is in ${state} state`
            );
        }

        try {
            // Check number of requested events
            let isInfiniteEventRequest = false;
            if (numRequested === null || numRequested === undefined) {
                isInfiniteEventRequest = true;
                numRequested = MAX_EVENT_BATCH_SIZE;
            } else {
                numRequested = this.#validateRequestedEventCount(
                    topicName,
                    numRequested
                );
            }
            // Check client connection
            if (!this.#client) {
                throw new Error('Pub/Sub API client is not connected.');
            }

            // Check for an existing subscription
            let subscription = this.#managedSubscriptions.get(subscriptionId);
            let grpcSubscription;
            if (subscription) {
                // Reuse existing gRPC connection and reset event counters
                this.#logger.debug(
                    `${topicName} - Reusing cached gRPC subscription`
                );
                grpcSubscription = subscription.grpcSubscription;
                subscription.info.receivedEventCount = 0;
                subscription.info.requestedEventCount = numRequested;
                subscription.info.isInfiniteEventRequest =
                    isInfiniteEventRequest;
            } else {
                // Establish new gRPC subscription
                this.#logger.debug(
                    `${topicName} - Establishing new gRPC subscription`
                );
                grpcSubscription = this.#client.ManagedSubscribe();
                subscription = {
                    info: {
                        isManaged: true,
                        topicName,
                        subscriptionId,
                        subscriptionName,
                        requestedEventCount: numRequested,
                        receivedEventCount: 0,
                        lastReplayId: null
                    },
                    grpcSubscription,
                    subscribeCallback
                };
                this.#managedSubscriptions.set(subscriptionId, subscription);
            }

            // Prepare event handling logic
            this.#injectEventHandlingLogic(subscription);

            // Write subscribe request
            grpcSubscription.write({
                subscriptionId,
                numRequested
            });
            this.#logger.info(
                `${topicName} - Managed subscribe request sent to ${subscriptionLabel} for ${numRequested} events`
            );
        } catch (error) {
            throw new Error(
                `Failed to subscribe to managed subscription ${subscriptionLabel}`,
                { cause: error }
            );
        }
    }

    /**
     * Request additional events on an existing subscription.
     * @param {string} topicName topic name
     * @param {number} numRequested number of events requested
     */
    requestAdditionalEvents(topicName, numRequested) {
        if (!this.#client) {
            throw new Error('Pub/Sub API client is not connected.');
        }
        // Retrieve subscription
        const subscription = this.#subscriptions.get(topicName);
        if (!subscription) {
            throw new Error(
                `Failed to request additional events for topic ${topicName}: no active subscription found.`
            );
        }

        // Request additional events
        subscription.info.receivedEventCount = 0;
        subscription.info.requestedEventCount = numRequested;
        subscription.grpcSubscription.write({
            topicName,
            numRequested
        });
        this.#logger.debug(
            `${topicName} - Resubscribing to a batch of ${numRequested} events`
        );
    }

    /**
     * Request additional events on an existing managed subscription.
     * @param {string} subscriptionId managed subscription ID
     * @param {number} numRequested number of events requested
     */
    requestAdditionalManagedEvents(subscriptionId, numRequested) {
        if (!this.#client) {
            throw new Error('Pub/Sub API client is not connected.');
        }
        // Retrieve subscription
        const subscription = this.#managedSubscriptions.get(subscriptionId);
        if (!subscription) {
            throw new Error(
                `Failed to request additional events for managed subscription with ID ${subscriptionId}: no active subscription found.`
            );
        }

        // Request additional events
        subscription.info.receivedEventCount = 0;
        subscription.info.requestedEventCount = numRequested;
        subscription.grpcSubscription.write({
            subscriptionId,
            numRequested
        });
        const { subscriptionName } = subscription.info;
        this.#logger.debug(
            `${subscriptionName} (${subscriptionId}) - Resubscribing to a batch of ${numRequested} events`
        );
    }

    /**
     * Commits a replay ID on a managed subscription.
     * @param {string} subscriptionId managed subscription ID
     * @param {number} replayId event replay ID
     * @returns {string} commit request UUID
     */
    commitReplayId(subscriptionId, replayId) {
        if (!this.#client) {
            throw new Error('Pub/Sub API client is not connected.');
        }
        // Retrieve subscription
        const subscription = this.#managedSubscriptions.get(subscriptionId);
        if (!subscription) {
            throw new Error(
                `Failed to commit a replay ID on managed subscription with ID ${subscriptionId}: no active subscription found.`
            );
        }

        // Commit replay ID
        const commitRequestId = crypto.randomUUID();
        subscription.grpcSubscription.write({
            subscriptionId,
            commitReplayIdRequest: {
                commitRequestId,
                replayId: encodeReplayId(replayId)
            }
        });
        const { subscriptionName } = subscription.info;
        this.#logger.debug(
            `${subscriptionName} (${subscriptionId}) - Sent replay ID commit request (request ID: ${commitRequestId}, replay ID: ${replayId})`
        );
        return commitRequestId;
    }

    /**
     * Publishes a payload to a topic using the gRPC client. This is a synchronous operation, use `publishBatch` when publishing event batches.
     * @param {string} topicName name of the topic that we're publishing on
     * @param {Object} payload payload of the event that is being published
     * @param {string} [correlationKey] optional correlation key. If you don't provide one, we'll generate a random UUID for you.
     * @returns {Promise<PublishResult>} Promise holding a PublishResult object with replayId and correlationKey
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
     * Publishes a batch of events using the gRPC client's publish stream.
     * @param {string} topicName name of the topic that we're publishing on
     * @param {ProducerEvent[]} events events to be published
     * @param {PublishCallback} publishCallback callback function for handling publish responses
     */
    async publishBatch(topicName, events, publishCallback) {
        try {
            this.#logger.debug(
                `${topicName} - Preparing to publish a batch of ${events.length} event(s): ${toJsonString(events)}`
            );
            if (!this.#client) {
                throw new Error('Pub/Sub API client is not connected.');
            }
            // Check for an existing publish stream
            let publishStream = this.#publishStreams.get(topicName);
            let grpcPublishStream;
            if (publishStream) {
                // Reuse existing gRPC stream
                this.#logger.debug(
                    `${topicName} - Reusing cached gRPC publish stream`
                );
                grpcPublishStream = publishStream.grpcPublishStream;
            } else {
                // Establish new gRPC stream
                this.#logger.debug(
                    `${topicName} - Establishing new gRPC publish stream`
                );
                grpcPublishStream = this.#client.PublishStream();
                publishStream = {
                    info: {
                        topicName
                    },
                    grpcPublishStream,
                    publishCallback
                };
                this.#publishStreams.set(topicName, publishStream);
            }

            // Get schema
            const schema =
                await this.#fetchEventSchemaFromTopicNameWithClient(topicName);

            // Set/reset event listeners
            grpcPublishStream.removeAllListeners();
            grpcPublishStream.on('data', async (data) => {
                if (data.results) {
                    // Decode replay IDs
                    data.results = data.results.map((result) => ({
                        replayId: decodeReplayId(result.replayId),
                        correlationKey: result.correlationKey
                    }));
                    this.#logger.info(
                        `${topicName} - Received batch publish response for ${data.results.length} events: ${toJsonString(data)}`
                    );
                    publishCallback(
                        publishStream.info,
                        PublishCallbackType.PUBLISH_RESPONSE,
                        data
                    );
                } else {
                    // If there are no results then, every 270 seconds (or less) the server publishes a keepalive message
                    this.#logger.debug(
                        `${topicName} - Received batch publish keepalive message: ${toJsonString(data)}`
                    );
                    publishCallback(
                        publishStream.info,
                        PublishCallbackType.GRPC_KEEP_ALIVE,
                        data
                    );
                }
            });
            grpcPublishStream.on('error', async (data) => {
                this.#logger.debug(
                    `${topicName} - Batch publish error: ${toJsonString(data)}`
                );
                publishCallback(
                    publishStream.info,
                    PublishCallbackType.ERROR,
                    data
                );
            });
            grpcPublishStream.on('status', (status) => {
                this.#logger.info(
                    `${topicName} - Batch publish gRPC stream status: ${toJsonString(status)}`
                );
                publishCallback(
                    publishStream.info,
                    PublishCallbackType.GRPC_STATUS,
                    status
                );
            });

            // Prepare events
            const eventBatch = events.map((baseEvent) => ({
                id: baseEvent.id ? baseEvent.id : crypto.randomUUID(), // Generate ID if not provided
                schemaId: schema.id,
                payload: schema.type.toBuffer(baseEvent.payload)
            }));

            // Write publish request
            grpcPublishStream.write({
                topicName,
                events: eventBatch
            });
            this.#logger.info(
                `${topicName} - Batch publish request sent with ${events.length} events`
            );
        } catch (error) {
            throw new Error(
                `Failed to publish event batch for topic ${topicName}`,
                {
                    cause: error
                }
            );
        }
    }

    /**
     * Closes the gRPC connection. The client will no longer receive events for any topic.
     */
    close() {
        this.#logger.info('Clear subscriptions and streams');
        this.#subscriptions.forEach((sub) =>
            sub.grpcSubscription.removeAllListeners()
        );
        this.#subscriptions.clear();
        this.#managedSubscriptions.forEach((sub) =>
            sub.grpcSubscription.removeAllListeners()
        );
        this.#managedSubscriptions.clear();
        this.#publishStreams.forEach((pub) =>
            pub.grpcPublishStream.removeAllListeners()
        );
        this.#publishStreams.clear();
        this.#schemas.clear();
        this.#logger.info('Closing gRPC client');
        this.#client?.close();
    }

    /**
     * Injects the standard event handling logic on a subscription
     * @param {Subscription} subscription
     */
    #injectEventHandlingLogic(subscription) {
        const { grpcSubscription, subscribeCallback } = subscription;
        const { topicName, subscriptionId, subscriptionName, isManaged } =
            subscription.info;
        const logLabel = subscription.info.isManaged
            ? `${subscriptionName} (${subscriptionId})`
            : topicName;
        // Set/reset event listeners
        grpcSubscription.removeAllListeners();
        grpcSubscription.on('data', async (data) => {
            const latestReplayId = decodeReplayId(data.latestReplayId);
            subscription.info.lastReplayId = latestReplayId;
            if (data.events) {
                this.#logger.info(
                    `${logLabel} - Received ${data.events.length} events, latest replay ID: ${latestReplayId}`
                );
                for (const event of data.events) {
                    try {
                        this.#logger.debug(
                            `${logLabel} - Raw event: ${toJsonString(event)}`
                        );
                        // Load event schema from cache or from the gRPC client
                        this.#logger.debug(
                            `${logLabel} - Retrieving schema ID: ${event.event.schemaId}`
                        );
                        const schema = await this.#getEventSchemaFromId(
                            event.event.schemaId
                        );
                        // Retrieve subscription
                        let subscription;
                        if (isManaged) {
                            subscription =
                                this.#managedSubscriptions.get(subscriptionId);
                        } else {
                            subscription = this.#subscriptions.get(topicName);
                        }
                        if (!subscription) {
                            throw new Error(
                                `Failed to retrieve ${isManaged ? 'managed ' : ''}subscription: ${logLabel}.`
                            );
                        }
                        subscription.info.receivedEventCount++;
                        // Parse event thanks to schema
                        const parsedEvent = parseEvent(schema, event);
                        this.#logger.debug(
                            `${logLabel} - Parsed event: ${toJsonString(parsedEvent)}`
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
                            `${logLabel} - Reached last of ${subscription.info.requestedEventCount} requested event on channel.`
                        );
                        if (subscription.info.isInfiniteEventRequest) {
                            // Request additional events
                            if (isManaged) {
                                this.requestAdditionalManagedEvents(
                                    subscription.info.subscriptionId,
                                    subscription.info.requestedEventCount
                                );
                            } else {
                                this.requestAdditionalEvents(
                                    subscription.info.topicName,
                                    subscription.info.requestedEventCount
                                );
                            }
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
                    `${logLabel} - Received keepalive message. Latest replay ID: ${latestReplayId}`
                );
                data.latestReplayId = latestReplayId; // Replace original value with decoded value
                subscribeCallback(
                    subscription.info,
                    SubscribeCallbackType.GRPC_KEEP_ALIVE
                );
            }
        });
        grpcSubscription.on('end', () => {
            if (isManaged) {
                this.#managedSubscriptions.delete(subscriptionId);
            } else {
                this.#subscriptions.delete(topicName);
            }
            this.#logger.info(`${logLabel} - gRPC stream ended`);
            subscribeCallback(subscription.info, SubscribeCallbackType.END);
        });
        grpcSubscription.on('error', (error) => {
            this.#logger.error(
                `${logLabel} - gRPC stream error: ${toJsonString(error)}`
            );
            subscribeCallback(
                subscription.info,
                SubscribeCallbackType.ERROR,
                error
            );
        });
        grpcSubscription.on('status', (status) => {
            this.#logger.info(
                `${logLabel} - gRPC stream status: ${toJsonString(status)}`
            );
            subscribeCallback(
                subscription.info,
                SubscribeCallbackType.GRPC_STATUS,
                status
            );
        });
    }

    /**
     * Retrieves an event schema from the cache based on its ID.
     * If it's not cached, fetches the shema with the gRPC client.
     * @param {string} schemaId ID of the schema that we're fetching
     * @returns {Promise<Schema>} Promise holding parsed event schema
     */
    async #getEventSchemaFromId(schemaId) {
        let schema = this.#schemas.get(schemaId);
        if (!schema) {
            try {
                schema = await this.#fetchEventSchemaFromIdWithClient(schemaId);
                this.#schemas.set(schema.id, schema);
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
                        let schema = this.#schemas.get(schemaId);
                        if (!schema) {
                            // Fetch schema with gRPC client
                            schema =
                                await this.#fetchEventSchemaFromIdWithClient(
                                    schemaId
                                );
                        }
                        // Add schema to cache
                        this.#schemas.set(schema.id, schema);
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

    /**
     * Validates the number of requested events
     * @param {string} topicName for logging purposes
     * @param {number} numRequested number of requested events
     * @returns safe value for number of requested events
     */
    #validateRequestedEventCount(topicName, numRequested) {
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
            return MAX_EVENT_BATCH_SIZE;
        }
        return numRequested;
    }
}
