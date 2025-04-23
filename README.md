[![npm](https://img.shields.io/npm/v/salesforce-pubsub-api-client)](https://www.npmjs.com/package/salesforce-pubsub-api-client)

# Node client for the Salesforce Pub/Sub API

See the [official Pub/Sub API repo](https://github.com/developerforce/pub-sub-api) and the [documentation](https://developer.salesforce.com/docs/platform/pub-sub-api/guide/intro.html) for more information on the Salesforce gRPC-based Pub/Sub API.

- [v4 to v5 Migration](#v4-to-v5-migration)
- [v4 Documentation](v4-documentation.md)
- [Installation and Configuration](#installation-and-configuration)
    - [Authentication](#authentication)
        - [User supplied authentication](#user-supplied-authentication)
        - [Username/password flow](#usernamepassword-flow)
        - [OAuth 2.0 client credentials flow (client_credentials)](#oauth-20-client-credentials-flow-client_credentials)
        - [OAuth 2.0 JWT bearer flow](#oauth-20-jwt-bearer-flow)
    - [Logging](#logging)
- [Quick Start Example](#quick-start-example)
- [Other Examples](#other-examples)
    - [Publish a single platform event](#publish-a-single-platform-event)
    - [Publish a batch of platform events](#publish-a-batch-of-platform-events)
    - [Subscribe with a replay ID](#subscribe-with-a-replay-id)
    - [Subscribe to past events in retention window](#subscribe-to-past-events-in-retention-window)
    - [Subscribe using a managed subscription](#subscribe-using-a-managed-subscription)
    - [Work with flow control for high volumes of events](#work-with-flow-control-for-high-volumes-of-events)
    - [Handle gRPC stream lifecycle events](#handle-grpc-stream-lifecycle-events)
- [Common Issues](#common-issues)
- [Reference](#reference)
    - [PubSubApiClient](#pubsubapiclient)
    - [PublishCallback](#publishcallback)
    - [SubscribeCallback](#subscribecallback)
    - [SubscriptionInfo](#subscriptioninfo)
    - [EventParseError](#eventparseerror)
    - [Configuration](#configuration)

## v4 to v5 Migration

> [!WARNING]
> Version 5 of the Pub/Sub API client introduces a couple of breaking changes which require a small migration effort. Read this section for an overview of the changes.

### Configuration and Connection

In v4 and earlier versions of this client:

- you specify the configuration in a `.env` file with specific property names.
- you connect with either the `connect()` or `connectWithAuth()` method depending on the authentication flow.

In v5:

- you pass your configuration with an object in the client constructor. The `.env` file is no longer a requirement, you are free to store your configuration where you want.
- you connect with a unique [`connect()`](#async-connect--promisevoid) method.

### Event handling

In v4 and earlier versions of this client you use an asynchronous `EventEmitter` to receive updates such as incoming messages or lifecycle events:

```js
// Subscribe to account change events
const eventEmitter = await client.subscribe(
    '/data/AccountChangeEvent'
);

// Handle incoming events
eventEmitter.on('data', (event) => {
    // Event handling logic goes here
}):
```

In v5 you use a synchronous callback function to receive the same information. This helps to ensure that events are received in the right order.

```js
const subscribeCallback = (subscription, callbackType, data) => {
    // Event handling logic goes here
};

// Subscribe to account change events
await client.subscribe('/data/AccountChangeEvent', subscribeCallback);
```

## Installation and Configuration

Install the client library with `npm install salesforce-pubsub-api-client`.

### Authentication

Pick one of these authentication flows and pass the relevant configuration to the `PubSubApiClient` constructor:

- [User supplied authentication](#user-supplied-authentication)
- [Username/password flow](#usernamepassword-flow) (recommended for tests)
- [OAuth 2.0 client flow](#oauth-20-client-credentials-flow-client_credentials)
- [OAuth 2.0 JWT Bearer flow](#oauth-20-jwt-bearer-flow) (recommended for production)

#### User supplied authentication

If you already have a Salesforce client in your app, you can reuse its authentication information.
In the example below, we assume that `sfConnection` is a connection obtained with [jsforce](https://jsforce.github.io/)

```js
const client = new PubSubApiClient({
    authType: 'user-supplied',
    accessToken: sfConnection.accessToken,
    instanceUrl: sfConnection.instanceUrl,
    organizationId: sfConnection.userInfo.organizationId
});
```

#### Username/password flow

> [!WARNING]
> Relying on a username/password authentication flow for production is not recommended. Consider switching to JWT auth for extra security.

```js
const client = new PubSubApiClient({
    authType: 'username-password',
    loginUrl: process.env.SALESFORCE_LOGIN_URL,
    username: process.env.SALESFORCE_USERNAME,
    password: process.env.SALESFORCE_PASSWORD,
    userToken: process.env.SALESFORCE_TOKEN
});
```

#### OAuth 2.0 client credentials flow (client_credentials)

```js
const client = new PubSubApiClient({
    authType: 'oauth-client-credentials',
    loginUrl: process.env.SALESFORCE_LOGIN_URL,
    clientId: process.env.SALESFORCE_CLIENT_ID,
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET
});
```

#### OAuth 2.0 JWT bearer flow

This is the most secure authentication option. Recommended for production use.

```js
// Read private key file
const privateKey = fs.readFileSync(process.env.SALESFORCE_PRIVATE_KEY_FILE);

// Build PubSub client
const client = new PubSubApiClient({
    authType: 'oauth-jwt-bearer',
    loginUrl: process.env.SALESFORCE_JWT_LOGIN_URL,
    clientId: process.env.SALESFORCE_JWT_CLIENT_ID,
    username: process.env.SALESFORCE_USERNAME,
    privateKey
});
```

### Logging

The client uses debug level messages so you can lower the default logging level if you need more information.

The documentation examples use the default client logger (the console). The console is fine for a test environment but you'll want to switch to a custom logger with asynchronous logging for increased performance.

You can pass a logger like pino in the client constructor:

```js
import pino from 'pino';

const config = {
    /* your config goes here */
};
const logger = pino();
const client = new PubSubApiClient(config, logger);
```

## Quick Start Example

Here's an example that will get you started quickly. It listens to up to 3 account change events. Once the third event is reached, the client closes gracefully.

1.  Activate Account change events in **Salesforce Setup > Change Data Capture**.

1.  Install the client and `dotenv` in your project:

    ```sh
    npm install salesforce-pubsub-api-client dotenv
    ```

1.  Create a `.env` file at the root of the project and replace the values:

    ```properties
    SALESFORCE_LOGIN_URL=...
    SALESFORCE_USERNAME=...
    SALESFORCE_PASSWORD=...
    SALESFORCE_TOKEN=...
    ```

1.  Create a `sample.js` file with the following content:

    ```js
    import * as dotenv from 'dotenv';
    import PubSubApiClient from 'salesforce-pubsub-api-client';

    async function run() {
        try {
            // Load config from .env file
            dotenv.config();

            // Build and connect Pub/Sub API client
            const client = new PubSubApiClient({
                authType: 'username-password',
                loginUrl: process.env.SALESFORCE_LOGIN_URL,
                username: process.env.SALESFORCE_USERNAME,
                password: process.env.SALESFORCE_PASSWORD,
                userToken: process.env.SALESFORCE_TOKEN
            });
            await client.connect();

            // Prepare event callback
            const subscribeCallback = (subscription, callbackType, data) => {
                switch (callbackType) {
                    case 'event':
                        // Event received
                        console.log(
                            `${subscription.topicName} - Handling ${data.payload.ChangeEventHeader.entityName} change event ` +
                                `with ID ${data.replayId} ` +
                                `(${subscription.receivedEventCount}/${subscription.requestedEventCount} ` +
                                `events received so far)`
                        );
                        // Safely log event payload as a JSON string
                        console.log(
                            JSON.stringify(
                                data,
                                (key, value) =>
                                    /* Convert BigInt values into strings and keep other types unchanged */
                                    typeof value === 'bigint'
                                        ? value.toString()
                                        : value,
                                2
                            )
                        );
                        break;
                    case 'lastEvent':
                        // Last event received
                        console.log(
                            `${subscription.topicName} - Reached last of ${subscription.requestedEventCount} requested event on channel. Closing connection.`
                        );
                        break;
                    case 'end':
                        // Client closed the connection
                        console.log('Client shut down gracefully.');
                        break;
                }
            };

            // Subscribe to 3 account change event
            client.subscribe('/data/AccountChangeEvent', subscribeCallback, 3);
        } catch (error) {
            console.error(error);
        }
    }

    run();
    ```

1.  Run the project with `node sample.js`

    If everything goes well, you'll see output like this:

    ```
    Connected to Salesforce org https://pozil-dev-ed.my.salesforce.com (00D58000000arpqEAA) as grpc@pozil.com
    Connected to Pub/Sub API endpoint api.pubsub.salesforce.com:7443
    /data/AccountChangeEvent - Subscribe request sent for 3 events
    ```

    At this point, the script is on hold and waits for events.

1.  Modify an account record in Salesforce. This fires an account change event.

    Once the client receives an event, it displays it like this:

    ```
    /data/AccountChangeEvent - Received 1 events, latest replay ID: 18098167
    /data/AccountChangeEvent - Handling Account change event with ID 18098167 (1/3 events received so far)
    {
        "replayId": 18098167,
        "payload": {
            "ChangeEventHeader": {
            "entityName": "Account",
            "recordIds": [
                "0014H00002LbR7QQAV"
            ],
            "changeType": "UPDATE",
            "changeOrigin": "com/salesforce/api/soap/58.0;client=SfdcInternalAPI/",
            "transactionKey": "000046c7-a642-11e2-c29b-229c6786473e",
            "sequenceNumber": 1,
            "commitTimestamp": 1696444513000,
            "commitNumber": 11657372702432,
            "commitUser": "00558000000yFyDAAU",
            "nulledFields": [],
            "diffFields": [],
            "changedFields": [
                "LastModifiedDate",
                "BillingAddress.City",
                "BillingAddress.State"
            ]
            },
            "Name": null,
            "Type": null,
            "ParentId": null,
            "BillingAddress": {
                "Street": null,
                "City": "San Francisco",
                "State": "CA",
                "PostalCode": null,
                "Country": null,
                "StateCode": null,
                "CountryCode": null,
                "Latitude": null,
                "Longitude": null,
                "Xyz": null,
                "GeocodeAccuracy": null
            },
            "ShippingAddress": null,
            "Phone": null,
            "Fax": null,
            "AccountNumber": null,
            "Website": null,
            "Sic": null,
            "Industry": null,
            "AnnualRevenue": null,
            "NumberOfEmployees": null,
            "Ownership": null,
            "TickerSymbol": null,
            "Description": null,
            "Rating": null,
            "Site": null,
            "OwnerId": null,
            "CreatedDate": null,
            "CreatedById": null,
            "LastModifiedDate": 1696444513000,
            "LastModifiedById": null,
            "Jigsaw": null,
            "JigsawCompanyId": null,
            "CleanStatus": null,
            "AccountSource": null,
            "DunsNumber": null,
            "Tradestyle": null,
            "NaicsCode": null,
            "NaicsDesc": null,
            "YearStarted": null,
            "SicDesc": null,
            "DandbCompanyId": null
        }
    }
    ```

    Note that the change event payloads include all object fields but fields that haven't changed are null. In the above example, the only changes are the Billing State, Billing City and Last Modified Date.

    Use the values from `ChangeEventHeader.nulledFields`, `ChangeEventHeader.diffFields` and `ChangeEventHeader.changedFields` to identify actual value changes.

## Other Examples

### Publish a single platform event

> [!NOTE]
> For best performances, use `publishBatch` when publishing event batches.

Publish a single `Sample__e` platform events with a `Message__c` field using [publish](#async-publishtopicname-payload-correlationkey--promisepublishresult):

```js
const payload = {
    CreatedDate: new Date().getTime(), // Non-null value required but there's no validity check performed on this field
    CreatedById: '005_________', // Valid user ID
    Message__c: { string: 'Hello world' } // Field is nullable so we need to specify the 'string' type
};
const publishResult = await client.publish('/event/Sample__e', payload);
console.log('Published event: ', JSON.stringify(publishResult));
```

### Publish a batch of platform events

Publish a batch of `Sample__e` platform events using [publishBatch](#async-publishbatchtopicname-events-publishcallback):

```js
// Prepare publish callback
const publishCallback = (info, callbackType, data) => {
    switch (callbackType) {
        case 'publishResponse':
            console.log(JSON.stringify(data));
            break;
    }
};

// Prepare events
const events = [
    {
        payload: {
            CreatedDate: new Date().getTime(), // Non-null value required but there's no validity check performed on this field
            CreatedById: '005_________', // Valid user ID
            Message__c: { string: 'Hello world' } // Field is nullable so we need to specify the 'string' type
        }
    }
];

// Publish event batch
client.publishBatch('/event/Sample__e', events, publishCallback);
```

### Subscribe with a replay ID

Subscribe to 5 account change events starting from a replay ID:

```js
await client.subscribeFromReplayId(
    '/data/AccountChangeEvent',
    subscribeCallback,
    5,
    17092989
);
```

### Subscribe to past events in retention window

Subscribe to the 3 earliest past account change events in the retention window:

```js
await client.subscribeFromEarliestEvent(
    '/data/AccountChangeEvent',
    subscribeCallback,
    3
);
```

### Subscribe using a managed subscription

You can turn your Pub/Sub client application stateless by delegating the tracking of replay IDs to the server thanks to [managed event subscriptions](https://developer.salesforce.com/docs/platform/pub-sub-api/guide/managed-sub.html).

1. [Create a managed event subscription](https://developer.salesforce.com/docs/platform/pub-sub-api/guide/managed-sub.html#configuring-a-managed-event-subscription) using the tooling API. You can use API request templates from the [Salesforce Platform APIs](https://www.postman.com/salesforce-developers/salesforce-developers/folder/00bu8y3/managed-event-subscriptions) Postman collection to do so.
1. Subscribe to 3 events from a managed event subscription (`Managed_Sample_PE` in this expample):
    ```js
    await client.subscribeWithManagedSubscription(
        'Managed_Sample_PE',
        subscribeCallback,
        3
    );
    ```
1. Using the subscription information sent in the subscribe callback, frequently commit the last replay ID that you receveive:
    ```js
    client.commitReplayId(
        subscription.subscriptionId,
        subscription.lastReplayId
    );
    ```
1. Optionnaly, request additional events to be sent (3 more in this example):
    ```js
    client.requestAdditionalManagedEvents(subscription.subscriptionId, 3);
    ```

### Work with flow control for high volumes of events

When working with high volumes of events you can control the incoming flow of events by requesting a limited batch of events. This event flow control ensures that the client doesn’t get overwhelmed by accepting more events that it can handle if there is a spike in event publishing.

This is the overall process:

1. Pass a number of requested events in your subscribe call.
1. Handle the `lastevent` [callback type](#subscribecallback) from subscribe callback to detect the end of the event batch.
1. Subscribe to an additional batch of events with `client.requestAdditionalEvents(...)`. If you don't request additional events at this point, the gRPC subscription will close automatically (default Pub/Sub API behavior).

The code below illustrate how you can achieve event flow control:

```js
try {
    // Connect with the Pub/Sub API
    const client = new PubSubApiClient(/* config goes here */);
    await client.connect();

    // Prepare event callback
    const subscribeCallback = (subscription, callbackType, data) => {
        switch (callbackType) {
            case 'event':
                // Logic for handling a single event.
                // Unless you request additional events later, this should get called up to 10 times
                // given the initial subscription boundary.
            break;
            case 'lastEvent':
                // Last event received
                console.log(
                    `${eventEmitter.getTopicName()} - Reached last requested event on channel.`
                );
                // Request 10 additional events
                client.requestAdditionalEvents(eventEmitter, 10);
            break;
            case 'end':
                // Client closed the connection
                console.log('Client shut down gracefully.');
            break;
        }
    };

    // Subscribe to a batch of 10 account change event
    await client.subscribe('/data/AccountChangeEvent', subscribeCallback 10);
} catch (error) {
    console.error(error);
}
```

### Handle gRPC stream lifecycle events

Use callback types from subscribe callback to handle gRPC stream lifecycle events:

```js
const subscribeCallback = (subscription, callbackType, data) => {
    if (callbackType === 'grpcStatus') {
        // Stream status update
        console.log('gRPC stream status: ', status);
    } else if (callbackType === 'error') {
        // Stream error
        console.error('gRPC stream error: ', JSON.stringify(error));
    } else if (callbackType === 'end') {
        // Stream end
        console.log('gRPC stream ended');
    }
};
```

## Common Issues

### TypeError: Do not know how to serialize a BigInt

If you attempt to call `JSON.stringify` on an event you will likely see the following error:

> TypeError: Do not know how to serialize a BigInt

This happens when an integer value stored in an event field exceeds the range of the `Number` JS type (this typically happens with `commitNumber` values). In this case, we use a `BigInt` type to safely store the integer value. However, the `BigInt` type is not yet supported in standard JSON representation (see step 10 in the [BigInt TC39 spec](https://tc39.es/proposal-bigint/#sec-serializejsonproperty)) so this triggers a `TypeError`.

To avoid this error, use a replacer function to safely escape BigInt values so that they can be serialized as a string (or any other format of your choice) in JSON:

```js
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
```

## Reference

### PubSubApiClient

Client for the Salesforce Pub/Sub API

#### `PubSubApiClient(configuration, [logger])`

Builds a new Pub/Sub API client.

| Name            | Type                            | Description                                                                                 |
| --------------- | ------------------------------- | ------------------------------------------------------------------------------------------- |
| `configuration` | [Configuration](#configuration) | The client configuration (authentication...).                                               |
| `logger`        | Logger                          | An optional [custom logger](#logging). The client uses the console if no value is supplied. |

#### `close()`

Closes the gRPC connection. The client will no longer receive events for any topic.

#### `commitReplayId(subscriptionId, replayId) → string`

Commits a replay ID on a managed subscription.

Returns: commit request UUID.

| Name             | Type   | Description             |
| ---------------- | ------ | ----------------------- |
| `subscriptionId` | string | managed subscription ID |
| `replayId`       | number | event replay ID         |

#### `async connect() → {Promise.<void>}`

Authenticates with Salesforce then connects to the Pub/Sub API.

Returns: Promise that resolves once the connection is established.

#### `async getConnectivityState() → {Promise<connectivityState>}`

Gets the gRPC connectivity state from the current channel.

Returns: Promise that holds the channel's [connectivity state](https://grpc.github.io/grpc/node/grpc.html#.connectivityState).

#### `async publish(topicName, payload, [correlationKey]) → {Promise.<PublishResult>}`

Publishes an payload to a topic using the gRPC client. This is a synchronous operation, use `publishBatch` when publishing event batches.

Returns: Promise holding a `PublishResult` object with `replayId` and `correlationKey`.

| Name             | Type   | Description                                                                               |
| ---------------- | ------ | ----------------------------------------------------------------------------------------- |
| `topicName`      | string | name of the topic that we're publishing on                                                |
| `payload`        | Object | payload of the event that is being published                                              |
| `correlationKey` | string | optional correlation key. If you don't provide one, we'll generate a random UUID for you. |

#### `async publishBatch(topicName, events, publishCallback)`

Publishes a batch of events using the gRPC client's publish stream.

| Name              | Type                                | Description                                       |
| ----------------- | ----------------------------------- | ------------------------------------------------- |
| `topicName`       | string                              | name of the topic that we're publishing on        |
| `events`          | [PublisherEvent](#publisherEvent)[] | events to be published                            |
| `publishCallback` | [PublishCallback](#publishCallback) | callback function for handling publish responses. |

#### `async subscribe(topicName, subscribeCallback, [numRequested])`

Subscribes to a topic.

| Name                | Type                                    | Description                                                                                                    |
| ------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `topicName`         | string                                  | name of the topic that we're subscribing to                                                                    |
| `subscribeCallback` | [SubscribeCallback](#subscribecallback) | subscribe callback function                                                                                    |
| `numRequested`      | number                                  | optional number of events requested. If not supplied or null, the client keeps the subscription alive forever. |

#### `async subscribeFromEarliestEvent(topicName, subscribeCallback, [numRequested])`

Subscribes to a topic and retrieves all past events in retention window.

| Name                | Type                                    | Description                                                                                                    |
| ------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `topicName`         | string                                  | name of the topic that we're subscribing to                                                                    |
| `subscribeCallback` | [SubscribeCallback](#subscribecallback) | subscribe callback function                                                                                    |
| `numRequested`      | number                                  | optional number of events requested. If not supplied or null, the client keeps the subscription alive forever. |

#### `async subscribeFromReplayId(topicName, subscribeCallback, numRequested, replayId)`

Subscribes to a topic and retrieves past events starting from a replay ID.

| Name                | Type                                    | Description                                                                             |
| ------------------- | --------------------------------------- | --------------------------------------------------------------------------------------- |
| `topicName`         | string                                  | name of the topic that we're subscribing to                                             |
| `subscribeCallback` | [SubscribeCallback](#subscribecallback) | subscribe callback function                                                             |
| `numRequested`      | number                                  | number of events requested. If `null`, the client keeps the subscription alive forever. |
| `replayId`          | number                                  | replay ID                                                                               |

#### `async subscribeWithManagedSubscription(subscriptionIdOrName, subscribeCallback, [numRequested])`

Subscribes to a topic thanks to a managed subscription.

Throws an error if the managed subscription does not exist or is not in the `RUN` state.

| Name                   | Type                                    | Description                                                                                                    |
| ---------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `subscriptionIdOrName` | string                                  | managed subscription ID or developer name                                                                      |
| `subscribeCallback`    | [SubscribeCallback](#subscribecallback) | subscribe callback function                                                                                    |
| `numRequested`         | number                                  | optional number of events requested. If not supplied or null, the client keeps the subscription alive forever. |

#### `requestAdditionalEvents(topicName, numRequested)`

Request additional events on an existing subscription.

| Name           | Type   | Description                 |
| -------------- | ------ | --------------------------- |
| `topicName`    | string | name of the topic.          |
| `numRequested` | number | number of events requested. |

#### `requestAdditionalManagedEvents(subscriptionId, numRequested)`

Request additional events on an existing managed subscription.

| Name             | Type   | Description                 |
| ---------------- | ------ | --------------------------- |
| `subscriptionId` | string | managed subscription ID.    |
| `numRequested`   | number | number of events requested. |

### PublishCallback

Callback function that lets you process batch publish responses.

The function takes three parameters:

| Name           | Type                    | Description                                                           |
| -------------- | ----------------------- | --------------------------------------------------------------------- |
| `info`         | `{ topicName: string }` | callback information                                                  |
| `callbackType` | string                  | name of the callback type (see table below).                          |
| `data`         | [Object]                | data that is passed with the callback (depends on the callback type). |

Callback types:

| Name              | Callback Data                         | Description                                                                                              |
| ----------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `publishResponse` | [PublishResponse](#publishresponse)   | Client received a publish response. The attached data is the publish confirmation for a batch of events. |
| `error`           | Object                                | Signals an event publishing error or a gRPC stream error.                                                |
| `grpcKeepalive`   | `{ schemaId: string, rpcId: string }` | Server publishes this gRPC keep alive message every 270 seconds (or less) if there are no events.        |
| `grpcStatus`      | Object                                | Misc gRPC stream status information.                                                                     |

#### PublishResponse

| Name       | Type                                             | Description                                                                                  |
| ---------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `schemaId` | string                                           | topic schema ID                                                                              |
| `rpcId`    | string                                           | RPC ID                                                                                       |
| `results`  | `{ replayId: string, correlationKey: string }[]` | Event publish confirmations. Each confirmation contains the replay ID and a correlation key. |

### SubscribeCallback

Callback function that lets you process incoming Pub/Sub API events while keeping track of the topic name and the volume of events requested/received.

The function takes three parameters:

| Name           | Type                                  | Description                                                           |
| -------------- | ------------------------------------- | --------------------------------------------------------------------- |
| `subscription` | [SubscriptionInfo](#subscriptioninfo) | subscription information                                              |
| `callbackType` | string                                | name of the callback type (see table below).                          |
| `data`         | [Object]                              | data that is passed with the callback (depends on the callback type). |

Callback types:

| Name            | Callback Data                                             | Description                                                                                       |
| --------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `data`          | Object                                                    | Client received a new event. The attached data is the parsed event data.                          |
| `error`         | [EventParseError](#eventparseerror) or Object             | Signals an event parsing error or a gRPC stream error.                                            |
| `lastevent`     | void                                                      | Signals that we received the last event that the client requested. The stream will end shortly.   |
| `end`           | void                                                      | Signals the end of the gRPC stream.                                                               |
| `grpcKeepalive` | `{ latestReplayId: number, pendingNumRequested: number }` | Server publishes this gRPC keep alive message every 270 seconds (or less) if there are no events. |
| `grpcStatus`    | Object                                                    | Misc gRPC stream status information.                                                              |

### SubscriptionInfo

Holds the information related to a subscription.

| Name                  | Type    | Description                                                                    |
| --------------------- | ------- | ------------------------------------------------------------------------------ |
| `isManaged`           | boolean | whether this is a managed event subscription or not.                           |
| `topicName`           | string  | topic name for this subscription.                                              |
| `subscriptionId`      | string  | managed subscription ID. Undefined for regular subscriptions.                  |
| `subscriptionName`    | string  | managed subscription name. Undefined for regular subscriptions.                |
| `requestedEventCount` | number  | number of events that were requested when subscribing.                         |
| `receivedEventCount`  | number  | the number of events that were received since subscribing.                     |
| `lastReplayId`        | number  | replay ID of the last processed event or `null` if no event was processed yet. |

### EventParseError

Holds the information related to an event parsing error. This class attempts to extract the event replay ID from the event that caused the error.

| Name             | Type   | Description                                                                                                                    |
| ---------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `message`        | string | The error message.                                                                                                             |
| `cause`          | Error  | The cause of the error.                                                                                                        |
| `replayId`       | number | The replay ID of the event at the origin of the error. Could be undefined if we're not able to extract it from the event data. |
| `event`          | Object | The un-parsed event data at the origin of the error.                                                                           |
| `latestReplayId` | number | The latest replay ID that was received before the error.                                                                       |

### Configuration

Check out the [authentication](#authentication) section for more information on how to provide the right values.

| Name                    | Type    | Description                                                                                                                                                          |
| ----------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authType`              | string  | Authentication type. One of `user-supplied`, `username-password`, `oauth-client-credentials` or `oauth-jwt-bearer`.                                                  |
| `pubSubEndpoint`        | string  | A custom Pub/Sub API endpoint. The default endpoint `api.pubsub.salesforce.com:7443` is used if none is supplied.                                                    |
| `accessToken`           | string  | Salesforce access token.                                                                                                                                             |
| `instanceUrl`           | string  | Salesforce instance URL.                                                                                                                                             |
| `organizationId`        | string  | Optional organization ID. If you don't provide one, we'll attempt to parse it from the accessToken.                                                                  |
| `loginUrl`              | string  | Salesforce login host. One of `https://login.salesforce.com`, `https://test.salesforce.com` or your domain specific host.                                            |
| `clientId`              | string  | Connected app client ID.                                                                                                                                             |
| `clientSecret`          | string  | Connected app client secret.                                                                                                                                         |
| `privateKey`            | string  | Private key content.                                                                                                                                                 |
| `username`              | string  | Salesforce username.                                                                                                                                                 |
| `password`              | string  | Salesforce user password.                                                                                                                                            |
| `userToken`             | string  | Salesforce user security token.                                                                                                                                      |
| `rejectUnauthorizedSsl` | boolean | Optional flag used to accept self-signed SSL certificates for testing purposes when set to `false`. Default is `true` (client rejects self-signed SSL certificates). |
