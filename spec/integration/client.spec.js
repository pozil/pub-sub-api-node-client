import fs from 'fs';
import * as dotenv from 'dotenv';
import PubSubApiClient from '../../src/client.js';
import { AuthType } from '../../src/utils/configuration.js';
import {
    getSalesforceConnection,
    getSampleAccount,
    updateSampleAccount
} from '../helper/sfUtility.js';
import SimpleFileLogger from '../helper/simpleFileLogger.js';
import injectJasmineReporter from '../helper/reporter.js';

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

const PLATFORM_EVENT_TOPIC = '/event/Sample__e';
const CHANGE_EVENT_TOPIC = '/data/AccountChangeEvent';

async function sleep(duration) {
    return new Promise((resolve) => setTimeout(() => resolve(), duration));
}

async function waitFor(timeoutDuration, checkFunction) {
    return new Promise((resolve, reject) => {
        let checkInterval;
        const waitTimeout = setTimeout(() => {
            clearInterval(checkInterval);
            reject();
        }, timeoutDuration);
        checkInterval = setInterval(() => {
            if (checkFunction()) {
                clearTimeout(waitTimeout);
                clearInterval(checkInterval);
                resolve();
            }
        }, 100);
    });
}

describe('Client', function () {
    var client;

    afterEach(async () => {
        if (client) {
            client.close();
            await sleep(500);
        }
    });

    it('supports user supplied auth with platform event', async function () {
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
    });

    it('supports user supplied auth with change event', async function () {
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
        await waitFor(3000, () => receivedEvent !== undefined);

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
    });

    it('supports usermame/password auth with platform event', async function () {
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
        await sleep(1000);

        // Check received event and subcription info
        expect(receivedEvent?.replayId).toBe(publishedReplayId);
        expect(receivedSub?.topicName).toBe(PLATFORM_EVENT_TOPIC);
        expect(receivedSub?.receivedEventCount).toBe(1);
        expect(receivedSub?.requestedEventCount).toBe(1);
    });

    it('supports client credentials OAuth flow with platform event', async function () {
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
        await sleep(1000);

        // Check received event and subcription info
        expect(receivedEvent?.replayId).toBe(publishedReplayId);
        expect(receivedSub?.topicName).toBe(PLATFORM_EVENT_TOPIC);
        expect(receivedSub?.receivedEventCount).toBe(1);
        expect(receivedSub?.requestedEventCount).toBe(1);
    });

    it('supports JWT OAuth flow with platform event', async function () {
        let receivedEvent, receivedSub;

        // Read private key
        const privateKey = fs.readFileSync(
            process.env.SALESFORCE_PRIVATE_KEY_FILE
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
        await sleep(1000);

        // Check received event and subcription info
        expect(receivedEvent?.replayId).toBe(publishedReplayId);
        expect(receivedSub?.topicName).toBe(PLATFORM_EVENT_TOPIC);
        expect(receivedSub?.receivedEventCount).toBe(1);
        expect(receivedSub?.requestedEventCount).toBe(1);
    });
});
