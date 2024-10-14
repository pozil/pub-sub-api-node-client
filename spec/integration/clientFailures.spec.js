import * as dotenv from 'dotenv';
import PubSubApiClient from '../../src/client.js';
import { AuthType } from '../../src/utils/configuration.js';
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

async function sleep(duration) {
    return new Promise((resolve) => setTimeout(() => resolve(), duration));
}

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

        // Wait for subscribe to be effective
        await sleep(500);

        // Check for gRPC auth error and closed connection
        expect(errorCode).toBe(16);
        expect(grpcStatusCode).toBe(16);
        expect(isConnectionClosed).toBeTrue();
    });

    it('fails to subscribe to an invalid event', async function () {
        let grpcStatusCode, errorCode;
        let isConnectionClosed = false;

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
            if (callbackType === 'error') {
                errorCode = data.code;
            } else if (callbackType === 'grpcStatus') {
                grpcStatusCode = data.code;
            } else if (callbackType === 'end') {
                isConnectionClosed = true;
            }
        };
        client.subscribe('/event/INVALID', callback, 1);

        // Wait for subscribe to be effective
        await sleep(1000);

        // Check for gRPC auth error and closed connection
        expect(errorCode).toBe(7);
        expect(grpcStatusCode).toBe(7);
        expect(isConnectionClosed).toBeTrue();
    });
});
