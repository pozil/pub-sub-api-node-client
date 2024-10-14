import * as dotenv from 'dotenv';
import fs from 'fs';

import PubSubApiClient from './src/client.js';
import jsforce from 'jsforce';
import { AuthType } from './src/utils/configuration.js';

process.on('uncaughtException', (exception) => {
    console.error('uncaughtException: ', exception);
});
process.on('unhandledRejection', (reason, p) => {
    console.error('Unhandled Rejection at: Promise ', p, ' reason: ', reason);
});

const CHANGE_FIELD_NAME_SHORT = 'BillingCity';
const CHANGE_FIELD_NAME_FULL = 'BillingAddress.City';
const CHANGE_FIELD_VALUE = 'SFO' + Math.random();

async function run() {
    try {
        // Load config from .env file
        dotenv.config();

        // Test for user supplied auth
        const sfConnection = await connectWithUserSuppliedAuth();
        const client = new PubSubApiClient({
            authType: AuthType.USER_SUPPLIED,
            accessToken: sfConnection.accessToken,
            instanceUrl: sfConnection.instanceUrl,
            organizationId: sfConnection.userInfo.organizationId
        });

        // Connect
        await client.connect();

        const subscribeCallback = (subscription, callbackType, data) => {
            switch (callbackType) {
                case 'event':
                    if (data.payload?.ChangeEventHeader) {
                        // Change event
                        console.log(
                            `Handling ${data.payload.ChangeEventHeader.entityName} change event ${data.replayId}`
                        );
                        console.log(JSON.stringify(data, null, 2));

                        const { changedFields } =
                            data.payload.ChangeEventHeader;
                        if (!changedFields.includes(CHANGE_FIELD_NAME_FULL)) {
                            console.error(
                                `TEST FAILED: expected to find ${CHANGE_FIELD_NAME_FULL} in ${changedFields}`
                            );
                        } else {
                            console.log('TEST SUCCESS');
                        }
                    } else {
                        // Platform event
                        console.log(
                            `Handling platform event ` +
                                `with ID ${data.replayId} ` +
                                `on channel ${subscription.topicName} ` +
                                `(${subscription.receivedEventCount}/${subscription.requestedEventCount} ` +
                                `events received so far)`
                        );
                        console.log(
                            JSON.stringify(
                                data,
                                (key, value) =>
                                    typeof value === 'bigint'
                                        ? value.toString()
                                        : value, // return everything else unchanged
                                2
                            )
                        );
                    }
                    break;
                case 'lastEvent':
                    console.log(
                        `Reached last requested event on channel ${subscription.topicName}. Closing connection.`
                    );
                    client.close();
                    break;
                case 'end':
                    console.log('Shut down gracefully.');
                    process.exit(0);
                    break;
                case 'error':
                    console.log(
                        'Received gRPC error: ' + data,
                        JSON.stringify(data)
                    );
                    break;
                case 'grpcStatus':
                    console.log('Received gRPC status: ', JSON.stringify(data));
                    break;
                case 'grpcKeepAlive':
                    console.log('Received subscription keepalive.');
                    break;
                default:
                    console.log(
                        `Unsupported event callback type: ${callbackType}`,
                        JSON.stringify(data)
                    );
                    break;
            }
        };

        //await subscribeToChangeEventFromReplayId(client, subscribeCallback, 2202810, 1);
        //await subscribeToChangeEventFromRetentionWindow(client, subscribeCallback, 5);
        //await subscribeToChangeEvent(client, subscribeCallback, 1);
        await subscribeToPlatformEvent(client, subscribeCallback, 1);

        console.log('Wait for subscription...');
        await new Promise((resolve) => setTimeout(() => resolve(), 1000));
        console.log('Resuming.');

        //await updateRecord(sfConnection);
        await publishPlatformEvent(client);
    } catch (error) {
        console.error(error);
    }
}

async function connectWithUserSuppliedAuth() {
    console.log('Connect with jsForce');
    const sfConnection = new jsforce.Connection({
        loginUrl: process.env.SALESFORCE_LOGIN_URL
    });
    await sfConnection.login(
        process.env.SALESFORCE_USERNAME,
        process.env.SALESFORCE_TOKEN
            ? process.env.SALESFORCE_PASSWORD + process.env.SALESFORCE_TOKEN
            : process.env.SALESFORCE_PASSWORD
    );
    return sfConnection;
}

async function subscribeToPlatformEventWithReplayId(client, replayId) {
    // Subscribe to platform events
    console.log('Subscribing...');
    const eventEmitter = await client.subscribeFromReplayId(
        '/event/Sample__e',
        null,
        replayId
    );
    console.log('Subscribed.');
    // Handle events
    eventEmitter.on('data', (event) => {
        console.log(
            `Handling event ` +
                `with ID ${event.replayId} ` +
                `on channel ${eventEmitter.getTopicName()} ` +
                `(${eventEmitter.getReceivedEventCount()}/${eventEmitter.getRequestedEventCount()} ` +
                `events received so far)`
        );
        console.log(
            JSON.stringify(
                event,
                (key, value) =>
                    typeof value === 'bigint' ? value.toString() : value, // return everything else unchanged
                2
            )
        );
    });
    return eventEmitter;
}

async function subscribeToPlatformEvent(
    client,
    subscribeCallback,
    eventCount = 1
) {
    console.log(`Subscribing to ${eventCount} platform events.`);
    await client.subscribe('/event/Sample__e', subscribeCallback, eventCount);
    console.log(`Subscribed.`);
}

async function subscribeToChangeEvent(
    client,
    subscribeCallback,
    eventCount = 1
) {
    console.log(`Subscribing to ${eventCount} change events.`);
    await client.subscribe(
        //'/data/AccountChangeEvent',
        '/data/Account_Channel__chn',
        subscribeCallback,
        eventCount
    );
    console.log(`Subscribed.`);
}

async function subscribeToChangeEventFromRetentionWindow(
    client,
    subscribeCallback,
    eventCount = 1
) {
    console.log(
        `Subscribing to ${eventCount} change events from retention window.`
    );
    await client.subscribeFromEarliestEvent(
        '/data/AccountChangeEvent',
        subscribeCallback,
        eventCount
    );
    console.log(`Subscribed.`);
}

async function subscribeToChangeEventFromReplayId(
    client,
    subscribeCallback,
    replayId,
    eventCount = 1
) {
    console.log(
        `Subscribing to ${eventCount} change events from replay ID ${replayId}.`
    );
    await client.subscribeFromReplayId(
        '/data/AccountChangeEvent',
        subscribeCallback,
        eventCount,
        replayId
    );
    console.log(`Subscribed.`);
}

async function updateRecord(sfConnection) {
    console.log('Updating record...');
    const newValues = {
        Id: '0014H00002LbR7QQAV'
    };
    newValues[CHANGE_FIELD_NAME_SHORT] = CHANGE_FIELD_VALUE;
    sfConnection.sobject('Account').update(newValues, (err, ret) => {
        if (err || !ret.success) {
            return console.error(err, ret);
        }
        console.log('Record updated');
    });
}

async function publishPlatformEvent(client) {
    const payload = {
        CreatedDate: new Date().getTime(), // Non-null value required but there's no validity check performed on this field
        CreatedById: '00558000000yFyDAAU', // Valid user ID
        Message__c: { string: 'Hello world' } // Field is nullable so we need to specify the 'string' type
    };
    const publishResult = await client.publish('/event/Sample__e', payload);
    console.log('Published platform event: ', JSON.stringify(publishResult));
}

run();
