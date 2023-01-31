import crypto from 'crypto';
import { EventEmitter } from 'events';
import fs from 'fs';
import { fileURLToPath } from 'url';

import avro from 'avro-js';
import certifi from 'certifi';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

import Configuration from './configuration.js';
import { parseEvent, encodeReplayId, decodeReplayId } from './eventParser.js';
import SalesforceAuth from './auth.js';

/**
 * @typedef {Object} Schema
 * @property {string} id
 * @property {Object} type
 */

/**
 * @typedef {Object} PublishResult
 * @property {number} replayId
 * @property {string} correlationKey
 */

/**
 * @typedef {Object} Logger
 * @property {Function} debug
 * @property {Function} info
 * @property {Function} error
 */

/**
 * Client for the Salesforce Pub/Sub API
 */
export default class PubSubApiClient {
    /**
     * gRPC client
     * @type {Object}
     */
    #client;

    /**
     * Map of schemas indexed by topic name
     * @type {Map<string,Schema>}
     */
    #schemaChache;

    #logger;

    /**
     * Builds a new Pub/Sub API client
     * @param {Logger} logger an optional custom logger. The client uses the console if no value is supplied.
     */
    constructor(logger = console) {
        this.#logger = logger;
        this.#schemaChache = new Map();
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
     * Authenticates with Salesforce then, connects to the Pub/Sub API
     * @returns {Promise<void>} Promise that resolves once the connection is established
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
     * Connects to the Pub/Sub API with user-supplied authentication
     * @param {string} accessToken
     * @param {string} instanceUrl
     * @param {string} organizationId
     * @param {string} username
     * @returns {Promise<void>} Promise that resolves once the connection is established
     */
    async connectWithAuth(accessToken, instanceUrl, organizationId, username) {
        return this.#connectToPubSubApi({
            accessToken,
            instanceUrl,
            organizationId,
            username
        });
    }

    /**
     * Connects to the Pub/Sub API
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
     * Subscribes to a topic and retrieves all past events in retention window
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {number} numRequested number of events requested
     * @param {number} replayId replay ID
     * @returns {Promise<EventEmitter>} Promise that holds an emitter that allows you to listen to received events and stream lifecycle events
     */
    async subscribeFromEarliestEvent(topicName, numRequested) {
        return this.#subscribe({
            topicName,
            numRequested,
            replayPreset: 1
        });
    }

    /**
     * Subscribes to a topic and retrieve past events starting from a replay ID
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {number} numRequested number of events requested
     * @param {number} replayId replay ID
     * @returns {Promise<EventEmitter>} Promise that holds an emitter that allows you to listen to received events and stream lifecycle events
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
     * Subscribes to a topic
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {number} numRequested number of events requested
     * @returns {Promise<EventEmitter>} Promise that holds an emitter that allows you to listen to received events and stream lifecycle events
     */
    async subscribe(topicName, numRequested) {
        return this.#subscribe({
            topicName,
            numRequested
        });
    }

    /**
     * Subscribes to a topic using the gRPC client and an event schema
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {number} numRequested number of events requested
     * @return {EventEmitter} emitter that allows you to listen to received events and stream lifecycle events
     */
    async #subscribe(subscribeRequest) {
        try {
            if (!this.#client) {
                throw new Error('Pub/Sub API client is not connected.');
            }
            const schema = await this.#getEventSchema(
                subscribeRequest.topicName
            );

            const subscription = this.#client.Subscribe();
            subscription.write(subscribeRequest);
            this.#logger.info(
                `Subscribe request sent for ${subscribeRequest.numRequested} events from ${subscribeRequest.topicName}...`
            );

            // Listen to new events
            const eventEmitter = new EventEmitter();
            subscription.on('data', (data) => {
                if (data.events) {
                    const latestReplayId = decodeReplayId(data.latestReplayId);
                    this.#logger.info(
                        `Received ${data.events.length} events, latest replay ID: ${latestReplayId}`
                    );
                    data.events.forEach((event) => {
                        const parsedEvent = parseEvent(schema, event);
                        this.#logger.debug(parsedEvent);
                        eventEmitter.emit('data', parsedEvent);
                    });
                } else {
                    // If there are no events then every 270 seconds the system will keep publishing the latestReplayId.
                }
            });
            subscription.on('end', () => {
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
                `Failed to subscribe to events for topic ${subscribeRequest.topicName}`,
                { cause: error }
            );
        }
    }

    /**
     * Publishes a payload to a topic using the gRPC client
     * @param {string} topicName name of the topic that we're subscribing to
     * @param {Object} payload
     * @param {string} [correlationKey] optional correlation key. If you don't provide one, we'll generate a random UUID for you.
     * @returns {Promise<PublishResult>} Promise holding a PublishResult object with replayId and correlationKey
     */
    async publish(topicName, payload, correlationKey) {
        try {
            if (!this.#client) {
                throw new Error('Pub/Sub API client is not connected.');
            }
            const schema = await this.#getEventSchema(topicName);

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
     */
    close() {
        this.#logger.info('closing gRPC stream');
        this.#client.close();
    }

    /**
     * Retrieves the event schema for a topic from the cache.
     * If it's not cached, fetches the shema with the gRPC client.
     * @param {string} topicName name of the topic that we're fetching
     * @returns {Promise<Schema>} Promise holding parsed event schema
     */
    async #getEventSchema(topicName) {
        let schema = this.#schemaChache.get(topicName);
        if (!schema) {
            try {
                schema = await this.#fetchEventSchemaWithClient(topicName);
                this.#schemaChache.set(topicName, schema);
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
     * Requests the event schema for a topic using the gRPC client
     * @param {string} topicName name of the topic that we're fetching
     * @returns {Promise<Schema>} Promise holding parsed event schema
     */
    async #fetchEventSchemaWithClient(topicName) {
        return new Promise((resolve, reject) => {
            this.#client.GetTopic({ topicName }, (topicError, response) => {
                if (topicError) {
                    reject(topicError);
                } else {
                    // Get the schema information
                    const { schemaId } = response;
                    this.#client.GetSchema({ schemaId }, (schemaError, res) => {
                        if (schemaError) {
                            reject(schemaError);
                        } else {
                            const schemaType = avro.parse(res.schemaJson);
                            this.#logger.info(
                                `Topic schema loaded: ${topicName}`
                            );
                            resolve({
                                id: schemaId,
                                type: schemaType
                            });
                        }
                    });
                }
            });
        });
    }
}
