import * as dotenv from 'dotenv';
import PubSubApiClient from '../../src/client.js';
import { AuthType } from '../../src/utils/types.js';
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

const PLATFORM_EVENT_TOPIC = '/event/Sample__e';

describe('Client failures', function () {
    var client;

    afterEach(async () => {
        if (client) {
            client.close();
            await sleep(500);
        }
    });

    it('fails to connect with invalid user supplied auth', async function () {
        let grpcStatusCode, errorCode;
        let isConnectionClosed = false;

        // Build PubSub client with invalid credentials
        client = new PubSubApiClient(
            {
                authType: AuthType.USER_SUPPLIED,
                accessToken: 'invalidToken',
                instanceUrl: 'https://pozil-dev-ed.my.salesforce.com',
                organizationId: '00D58000000arpq'
            },
            logger
        );
        await client.connect();

        // Prepare callback & send subscribe request
        const callback = (subscription, callbackType, data) => {
            if (callbackType === 'error') {
                errorCode = data.code;
            } else if (callbackType === 'grpcStatus') {
                grpcStatusCode = data.code;
            } else if (callbackType === 'end') {
                isConnectionClosed = true;
            }
        };
        client.subscribe(PLATFORM_EVENT_TOPIC, callback, 1);

        // Wait for subscribe to be effective and error to surface
        await waitFor(5000, () => errorCode !== undefined);

        // Check for gRPC auth error and closed connection
        expect(errorCode).toBe(16);
        expect(grpcStatusCode).toBe(16);
        expect(isConnectionClosed).toBeTrue();
    });

    it('fails to subscribe to an invalid topic name', async function () {
        let grpcStatusCode, errorCode;
        let isConnectionClosed = false;

        // Build PubSub client
        client = await getConnectedPubSubApiClient(logger);

        // Prepare callback & send subscribe request
        const callback = (subscription, callbackType, data) => {
            if (callbackType === 'error') {
                errorCode = data.code;
            } else if (callbackType === 'grpcStatus') {
                grpcStatusCode = data.code;
            } else if (callbackType === 'end') {
                isConnectionClosed = true;
            }
        };
        client.subscribe('/event/INVALID', callback);

        // Wait for subscribe to be effective and error to surface
        await waitFor(5000, () => errorCode !== undefined);

        // Check for gRPC auth error or permission error and closed connection
        expect(errorCode === 5 || errorCode === 7).toBeTruthy();
        expect(grpcStatusCode === 5 || grpcStatusCode === 7).toBeTruthy();
        expect(isConnectionClosed).toBeTrue();
    });

    it('fails to subscribe to an invalid managed subscription name', async function () {
        // Build PubSub client
        client = await getConnectedPubSubApiClient(logger);

        // Send subscribe request
        try {
            await client.subscribeWithManagedSubscription('INVALID', () => {});
        } catch (error) {
            expect(error.message).toMatch(
                'Failed to retrieve managed event subscription'
            );
        } finally {
            client.close();
        }
    });

    it('fails to subscribe to an managed subscription that is not running', async function () {
        // Build PubSub client
        client = await getConnectedPubSubApiClient(logger);

        // Send subscribe request
        try {
            await client.subscribeWithManagedSubscription(
                'Managed_Inactive_Sample_PE',
                () => {}
            );
        } catch (error) {
            expect(error.message).toMatch('subscription is in STOP state');
        } finally {
            client.close();
        }
    });
});
