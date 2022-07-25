# Sample Node gRPC client for the Salesforce Pub/Sub API

This project is derived from a [blog post](https://jungleeforce.com/2021/11/11/connecting-to-salesforce-using-pub-sub-api-grpc/) written by techinjungle.

See the [official Pub/Sub API repo](https://github.com/developerforce/pub-sub-api) for more information on the Pub/Sub API.

## Installation

Create a `.env` file at the root of the project:

```properties
SALESFORCE_LOGIN_URL=https://login.salesforce.com
SALESFORCE_USERNAME=YOUR_SALESFORCE_USERNAME
SALESFORCE_PASSWORD=YOUR_SALESFORCE_PASSWORD

PUB_SUB_ENDPOINT=api.pubsub.salesforce.com:7443
PUB_SUB_PROTO_FILE=pubsub_api.proto
PUB_SUB_TOPIC_NAME=/data/AccountChangeEvent
PUB_SUB_EVENT_RECEIVE_LIMIT=1
```

> **Warning:** this project relies on a username/password Salesforce authentication flow. This is only recommended for test purposes. Consider switching to JWT auth for extra security.

If using a Change Data Capture topic (like in the sample config), make sure to activate the event in Salesforce Setup > Change Data Capture.

## Execution

Run the project with `npm start`

If everything goes well, you'll see output like this:

```
Connected to Salesforce org https://pozilcom-dev-ed.my.salesforce.com as grpc@pozil.com
Pub/Sub API client is ready to connect
Topic schema loaded: /data/AccountChangeEvent
Subscribe request sent for 1 events from /data/AccountChangeEvent...
```

At this point the script will be on hold and will wait for events.
Once it receives events, it will display them like this:

```
Received 1 events, latest replay ID: 193945
gRPC event payloads:  [
  {
    "replayId": "193945",
    "payload": {
      "ChangeEventHeader": {
        "entityName": "Account",
        "recordIds": [
          "0017Q000005yIARQA2"
        ],
        "changeType": "UPDATE",
        "changeOrigin": "com/salesforce/api/soap/53.0;client=SfdcInternalAPI/",
        "transactionKey": "0006d2d3-f3c2-4bde-b75a-8e21f1acc21c",
        "sequenceNumber": 1,
        "commitTimestamp": 1641819688000,
        "commitNumber": 156839803268,
        "commitUser": "0057Q000002aGVkQAM",
        "nulledFields": [],
        "diffFields": [],
        "changedFields": [
          "0x420000"
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
        "long": 1641819688000
      },
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
      "DandbCompanyId": null,
      "OperatingHoursId": null,
      "CustomerPriority__c": null,
      "SLA__c": null,
      "Active__c": null,
      "NumberofLocations__c": null,
      "UpsellOpportunity__c": null,
      "SLASerialNumber__c": null,
      "SLAExpirationDate__c": null
    }
  }
]
```

After receiving the number of requested events (see `PUB_SUB_EVENT_RECEIVE_LIMIT`), the script will terminate with these messages:

```
gRPC stream status:  {
  code: 0,
  details: '',
  metadata: Metadata { _internal_repr: {}, flags: 0 }
}
gRPC stream ended
```
