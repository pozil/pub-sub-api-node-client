import PubSubApiClient from './src/client.js';
import jsforce from 'jsforce';

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
        const client = new PubSubApiClient();
        await client.connect();

        // Subscribe to account change events
        const eventEmitter = await client.subscribe(
            //'/data/AccountChangeEvent',
            '/event/Sample__e',
            1
        );

        // Handle incoming events
        eventEmitter.on('data', (event) => {
            if (event.payload?.ChangeEventHeader) {
                // Change event
                console.log(
                    `Handling ${event.payload.ChangeEventHeader.entityName} change event ${event.replayId}`
                );
            } else {
                // Platform event
                console.log(
                    `Handling platform event ` +
                        `with ID ${event.replayId} ` +
                        `on channel ${eventEmitter.getTopicName()}`
                );
            }

            // Safely log event as a JSON string
            console.log(
                JSON.stringify(
                    event,
                    (key, value) =>
                        /* Convert BigInt values into strings and keep other types unchanged */
                        typeof value === 'bigint' ? value.toString() : value,
                    2
                )
            );
        });

        // Publish PE
        await publishPlatformEvent(client);
    } catch (error) {
        console.error(error);
    }
}

/*
async function run() {
    try {
        // Test for user supplied auth
        //const sfConnection = await connectWithUserSuppliedAuth();
        const client = new PubSubApiClient();

        // Connect
        await client.connect();

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
    */

async function connectWithUserSuppliedAuth() {
    console.log('Connect with jsForce');
    const sfConnection = new jsforce.Connection({
        loginUrl: process.env.loginUrl
    });
    await sfConnection.login(
        process.env.username,
        process.env.userToken
            ? process.env.password + process.env.userToken
            : process.env.password
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
