[![npm](https://img.shields.io/npm/v/salesforce-pubsub-api-client)](https://www.npmjs.com/package/salesforce-pubsub-api-client)

# Node client for the Salesforce Pub/Sub API

See the [official Pub/Sub API repo](https://github.com/developerforce/pub-sub-api) and the [documentation](https://developer.salesforce.com/docs/platform/pub-sub-api/guide/intro.html) for more information on the Salesforce gRPC-based Pub/Sub API.

-   [Installation and Configuration](#installation-and-configuration)
    -   [User supplied authentication](#user-supplied-authentication)
    -   [Username/password flow](#usernamepassword-flow)
    -   [OAuth 2.0 client credentials flow (client_credentials)](#oauth-20-client-credentials-flow-client_credentials)
    -   [OAuth 2.0 JWT bearer flow](#oauth-20-jwt-bearer-flow)
-   [Basic Example](#basic-example)
-   [Other Examples](#other-examples)
    -   [Publish a platform event](#publish-a-platform-event)
    -   [Subscribe with a replay ID](#subscribe-with-a-replay-id)
    -   [Subscribe to past events in retention window](#subscribe-to-past-events-in-retention-window)
    -   [Work with flow control for high volumes of events](#work-with-flow-control-for-high-volumes-of-events)
    -   [Handle gRPC stream lifecycle events](#handle-grpc-stream-lifecycle-events)
    -   [Use a custom logger](#use-a-custom-logger)
-   [Reference](#reference)
    -   [PubSubApiClient](#pubsubapiclient)
    -   [PubSubEventEmitter](#pubsubeventemitter)
    -   [EventParseError](#eventparseerror)

## Installation and Configuration

Install the client library with `npm install salesforce-pubsub-api-client`.

Create a `.env` file at the root of the project for configuration.

Pick one of these authentication flows and fill the relevant configuration:

-   User supplied authentication
-   Username/password authentication (recommended for tests)
-   OAuth 2.0 client credentials
-   OAuth 2.0 JWT Bearer (recommended for production)

> [!TIP]
> The default client logger is fine for a test environment but you'll want to switch to a [custom logger](#use-a-custom-logger) with asynchronous logging for increased performance.

### User supplied authentication

If you already have a Salesforce client in your app, you can reuse its authentication information. You only need this minimal configuration:

```properties
SALESFORCE_AUTH_TYPE=user-supplied

PUB_SUB_ENDPOINT=api.pubsub.salesforce.com:7443
```

When connecting to the Pub/Sub API, use the following method instead of the standard `connect()` method to specify authentication information:

```js
await client.connectWithAuth(accessToken, instanceUrl, organizationId);
```

### Username/password flow

> [!WARNING]
> Relying on a username/password authentication flow for production is not recommended. Consider switching to JWT auth for extra security.

```properties
SALESFORCE_AUTH_TYPE=username-password
SALESFORCE_LOGIN_URL=https://login.salesforce.com
SALESFORCE_USERNAME=YOUR_SALESFORCE_USERNAME
SALESFORCE_PASSWORD=YOUR_SALESFORCE_PASSWORD
SALESFORCE_TOKEN=YOUR_SALESFORCE_USER_SECURITY_TOKEN

PUB_SUB_ENDPOINT=api.pubsub.salesforce.com:7443
```

### OAuth 2.0 client credentials flow (client_credentials)

```properties
SALESFORCE_AUTH_TYPE=oauth-client-credentials
SALESFORCE_LOGIN_URL=YOUR_DOMAIN_URL
SALESFORCE_CLIENT_ID=YOUR_CONNECTED_APP_CLIENT_ID
SALESFORCE_CLIENT_SECRET=YOUR_CONNECTED_APP_CLIENT_SECRET

PUB_SUB_ENDPOINT=api.pubsub.salesforce.com:7443
```

### OAuth 2.0 JWT bearer flow

This is the most secure authentication option. Recommended for production use.

```properties
SALESFORCE_AUTH_TYPE=oauth-jwt-bearer
SALESFORCE_LOGIN_URL=https://login.salesforce.com
SALESFORCE_CLIENT_ID=YOUR_CONNECTED_APP_CLIENT_ID
SALESFORCE_USERNAME=YOUR_SALESFORCE_USERNAME
SALESFORCE_PRIVATE_KEY_FILE=PATH_TO_YOUR_KEY_FILE

PUB_SUB_ENDPOINT=api.pubsub.salesforce.com:7443
```

## Basic Example

Here's an example that will get you started quickly. It listens to a single account change event.

1.  Activate Account change events in **Salesforce Setup > Change Data Capture**.

1.  Create a `sample.js` file with this content:

    ```js
    import PubSubApiClient from 'salesforce-pubsub-api-client';

    async function run() {
        try {
            const client = new PubSubApiClient();
            await client.connect();

            // Subscribe to account change events
            const eventEmitter = await client.subscribe(
                '/data/AccountChangeEvent'
            );

            // Handle incoming events
            eventEmitter.on('data', (event) => {
                console.log(
                    `Handling ${event.payload.ChangeEventHeader.entityName} change event ` +
                        `with ID ${event.replayId} ` +
                        `on channel ${eventEmitter.getTopicName()} ` +
                        `(${eventEmitter.getReceivedEventCount()}/${eventEmitter.getRequestedEventCount()} ` +
                        `events received so far)`
                );
                console.log(JSON.stringify(event, null, 2));
            });
        } catch (error) {
            console.error(error);
        }
    }

    run();
    ```

1.  Run the project with `node sample.js`

    If everything goes well, you'll see output like this:

    ```
    Connected to Salesforce org https://pozil-dev-ed.my.salesforce.com as grpc@pozil.com
    Connected to Pub/Sub API endpoint api.pubsub.salesforce.com:7443
    Topic schema loaded: /data/AccountChangeEvent
    Subscribe request sent for 100 events from /data/AccountChangeEvent...
    ```

    At this point the script will be on hold and will wait for events.

1.  Modify an account record in Salesforce. This fires an account change event.

    Once the client receives an event, it will display it like this:

    ```
    Received 1 events, latest replay ID: 18098167
    Handling Account change event with ID 18098167 on channel /data/AccountChangeEvent (1/100 events received so far)
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

### Publish a platform event

Publish a `Sample__e` Platform Event with a `Message__c` field:

```js
const payload = {
    CreatedDate: new Date().getTime(), // Non-null value required but there's no validity check performed on this field
    CreatedById: '005_________', // Valid user ID
    Message__c: { string: 'Hello world' } // Field is nullable so we need to specify the 'string' type
};
const publishResult = await client.publish('/event/Sample__e', payload);
console.log('Published event: ', JSON.stringify(publishResult));
```

### Subscribe with a replay ID

Subscribe to 5 account change events starting from a replay ID:

```js
const eventEmitter = await client.subscribeFromReplayId(
    '/data/AccountChangeEvent',
    5,
    17092989
);
```

### Subscribe to past events in retention window

Subscribe to the 3 earliest past account change events in retention window:

```js
const eventEmitter = await client.subscribeFromEarliestEvent(
    '/data/AccountChangeEvent',
    3
);
```

### Work with flow control for high volumes of events

When working with high volumes of events you can control the incoming flow of events by requesting a limited batch of events. This event flow control ensures that the client doesn’t get overwhelmed by accepting more events that it can handle if there is a spike in event publishing.

This is the overall process:

1. Pass a number of requested events in your subscribe call.
1. Handle the `lastevent` event from `PubSubEventEmitter` to detect the end of the event batch.
1. Subscribe to an additional batch of events with `client.requestAdditionalEvents(...)`. If you don't request additional events at this point, the gRPC subscription will close automatically (default Pub/Sub API behavior).

The code below illustrate how you can achieve event flow control:

```js
try {
    // Connect with the Pub/Sub API
    const client = new PubSubApiClient();
    await client.connect();

    // Subscribe to a batch of 10 account change event
    const eventEmitter = await client.subscribe('/data/AccountChangeEvent', 10);

    // Handle incoming events
    eventEmitter.on('data', (event) => {
        // Logic for handling a single event
    });

    // Handle last requested event
    eventEmitter.on('lastevent', () => {
        console.log(
            `Reached last requested event on channel ${eventEmitter.getTopicName()}.`
        );
        // Request 10 additional events
        client.requestAdditionalEvents(eventEmitter, 10);
    });
} catch (error) {
    console.error(error);
}
```

### Handle gRPC stream lifecycle events

Use the `EventEmmitter` returned by subscribe methods to handle gRPC stream lifecycle events:

```js
// Stream end
eventEmitter.on('end', () => {
    console.log('gRPC stream ended');
});

// Stream error
eventEmitter.on('error', (error) => {
    console.error('gRPC stream error: ', JSON.stringify(error));
});

// Stream status update
eventEmitter.on('status', (status) => {
    console.log('gRPC stream status: ', status);
});
```

### Use a custom logger

The client logs output to the console by default but you can provide your favorite logger in the client constructor.

When in production, asynchronous logging is preferable for performance reasons.

For example:

```js
import pino from 'pino';

const logger = pino();
const client = new PubSubApiClient(logger);
```

## Reference

### PubSubApiClient

Client for the Salesforce Pub/Sub API

#### `PubSubApiClient([logger])`

Builds a new Pub/Sub API client.

| Name     | Type   | Description                                                                     |
| -------- | ------ | ------------------------------------------------------------------------------- |
| `logger` | Logger | an optional custom logger. The client uses the console if no value is supplied. |

#### `close()`

Closes the gRPC connection. The client will no longer receive events for any topic.

#### `async connect() → {Promise.<void>}`

Authenticates with Salesforce then, connects to the Pub/Sub API.

Returns: Promise that resolves once the connection is established.

#### `async connectWithAuth(accessToken, instanceUrl, organizationIdopt) → {Promise.<void>}`

Connects to the Pub/Sub API with user-supplied authentication.

Returns: Promise that resolves once the connection is established.

| Name             | Type   | Description                                                                                         |
| ---------------- | ------ | --------------------------------------------------------------------------------------------------- |
| `accessToken`    | string | Salesforce access token                                                                             |
| `instanceUrl`    | string | Salesforce instance URL                                                                             |
| `organizationId` | string | optional organization ID. If you don't provide one, we'll attempt to parse it from the accessToken. |

#### `async publish(topicName, payload, correlationKeyopt) → {Promise.<PublishResult>}`

Publishes a payload to a topic using the gRPC client.

Returns: Promise holding a `PublishResult` object with `replayId` and `correlationKey`.

| Name             | Type   | Description                                                                               |
| ---------------- | ------ | ----------------------------------------------------------------------------------------- |
| `topicName`      | string | name of the topic that we're subscribing to                                               |
| `payload`        | Object |                                                                                           |
| `correlationKey` | string | optional correlation key. If you don't provide one, we'll generate a random UUID for you. |

#### `async subscribe(topicName, [numRequested]) → {Promise.<EventEmitter>}`

Subscribes to a topic.

Returns: Promise that holds an `EventEmitter` that allows you to listen to received events and stream lifecycle events.

| Name           | Type   | Description                                                                                                    |
| -------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| `topicName`    | string | name of the topic that we're subscribing to                                                                    |
| `numRequested` | number | optional number of events requested. If not supplied or null, the client keeps the subscription alive forever. |

#### `async subscribeFromEarliestEvent(topicName, [numRequested]) → {Promise.<EventEmitter>}`

Subscribes to a topic and retrieves all past events in retention window.

Returns: Promise that holds an `EventEmitter` that allows you to listen to received events and stream lifecycle events.

| Name           | Type   | Description                                                                                                    |
| -------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| `topicName`    | string | name of the topic that we're subscribing to                                                                    |
| `numRequested` | number | optional number of events requested. If not supplied or null, the client keeps the subscription alive forever. |

#### `async subscribeFromReplayId(topicName, numRequested, replayId) → {Promise.<EventEmitter>}`

Subscribes to a topic and retrieves past events starting from a replay ID.

Returns: Promise that holds an `EventEmitter` that allows you to listen to received events and stream lifecycle events.

| Name           | Type   | Description                                                                             |
| -------------- | ------ | --------------------------------------------------------------------------------------- |
| `topicName`    | string | name of the topic that we're subscribing to                                             |
| `numRequested` | number | number of events requested. If `null`, the client keeps the subscription alive forever. |
| `replayId`     | number | replay ID                                                                               |

#### `requestAdditionalEvents(eventEmitter, numRequested)`

Request additional events on an existing subscription.

| Name           | Type               | Description                                                 |
| -------------- | ------------------ | ----------------------------------------------------------- |
| `eventEmitter` | PubSubEventEmitter | event emitter that was obtained in the first subscribe call |
| `numRequested` | number             | number of events requested.                                 |

### PubSubEventEmitter

EventEmitter wrapper for processing incoming Pub/Sub API events while keeping track of the topic name and the volume of events requested/received.

The emitter sends the following events:

| Event Name  | Event Data                                                | Description                                                                                     |
| ----------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `data`      | Object                                                    | Client received a new event. The attached data is the parsed event data.                        |
| `error`     | `EventParseError \| Object`                               | Signals an event parsing error or a gRPC stream error.                                          |
| `lastevent` | void                                                      | Signals that we received the last event that the client requested. The stream will end shortly. |
| `keepalive` | `{ latestReplayId: number, pendingNumRequested: number }` | Server publishes this keep alive message every 270 seconds (or less) if there are no events.    |
| `end`       | void                                                      | Signals the end of the gRPC stream.                                                             |
| `status`    | Object                                                    | Misc gRPC stream status information.                                                            |

The emitter also exposes these methods:

| Method                     | Description                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `getRequestedEventCount()` | Returns the number of events that were requested when subscribing.                         |
| `getReceivedEventCount()`  | Returns the number of events that were received since subscribing.                         |
| `getTopicName()`           | Returns the topic name for this subscription.                                              |
| `getLatestReplayId()`      | Returns the replay ID of the last processed event or `null` if no event was processed yet. |

### EventParseError

Holds the information related to an event parsing error. This class attempts to extract the event replay ID from the event that caused the error.

| Name             | Type   | Description                                                                                                                    |
| ---------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `message`        | string | The error message.                                                                                                             |
| `cause`          | Error  | The cause of the error.                                                                                                        |
| `replayId`       | number | The replay ID of the event at the origin of the error. Could be undefined if we're not able to extract it from the event data. |
| `event`          | Object | The un-parsed event data at the origin of the error.                                                                           |
| `latestReplayId` | number | The latest replay ID that was received before the error.                                                                       |
