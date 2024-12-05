import fs from 'fs';
import * as dotenv from 'dotenv';
import PubSubApiClient from '../../src/client.js';
import { AuthType } from '../../src/utils/types.js';
import {
    getSalesforceConnection,
    getSampleAccount,
    updateSampleAccount
} from '../helper/sfUtilities.js';
import SimpleFileLogger from '../helper/simpleFileLogger.js';
import injectJasmineReporter from '../helper/reporter.js';
import { sleep, waitFor } from '../helper/asyncUtilities.js';
import { getConnectedPubSubApiClient } from '../helper/clientUtilities.js';

// Load config from .env file
dotenv.config();

// Prepare logger
let logger;
if (process.env.TEST_LOGGER === 'simpleFileLogger') {
    logger = new SimpleFileLogger('test.log', 'debug');
    logger.clear();
    injectJasmineReporter(logger);
} else {
    logger = console;
}

const EXTENDED_JASMINE_TIMEOUT = 10000;
const PLATFORM_EVENT_TOPIC = '/event/Sample__e';
const CHANGE_EVENT_TOPIC = '/data/AccountChangeEvent';

describe('Client', function () {
    /**
     * Pub/Sub API client
     * @type {PubSubApiClient}
     */
    var client;

    afterEach(async () => {
        if (client) {
            client.close();
            await sleep(500);
        }
    });

    it(
        'supports user supplied auth with platform event',
        async function () {
            let receivedEvent, receivedSub;

            // Establish connection with jsforce
            const sfConnection = await getSalesforceConnection();

            // Build PubSub client with existing connection
            client = new PubSubApiClient(
                {
                    authType: AuthType.USER_SUPPLIED,
                    accessToken: sfConnection.accessToken,
                    instanceUrl: sfConnection.instanceUrl,
                    organizationId: sfConnection.userInfo.organizationId
                },
                logger
            );
            await client.connect();

            // Prepare callback & send subscribe request
            const callback = (subscription, callbackType, data) => {
                if (callbackType === 'event') {
                    receivedEvent = data;
                    receivedSub = subscription;
                }
            };
            client.subscribe(PLATFORM_EVENT_TOPIC, callback, 1);

            // Wait for subscribe to be effective
            await sleep(1000);

            // Publish platform event
            const payload = {
                CreatedDate: new Date().getTime(), // Non-null value required but there's no validity check performed on this field
                CreatedById: '00558000000yFyDAAU', // Valid user ID
                Message__c: { string: 'Hello world' } // Field is nullable so we need to specify the 'string' type
            };
            const publishResult = await client.publish(
                PLATFORM_EVENT_TOPIC,
                payload
            );
            expect(publishResult.replayId).toBeDefined();
            const publishedReplayId = publishResult.replayId;

            // Wait for event to be received
            await waitFor(5000, () => receivedEvent !== undefined);

            // Check received event and subcription info
            expect(receivedEvent?.replayId).toBe(publishedReplayId);
            expect(receivedSub?.topicName).toBe(PLATFORM_EVENT_TOPIC);
            expect(receivedSub?.receivedEventCount).toBe(1);
            expect(receivedSub?.requestedEventCount).toBe(1);
        },
        EXTENDED_JASMINE_TIMEOUT
    );

    it(
        'supports user supplied auth with change event',
        async function () {
            let receivedEvent, receivedSub;

            // Establish connection with jsforce
            const sfConnection = await getSalesforceConnection();

            // Build PubSub client with existing connection
            client = new PubSubApiClient(
                {
                    authType: AuthType.USER_SUPPLIED,
                    accessToken: sfConnection.accessToken,
                    instanceUrl: sfConnection.instanceUrl,
                    organizationId: sfConnection.userInfo.organizationId
                },
                logger
            );
            await client.connect();

            // Prepare callback & send subscribe request
            const callback = (subscription, callbackType, data) => {
                if (callbackType === 'event') {
                    receivedEvent = data;
                    receivedSub = subscription;
                }
            };
            client.subscribe(CHANGE_EVENT_TOPIC, callback, 1);

            // Wait for subscribe to be effective
            await sleep(1000);

            // Update sample record
            const account = await getSampleAccount();
            account.BillingCity = 'SFO' + Math.random();
            await updateSampleAccount(account);

            // Wait for event to be received
            await waitFor(5000, () => receivedEvent !== undefined);

            // Check received event and subcription info
            expect(receivedEvent?.replayId).toBeDefined();
            expect(receivedSub?.topicName).toBe(CHANGE_EVENT_TOPIC);
            expect(receivedSub?.receivedEventCount).toBe(1);
            expect(receivedSub?.requestedEventCount).toBe(1);
            expect(receivedEvent.payload.ChangeEventHeader.entityName).toBe(
                'Account'
            );
            expect(receivedEvent.payload.ChangeEventHeader.recordIds[0]).toBe(
                account.Id
            );
            expect(
                receivedEvent.payload.ChangeEventHeader.changedFields.includes(
                    'BillingAddress.City'
                )
            ).toBeTrue();
            expect(receivedEvent.payload.BillingAddress.City).toBe(
                account.BillingCity
            );
        },
        EXTENDED_JASMINE_TIMEOUT
    );

    it(
        'supports usermame/password auth with platform event',
        async function () {
            let receivedEvent, receivedSub;

            // Build PubSub client
            client = new PubSubApiClient(
                {
                    authType: AuthType.USERNAME_PASSWORD,
                    loginUrl: process.env.SALESFORCE_LOGIN_URL,
                    username: process.env.SALESFORCE_USERNAME,
                    password: process.env.SALESFORCE_PASSWORD,
                    userToken: process.env.SALESFORCE_TOKEN
                },
                logger
            );
            await client.connect();

            // Prepare callback & send subscribe request
            const callback = (subscription, callbackType, data) => {
                if (callbackType === 'event') {
                    receivedEvent = data;
                    receivedSub = subscription;
                }
            };
            client.subscribe(PLATFORM_EVENT_TOPIC, callback, 1);

            // Wait for subscribe to be effective
            await sleep(1000);

            // Publish platform event
            const payload = {
                CreatedDate: new Date().getTime(), // Non-null value required but there's no validity check performed on this field
                CreatedById: '00558000000yFyDAAU', // Valid user ID
                Message__c: { string: 'Hello world' } // Field is nullable so we need to specify the 'string' type
            };
            const publishResult = await client.publish(
                PLATFORM_EVENT_TOPIC,
                payload
            );
            expect(publishResult.replayId).toBeDefined();
            const publishedReplayId = publishResult.replayId;

            // Wait for event to be received
            await waitFor(5000, () => receivedEvent !== undefined);

            // Check received event and subcription info
            expect(receivedEvent?.replayId).toBe(publishedReplayId);
            expect(receivedSub?.topicName).toBe(PLATFORM_EVENT_TOPIC);
            expect(receivedSub?.receivedEventCount).toBe(1);
            expect(receivedSub?.requestedEventCount).toBe(1);
        },
        EXTENDED_JASMINE_TIMEOUT
    );

    it(
        'supports client credentials OAuth flow with platform event',
        async function () {
            let receivedEvent, receivedSub;

            // Build PubSub client
            client = new PubSubApiClient(
                {
                    authType: AuthType.OAUTH_CLIENT_CREDENTIALS,
                    loginUrl: process.env.SALESFORCE_LOGIN_URL,
                    clientId: process.env.SALESFORCE_CLIENT_ID,
                    clientSecret: process.env.SALESFORCE_CLIENT_SECRET
                },
                logger
            );
            await client.connect();

            // Prepare callback & send subscribe request
            const callback = (subscription, callbackType, data) => {
                if (callbackType === 'event') {
                    receivedEvent = data;
                    receivedSub = subscription;
                }
            };
            client.subscribe(PLATFORM_EVENT_TOPIC, callback, 1);

            // Wait for subscribe to be effective
            await sleep(1000);

            // Publish platform event
            const payload = {
                CreatedDate: new Date().getTime(), // Non-null value required but there's no validity check performed on this field
                CreatedById: '00558000000yFyDAAU', // Valid user ID
                Message__c: { string: 'Hello world' } // Field is nullable so we need to specify the 'string' type
            };
            const publishResult = await client.publish(
                PLATFORM_EVENT_TOPIC,
                payload
            );
            expect(publishResult.replayId).toBeDefined();
            const publishedReplayId = publishResult.replayId;

            // Wait for event to be received
            await waitFor(5000, () => receivedEvent !== undefined);

            // Check received event and subcription info
            expect(receivedEvent?.replayId).toBe(publishedReplayId);
            expect(receivedSub?.topicName).toBe(PLATFORM_EVENT_TOPIC);
            expect(receivedSub?.receivedEventCount).toBe(1);
            expect(receivedSub?.requestedEventCount).toBe(1);
        },
        EXTENDED_JASMINE_TIMEOUT
    );

    it(
        'supports JWT OAuth flow with platform event',
        async function () {
            let receivedEvent, receivedSub;

            // Read private key and remove potential invalid characters from key
            const privateKey = fs.readFileSync(
                process.env.SALESFORCE_PRIVATE_KEY_PATH
            );

            // Build PubSub client
            client = new PubSubApiClient(
                {
                    authType: AuthType.OAUTH_JWT_BEARER,
                    loginUrl: process.env.SALESFORCE_JWT_LOGIN_URL,
                    clientId: process.env.SALESFORCE_JWT_CLIENT_ID,
                    username: process.env.SALESFORCE_USERNAME,
                    privateKey
                },
                logger
            );
            await client.connect();

            // Prepare callback & send subscribe request
            const callback = (subscription, callbackType, data) => {
                if (callbackType === 'event') {
                    receivedEvent = data;
                    receivedSub = subscription;
                }
            };
            client.subscribe(PLATFORM_EVENT_TOPIC, callback, 1);

            // Wait for subscribe to be effective
            await sleep(1000);

            // Publish platform event
            const payload = {
                CreatedDate: new Date().getTime(), // Non-null value required but there's no validity check performed on this field
                CreatedById: '00558000000yFyDAAU', // Valid user ID
                Message__c: { string: 'Hello world' } // Field is nullable so we need to specify the 'string' type
            };
            const publishResult = await client.publish(
                PLATFORM_EVENT_TOPIC,
                payload
            );
            expect(publishResult.replayId).toBeDefined();
            const publishedReplayId = publishResult.replayId;

            // Wait for event to be received
            await waitFor(5000, () => receivedEvent !== undefined);

            // Check received event and subcription info
            expect(receivedEvent?.replayId).toBe(publishedReplayId);
            expect(receivedSub?.topicName).toBe(PLATFORM_EVENT_TOPIC);
            expect(receivedSub?.receivedEventCount).toBe(1);
            expect(receivedSub?.requestedEventCount).toBe(1);
        },
        EXTENDED_JASMINE_TIMEOUT
    );

    it(
        'supports querying for additional events',
        async function () {
            let receivedEvents = [];
            let hasRequestedAdditionalEvents = false;

            // Build PubSub client
            client = await getConnectedPubSubApiClient(logger);

            // Prepare callback & send subscribe request
            const callback = async (subscription, callbackType, data) => {
                if (callbackType === 'event') {
                    receivedEvents.push(data);
                } else if (callbackType === 'lastEvent') {
                    // Request another event, the first time we receive the "last event" callback
                    if (!hasRequestedAdditionalEvents) {
                        client.requestAdditionalEvents(
                            subscription.topicName,
                            1
                        );
                        hasRequestedAdditionalEvents = true;
                        // Wait for request to be effective
                        await sleep(1000);
                    }
                }
            };
            client.subscribe(PLATFORM_EVENT_TOPIC, callback, 1);

            // Wait for subscribe to be effective
            await sleep(1000);

            // Prepare platform event payload
            const payload = {
                CreatedDate: new Date().getTime(), // Non-null value required but there's no validity check performed on this field
                CreatedById: '00558000000yFyDAAU', // Valid user ID
                Message__c: { string: 'Event 1/2' } // Field is nullable so we need to specify the 'string' type
            };

            // Publish 1st platform event
            let publishResult = await client.publish(
                PLATFORM_EVENT_TOPIC,
                payload
            );
            expect(publishResult.replayId).toBeDefined();
            const publishedReplayId1 = publishResult.replayId;
            // Publish 2nd platform event
            payload.Message__c.string = 'Event 2/2';
            publishResult = await client.publish(PLATFORM_EVENT_TOPIC, payload);
            expect(publishResult.replayId).toBeDefined();
            const publishedReplayId2 = publishResult.replayId;

            // Wait for event to be received
            await waitFor(5000, () => receivedEvents.length === 2);

            // Check received events
            expect(hasRequestedAdditionalEvents)
                .withContext('Did not request additional events')
                .toBeTrue();
            expect(
                receivedEvents.some((e) => e.replayId === publishedReplayId1)
            ).toBeTrue();
            expect(
                receivedEvents.some((e) => e.replayId === publishedReplayId2)
            ).toBeTrue();
        },
        EXTENDED_JASMINE_TIMEOUT
    );
});
