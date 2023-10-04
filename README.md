[![npm](https://img.shields.io/npm/v/salesforce-pubsub-api-client)](https://www.npmjs.com/package/salesforce-pubsub-api-client)

# Node client for the Salesforce Pub/Sub API

See the [official Pub/Sub API repo](https://github.com/developerforce/pub-sub-api) for more information on the Salesforce gRPC-based Pub/Sub API.

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
    -   [Handle gRPC stream lifecycle events](#handle-grpc-stream-lifecycle-events)
    -   [Use a custom logger](#use-a-custom-logger)

## Installation and Configuration

Install the client library with `npm install salesforce-pubsub-api-client`.

Create a `.env` file at the root of the project for configuration.

Pick one of these authentication flows and fill the relevant configuration:

-   User supplied authentication
-   Username/password authentication (recommended for tests)
-   OAuth 2.0 client credentials
-   OAuth 2.0 JWT Bearer (recommended for production)

> **Note**<br/>
> The default client logger is fine for a test environement but you'll want to switch to a [custom logger](#use-a-custom-logger) with asynchronous logging for increased performance.

### User supplied authentication

If you already have a Salesforce client in your app, you can reuse its authentication information. You only need this minimal configuration:

```properties
SALESFORCE_AUTH_TYPE=user-supplied

PUB_SUB_ENDPOINT=api.pubsub.salesforce.com:7443
```

When connecting to the Pub/Sub API, use the following method instead of the standard `connect()` method to specify authentication information:

```js
await client.connectWithAuth(
    accessToken,
    instanceUrl,
    organizationId,
    username
);
```

### Username/password flow

> **Warning**<br/>
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

                // Subscribe to a single incoming account change event
                const eventEmitter = await client.subscribe(
                    '/data/AccountChangeEvent',
                    1
                );

                // Handle incoming events
                eventEmitter.on('data', (event) => {
                    console.log(`Handling ${event.payload.ChangeEventHeader.entityName} change event `
                        + `with ID ${event.replayId} `
                        + `on channel ${eventEmitter.getTopicName()} `
                        + `(${eventEmitter.getReceivedEventCount()}/${eventEmitter.getRequestedEventCount()} `
                        + `events received so far)`);
                    console.log(JSON.stringify(event, null, 2));
                });

                // Handle last requested event
                eventEmitter.on('lastevent', (event) => {
                    console.log(
                        `Reached last requested event on channel ${eventEmitter.getTopicName()}.`
                    );
                    // At this point the gRPC client will close automatically
                    // unless you re-subscribe to request more events (default Pub/Sub API behavior)
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
    Subscribe request sent for 1 events from /data/AccountChangeEvent...
    ```

    At this point the script will be on hold and will wait for events.

1.  Modify an account record in Salesforce. This fires an account change event.

    Once the client receives an event, it will display it like this:

    ```
    Received 1 events, latest replay ID: 18098167
    Handling Account change event with ID 18098167 on channel /data/AccountChangeEvent (1/1 events received so far)
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

    After receiving the number of requested events, the script will terminate with these messages:

    ```
    Reached last requested event on channel /data/AccountChangeEvent
    gRPC stream status: {"code":0,"details":"","metadata":{}}
    gRPC stream ended
    ```

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
