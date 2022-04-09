// This project is derived from a [blog post](https://jungleeforce.com/2021/11/11/connecting-to-salesforce-using-pub-sub-api-grpc/) from techinjungle.
// Official Pub/Sub API pilot repo: https://github.com/developerforce/pub-sub-api-pilot

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const fs = require('fs');
const jsforce = require('jsforce');
const avro = require('avro-js');
const certifi = require('certifi');

// Load config from .env file
require('dotenv').config();
const {
    SALESFORCE_LOGIN_URL,
    SALESFORCE_USERNAME,
    SALESFORCE_PASSWORD,
    SALESFORCE_TOKEN,
    PUB_SUB_ENDPOINT,
    PROTO_FILE,
    TOPIC_NAME,
    EVENT_RECEIVE_LIMIT
} = process.env;

// Load GRPC
const packageDef = protoLoader.loadSync(PROTO_FILE, {});
const grpcObj = grpc.loadPackageDefinition(packageDef);
const sfdcPackage = grpcObj.eventbus.v1;

/**
 * Connects to Salesforce using jsForce
 * This is required to obtain an access token that the Pub/Sub API uses.
 * @returns the connection information required by the Pub/Sub API
 */
async function connectToSalesforce() {
    const conn = new jsforce.Connection({
        loginUrl: SALESFORCE_LOGIN_URL
    });
    const loginResult = await conn.login(
        SALESFORCE_USERNAME,
        SALESFORCE_PASSWORD + SALESFORCE_TOKEN
    );
    console.log(
        `Connected to Salesforce org ${loginResult.organizationId}: ${conn.instanceUrl}`
    );
    return {
        organizationId: loginResult.organizationId,
        instanceUrl: conn.instanceUrl,
        accessToken: conn.accessToken
    };
}

/**
 * Connects to the Pub/Sub API and returns a gRPC client
 * @param {Object} connectionInfo the connection information required by the Pub/Sub API
 * @param {string} connectionInfo.organizationId
 * @param {string} connectionInfo.instanceUrl
 * @param {string} connectionInfo.accessToken
 * @returns a gRPC client
 */
function connectToPubSubApi(connectionInfo) {
    const metaCallback = (_params, callback) => {
        const meta = new grpc.Metadata();
        meta.add('accesstoken', connectionInfo.accessToken);
        meta.add('instanceurl', connectionInfo.instanceUrl);
        meta.add('tenantid', connectionInfo.organizationId);
        callback(null, meta);
    };

    const rootCert = fs.readFileSync(certifi);

    const callCreds =
        grpc.credentials.createFromMetadataGenerator(metaCallback);
    const combCreds = grpc.credentials.combineChannelCredentials(
        grpc.credentials.createSsl(rootCert),
        callCreds
    );

    const client = new sfdcPackage.PubSub(PUB_SUB_ENDPOINT, combCreds);
    console.log(`Connected to Pub/Sub API`);
    return client;
}

/**
 * Requests the event schema for a topic
 * @param {Object} client Pub/Sub API gRPC client
 * @param {string} topicName name of the topic that we're fetching
 * @returns {Object} parsed event schema `{id: string, type: Object}`
 */
async function getEventSchema(client, topicName) {
    return new Promise((resolve, reject) => {
        client.GetTopic({ topicName }, (err, response) => {
            if (err) {
                // Handle error
                reject(err);
            } else {
                //get the schema information
                const schemaId = response.schemaId;
                client.GetSchema({ schemaId }, (error, res) => {
                    if (error) {
                        // Handle error
                        reject(err);
                    } else {
                        const schemaType = avro.parse(res.schemaJson);
                        console.log(`Topic schema loaded: ${topicName}`);
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

/**
 * Subscribes to a topic using the gRPC client and an event schema
 * @param {Object} client Pub/Sub API gRPC client
 * @param {string} topicName name of the topic that we're subscribing to
 * @param {Object} schema event schema associated with the topic
 * @param {string} schema.id
 * @param {Object} schema.type
 */
function subscribe(client, topicName, schema) {
    const subscription = client.Subscribe(); //client here is the grpc client.
    //Since this is a stream, you can call the write method multiple times.
    //Only the required data is being passed here, the topic name & the numReqested
    //Once the system has received the events == to numReqested then the stream will end.
    const subscribeRequest = {
        topicName,
        numRequested: EVENT_RECEIVE_LIMIT
    };
    subscription.write(subscribeRequest);
    console.log(
        `Pub/Sub subscribe request sent for ${subscribeRequest.numRequested} events...`
    );

    // Listen to new events.
    subscription.on('data', (data) => {
        if (data.events) {
            const latestReplayId = data.latestReplayId.readBigUInt64BE();
            console.log(
                `Received ${data.events.length} events, latest replay ID: ${latestReplayId}`
            );
            const parsedEvents = data.events.map((event) => {
                const replayId = event.replayId.readBigUInt64BE().toString();
                const payload = schema.type.fromBuffer(event.event.payload); // This schema is the same which we retreived earlier in the GetSchema rpc.
                return {
                    replayId,
                    payload
                };
            });
            console.log(
                'gRPC event payloads: ',
                JSON.stringify(parsedEvents, null, 2)
            );
        } else {
            // If there are no events then every 270 seconds the system will keep publishing the latestReplayId.
        }
    });
    subscription.on('end', () => {
        console.log('gRPC stream ended');
    });
    subscription.on('error', (err) => {
        // Handle errors
        console.error('gRPC stream error: ', JSON.stringify(err));
    });
    subscription.on('status', (status) => {
        console.log('gRPC stream status: ', status);
    });
}

/**
 * Publishes a payload to a topic using the gRPC client
 * @param {Object} client Pub/Sub API gRPC client
 * @param {string} topicName name of the topic that we're subscribing to
 * @param {Object} schema event schema associated with the topic
 * @param {string} schema.id
 * @param {Object} schema.type
 * @param {Object} payload
 */
async function publish(client, topicName, schema, payload) {
    return new Promise((resolve, reject) => {
        client.Publish(
            {
                topicName,
                events: [
                    {
                        id: '124', // this can be any string
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
}

async function run() {
    try {
        const connectionInfo = await connectToSalesforce();
        const client = connectToPubSubApi(connectionInfo);
        const topicSchema = await getEventSchema(client, TOPIC_NAME);
        subscribe(client, TOPIC_NAME, topicSchema);
    } catch (err) {
        console.error('Fatal error: ', err);
    }
}

run();
