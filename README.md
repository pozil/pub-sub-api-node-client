# Node gRPC client for the Salesforce Pub/Sub API

See the [official Pub/Sub API repo](https://github.com/developerforce/pub-sub-api) for more information on the Pub/Sub API.

## Installation

Install the client library with `npm install pubsub-api-client`.

Create a `.env` file at the root of the project for configuration. You may use either of these authentication flows:

-   Username/password authentication flow
-   OAuth 2.0 client credentials flow
-   OAuth 2.0 JWT Bearer Flow flow

> **Warning**<br/>
> Relying on a username/password authentication flow for production is not recommended. Consider switching to JWT auth or similar for extra security.

### Username/password flow

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

### OAuth 2.0 JWT Bearer Flow

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

1. Activate account change events in **Salesforce Setup > Change Data Capture**.

1. Create a `sample.js` file with this content:

    ```js
    import PubSubApiClient from './client.js';

    async function run() {
        try {
            const client = new PubSubApiClient();
            await client.connect();

            // Subscribe to a single incoming account change events
            const eventEmitter = await client.subscribe(
                '/data/AccountChangeEvent',
                1
            );

            // Handle incoming events
            eventEmitter.on('data', (event) => {
                console.log(
                    `Handling ${event.payload.ChangeEventHeader.entityName} change event ${event.replayId}`
                );
                console.log(JSON.stringify(event, null, 2));
            });
        } catch (error) {
            console.error(error);
        }
    }

    run();
    ```

1. Run the project with `node sample.js`

    If everything goes well, you'll see output like this:

    ```
    Connected to Salesforce org https://pozil-dev-ed.my.salesforce.com as grpc@pozil.com
    Connected to Pub/Sub API endpoint api.pubsub.salesforce.com:7443
    Topic schema loaded: /data/AccountChangeEvent
    Subscribe request sent for 1 events from /data/AccountChangeEvent...
    ```

    At this point the script will be on hold and will wait for events.

1. Modify an account record in Salesforce. This fires an account change event.

    Once the client receives an event, it will display it like this:

    ```
    Received 1 events, latest replay ID: 17093000
    Handling Account change event 17093000
    {
      "replayId": 17093000,
      "payload": {
        "ChangeEventHeader": {
          "entityName": "Account",
          "recordIds": [
            "0014H00002LbR7QQAV"
          ],
          "changeType": "UPDATE",
          "changeOrigin": "com/salesforce/api/soap/56.0;client=SfdcInternalAPI/",
          "transactionKey": "0005349f-124e-0df1-3a25-f551ab84d237",
          "sequenceNumber": 1,
          "commitTimestamp": 1672428268000,
          "commitNumber": 11449587527037,
          "commitUser": "00558000000yFyDAAU",
          "nulledFields": [],
          "diffFields": [],
          "changedFields": [
            "Rating",
            "LastModifiedDate"
          ]
        },
        "Name": null,
        "Type": null,
        "ParentId": null,
        "BillingAddress": null,
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
        "Rating": {
          "string": "Hot"
        },
        "Site": null,
        "OwnerId": null,
        "CreatedDate": null,
        "CreatedById": null,
        "LastModifiedDate": {
          "long": 1672428268000
        },
        ...
      }
    }
    ```

    Note that the change event payloads include all object fields but fields that haven't changed are null.
    Use the values from `ChangeEventHeader.nulledFields`, `ChangeEventHeader.diffFields` and `ChangeEventHeader.changedFields` to identify actual value changes.

    After receiving the number of requested events, the script will terminate with these messages:

    ```
    gRPC stream status:  {
      code: 0,
      details: '',
      metadata: Metadata { _internal_repr: {}, flags: 0 }
    }
    gRPC stream ended
    ```

## Other Examples

### Publish a platform event

Publish a `Sample__e` Platform Event with a `Message__c` field:

```js
const payload = {
    CreatedDate: new Date().getTime(), // Non-null value required but there's no validity check performed on this field
    CreatedById: 'someone', // Non-null value required but there's no validity check performed on this field
    Message__c: { string: 'Hello world' } // Field is nullable so we need to specify the 'string' type
};
const publishResult = await client.publish('/event/Sample__e', payload);
console.log('Published event: ', JSON.stringify(publishResult));
```

### Subscribe with a replay ID

Subscribe to account change events starting from a replay ID:

```js
const eventEmitter = await client.subscribeFromReplayId(
    '/data/AccountChangeEvent',
    5,
    17092989
);
```

### Subscribe to past events in retention window

Subscribe to past account change events in retention window:

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
