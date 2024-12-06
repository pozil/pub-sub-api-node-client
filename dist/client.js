// src/client.js
import crypto2 from "crypto";
import fs from "fs";
import { fileURLToPath } from "url";
import avro3 from "avro-js";
import certifi from "certifi";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { connectivityState } from "@grpc/grpc-js";

// src/utils/types.js
var SubscribeCallbackType = {
  EVENT: "event",
  LAST_EVENT: "lastEvent",
  ERROR: "error",
  END: "end",
  GRPC_STATUS: "grpcStatus",
  GRPC_KEEP_ALIVE: "grpcKeepAlive"
};
var PublishCallbackType = {
  PUBLISH_RESPONSE: "publishResponse",
  ERROR: "error",
  GRPC_STATUS: "grpcStatus",
  GRPC_KEEP_ALIVE: "grpcKeepAlive"
};
var AuthType = {
  USER_SUPPLIED: "user-supplied",
  USERNAME_PASSWORD: "username-password",
  OAUTH_CLIENT_CREDENTIALS: "oauth-client-credentials",
  OAUTH_JWT_BEARER: "oauth-jwt-bearer"
};
var EventSubscriptionAdminState = {
  RUN: "RUN",
  STOP: "STOP"
};

// src/utils/eventParseError.js
var EventParseError = class extends Error {
  /**
   * The cause of the error.
   * @type {Error}
   * @public
   */
  cause;
  /**
   * The replay ID of the event at the origin of the error.
   * Could be undefined if we're not able to extract it from the event data.
   * @type {number}
   * @public
   */
  replayId;
  /**
   * The un-parsed event data at the origin of the error.
   * @type {Object}
   * @public
   */
  event;
  /**
   * The latest replay ID that was received before the error.
   * There could be more than one event between the replay ID and the event causing the error if the events were processed in batch.
   * @type {number}
   * @public
   */
  latestReplayId;
  /**
   * Builds a new ParseError error.
   * @param {string} message The error message.
   * @param {Error} cause The cause of the error.
   * @param {number} replayId The replay ID of the event at the origin of the error.
   * Could be undefined if we're not able to extract it from the event data.
   * @param {Object} event The un-parsed event data at the origin of the error.
   * @param {number} latestReplayId The latest replay ID that was received before the error.
   * @protected
   */
  constructor(message, cause, replayId, event, latestReplayId) {
    super(message);
    this.cause = cause;
    this.replayId = replayId;
    this.event = event;
    this.latestReplayId = latestReplayId;
  }
};

// src/utils/avroHelper.js
import avro from "avro-js";
var CustomLongAvroType = avro.types.LongType.using({
  fromBuffer: (buf) => {
    const big = buf.readBigInt64LE();
    if (big < Number.MIN_SAFE_INTEGER || big > Number.MAX_SAFE_INTEGER) {
      return big;
    }
    return Number(BigInt.asIntN(64, big));
  },
  toBuffer: (n) => {
    const buf = Buffer.allocUnsafe(8);
    if (n instanceof BigInt) {
      buf.writeBigInt64LE(n);
    } else {
      buf.writeBigInt64LE(BigInt(n));
    }
    return buf;
  },
  fromJSON: BigInt,
  toJSON: Number,
  isValid: (n) => {
    const type = typeof n;
    return type === "number" && n % 1 === 0 || type === "bigint";
  },
  compare: (n1, n2) => {
    return n1 === n2 ? 0 : n1 < n2 ? -1 : 1;
  }
});

// src/utils/configurationLoader.js
var DEFAULT_PUB_SUB_ENDPOINT = "api.pubsub.salesforce.com:7443";
var ConfigurationLoader = class _ConfigurationLoader {
  /**
   * @param {Configuration} config the client configuration
   * @returns {Configuration} the sanitized client configuration
   */
  static load(config) {
    config.pubSubEndpoint = config.pubSubEndpoint ?? DEFAULT_PUB_SUB_ENDPOINT;
    _ConfigurationLoader.#checkMandatoryVariables(config, ["authType"]);
    switch (config.authType) {
      case AuthType.USER_SUPPLIED:
        config = _ConfigurationLoader.#loadUserSuppliedAuth(config);
        break;
      case AuthType.USERNAME_PASSWORD:
        _ConfigurationLoader.#checkMandatoryVariables(config, [
          "loginUrl",
          "username",
          "password"
        ]);
        config.userToken = config.userToken ?? "";
        break;
      case AuthType.OAUTH_CLIENT_CREDENTIALS:
        _ConfigurationLoader.#checkMandatoryVariables(config, [
          "loginUrl",
          "clientId",
          "clientSecret"
        ]);
        break;
      case AuthType.OAUTH_JWT_BEARER:
        _ConfigurationLoader.#checkMandatoryVariables(config, [
          "loginUrl",
          "clientId",
          "username",
          "privateKey"
        ]);
        break;
      default:
        throw new Error(
          `Unsupported authType value: ${config.authType}`
        );
    }
    return config;
  }
  /**
   * @param {Configuration} config the client configuration
   * @returns {Configuration} sanitized configuration
   */
  static #loadUserSuppliedAuth(config) {
    _ConfigurationLoader.#checkMandatoryVariables(config, [
      "accessToken",
      "instanceUrl"
    ]);
    if (!config.instanceUrl.startsWith("https://")) {
      throw new Error(
        `Invalid Salesforce Instance URL format supplied: ${config.instanceUrl}`
      );
    }
    if (!config.organizationId) {
      try {
        config.organizationId = config.accessToken.split("!").at(0);
      } catch (error) {
        throw new Error(
          "Unable to parse organizationId from access token",
          {
            cause: error
          }
        );
      }
    }
    if (config.organizationId.length !== 15 && config.organizationId.length !== 18) {
      throw new Error(
        `Invalid Salesforce Org ID format supplied: ${config.organizationId}`
      );
    }
    return config;
  }
  static #checkMandatoryVariables(config, varNames) {
    varNames.forEach((varName) => {
      if (!config[varName]) {
        throw new Error(
          `Missing value for ${varName} mandatory configuration key`
        );
      }
    });
  }
};

// src/utils/eventParser.js
import avro2 from "avro-js";
function parseEvent(schema, event) {
  const allFields = schema.type.getFields();
  const replayId = decodeReplayId(event.replayId);
  const payload = schema.type.fromBuffer(event.event.payload);
  if (payload.ChangeEventHeader) {
    try {
      payload.ChangeEventHeader.nulledFields = parseFieldBitmaps(
        allFields,
        payload.ChangeEventHeader.nulledFields
      );
    } catch (error) {
      throw new Error("Failed to parse nulledFields", { cause: error });
    }
    try {
      payload.ChangeEventHeader.diffFields = parseFieldBitmaps(
        allFields,
        payload.ChangeEventHeader.diffFields
      );
    } catch (error) {
      throw new Error("Failed to parse diffFields", { cause: error });
    }
    try {
      payload.ChangeEventHeader.changedFields = parseFieldBitmaps(
        allFields,
        payload.ChangeEventHeader.changedFields
      );
    } catch (error) {
      throw new Error("Failed to parse changedFields", { cause: error });
    }
  }
  flattenSinglePropertyObjects(payload);
  return {
    replayId,
    payload
  };
}
function flattenSinglePropertyObjects(theObject) {
  Object.entries(theObject).forEach(([key, value]) => {
    if (key !== "ChangeEventHeader" && value && typeof value === "object") {
      const subKeys = Object.keys(value);
      if (subKeys.length === 1) {
        const subValue = value[subKeys[0]];
        theObject[key] = subValue;
        if (subValue && typeof subValue === "object") {
          flattenSinglePropertyObjects(theObject[key]);
        }
      }
    }
  });
}
function parseFieldBitmaps(allFields, fieldBitmapsAsHex) {
  if (fieldBitmapsAsHex.length === 0) {
    return [];
  }
  let fieldNames = [];
  if (fieldBitmapsAsHex[0].startsWith("0x")) {
    fieldNames = getFieldNamesFromBitmap(allFields, fieldBitmapsAsHex[0]);
  }
  if (fieldBitmapsAsHex.length > 1 && fieldBitmapsAsHex[fieldBitmapsAsHex.length - 1].indexOf("-") !== -1) {
    fieldBitmapsAsHex.forEach((fieldBitmapAsHex) => {
      const bitmapMapStrings = fieldBitmapAsHex.split("-");
      if (bitmapMapStrings.length >= 2) {
        const parentField = allFields[parseInt(bitmapMapStrings[0], 10)];
        const childFields = getChildFields(parentField);
        const childFieldNames = getFieldNamesFromBitmap(
          childFields,
          bitmapMapStrings[1]
        );
        fieldNames = fieldNames.concat(
          childFieldNames.map(
            (fieldName) => `${parentField._name}.${fieldName}`
          )
        );
      }
    });
  }
  return fieldNames;
}
function getChildFields(parentField) {
  const types = parentField._type.getTypes();
  let fields = [];
  types.forEach((type) => {
    if (type instanceof avro2.types.RecordType) {
      fields = fields.concat(type.getFields());
    }
  });
  return fields;
}
function getFieldNamesFromBitmap(fields, fieldBitmapAsHex) {
  let binValue = hexToBin(fieldBitmapAsHex);
  binValue = binValue.split("").reverse().join("");
  const fieldNames = [];
  for (let i = 0; i < binValue.length && i < fields.length; i++) {
    if (binValue[i] === "1") {
      fieldNames.push(fields[i].getName());
    }
  }
  return fieldNames;
}
function decodeReplayId(encodedReplayId) {
  return Number(encodedReplayId.readBigUInt64BE());
}
function encodeReplayId(replayId) {
  const buf = Buffer.allocUnsafe(8);
  buf.writeBigUInt64BE(BigInt(replayId), 0);
  return buf;
}
function toJsonString(event) {
  return JSON.stringify(
    event,
    (key, value) => (
      /* Convert BigInt values into strings and keep other types unchanged */
      typeof value === "bigint" ? value.toString() : value
    )
  );
}
function hexToBin(hex) {
  let bin = hex.substring(2);
  bin = bin.replaceAll("0", "0000");
  bin = bin.replaceAll("1", "0001");
  bin = bin.replaceAll("2", "0010");
  bin = bin.replaceAll("3", "0011");
  bin = bin.replaceAll("4", "0100");
  bin = bin.replaceAll("5", "0101");
  bin = bin.replaceAll("6", "0110");
  bin = bin.replaceAll("7", "0111");
  bin = bin.replaceAll("8", "1000");
  bin = bin.replaceAll("9", "1001");
  bin = bin.replaceAll("A", "1010");
  bin = bin.replaceAll("B", "1011");
  bin = bin.replaceAll("C", "1100");
  bin = bin.replaceAll("D", "1101");
  bin = bin.replaceAll("E", "1110");
  bin = bin.replaceAll("F", "1111");
  return bin;
}

// src/utils/toolingApiHelper.js
import jsforce from "jsforce";
var API_VERSION = "62.0";
var MANAGED_SUBSCRIPTION_KEY_PREFIX = "18x";
async function getManagedSubscription(instanceUrl, accessToken, subscriptionIdOrName) {
  const conn = new jsforce.Connection({ instanceUrl, accessToken });
  if (subscriptionIdOrName.indexOf("'") !== -1) {
    throw new Error(
      `Suspected SOQL injection in subscription ID or name string value: ${subscriptionIdOrName}`
    );
  }
  let filter;
  if ((subscriptionIdOrName.length === 15 || subscriptionIdOrName.length === 18) && subscriptionIdOrName.toLowerCase().startsWith(MANAGED_SUBSCRIPTION_KEY_PREFIX)) {
    filter = `Id='${subscriptionIdOrName}'`;
  } else {
    filter = `DeveloperName='${subscriptionIdOrName}'`;
  }
  const query = `SELECT Id, DeveloperName, Metadata FROM ManagedEventSubscription WHERE ${filter} LIMIT 1`;
  const res = await conn.request(
    `/services/data/v${API_VERSION}/tooling/query/?q=${encodeURIComponent(query)}`
  );
  if (res.size === 0) {
    throw new Error(
      `Failed to retrieve managed event subscription with ${filter}`
    );
  }
  return res.records[0];
}

// src/utils/auth.js
import crypto from "crypto";
import jsforce2 from "jsforce";
import { fetch } from "undici";
var SalesforceAuth = class {
  /**
   * Client configuration
   * @type {Configuration}
   */
  #config;
  /**
   * Logger
   * @type {Logger}
   */
  #logger;
  /**
   * Builds a new Pub/Sub API client
   * @param {Configuration} config the client configuration
   * @param {Logger} logger a logger
   */
  constructor(config, logger) {
    this.#config = config;
    this.#logger = logger;
  }
  /**
   * Authenticates with the auth mode specified in configuration
   * @returns {ConnectionMetadata}
   */
  async authenticate() {
    this.#logger.debug(`Authenticating with ${this.#config.authType} mode`);
    switch (this.#config.authType) {
      case AuthType.USER_SUPPLIED:
        throw new Error(
          "Authenticate method should not be called in user-supplied mode."
        );
      case AuthType.USERNAME_PASSWORD:
        return this.#authWithUsernamePassword();
      case AuthType.OAUTH_CLIENT_CREDENTIALS:
        return this.#authWithOAuthClientCredentials();
      case AuthType.OAUTH_JWT_BEARER:
        return this.#authWithJwtBearer();
      default:
        throw new Error(
          `Unsupported authType value: ${this.#config.authType}`
        );
    }
  }
  /**
   * Authenticates with the username/password flow
   * @returns {ConnectionMetadata}
   */
  async #authWithUsernamePassword() {
    const { loginUrl, username, password, userToken } = this.#config;
    const sfConnection = new jsforce2.Connection({
      loginUrl
    });
    await sfConnection.login(username, `${password}${userToken}`);
    return {
      accessToken: sfConnection.accessToken,
      instanceUrl: sfConnection.instanceUrl,
      organizationId: sfConnection.userInfo.organizationId,
      username
    };
  }
  /**
   * Authenticates with the OAuth 2.0 client credentials flow
   * @returns {ConnectionMetadata}
   */
  async #authWithOAuthClientCredentials() {
    const { clientId, clientSecret } = this.#config;
    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");
    params.append("client_id", clientId);
    params.append("client_secret", clientSecret);
    return this.#authWithOAuth(params.toString());
  }
  /**
   * Authenticates with the OAuth 2.0 JWT bearer flow
   * @returns {ConnectionMetadata}
   */
  async #authWithJwtBearer() {
    const { clientId, username, loginUrl, privateKey } = this.#config;
    if (!privateKey.toString().trim().startsWith("-----BEGIN RSA PRIVATE KEY-----")) {
      throw new Error(
        `Private key is missing -----BEGIN RSA PRIVATE KEY----- header`
      );
    }
    const header = JSON.stringify({ alg: "RS256" });
    const claims = JSON.stringify({
      iss: clientId,
      sub: username,
      aud: loginUrl,
      exp: Math.floor(Date.now() / 1e3) + 60 * 5
    });
    let token = `${base64url(header)}.${base64url(claims)}`;
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(token);
    sign.end();
    token += `.${base64url(sign.sign(privateKey))}`;
    const body = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`;
    return this.#authWithOAuth(body);
  }
  /**
   * Generic OAuth 2.0 connect method
   * @param {string} body URL encoded body
   * @returns {ConnectionMetadata} connection metadata
   */
  async #authWithOAuth(body) {
    const { loginUrl } = this.#config;
    const loginResponse = await fetch(`${loginUrl}/services/oauth2/token`, {
      method: "post",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });
    if (loginResponse.status !== 200) {
      throw new Error(
        `Authentication error: HTTP ${loginResponse.status} - ${await loginResponse.text()}`
      );
    }
    const { access_token, instance_url } = await loginResponse.json();
    const userInfoResponse = await fetch(
      `${loginUrl}/services/oauth2/userinfo`,
      {
        headers: { authorization: `Bearer ${access_token}` }
      }
    );
    if (userInfoResponse.status !== 200) {
      throw new Error(
        `Failed to retrieve user info: HTTP ${userInfoResponse.status} - ${await userInfoResponse.text()}`
      );
    }
    const { organization_id, preferred_username } = await userInfoResponse.json();
    return {
      accessToken: access_token,
      instanceUrl: instance_url,
      organizationId: organization_id,
      username: preferred_username
    };
  }
};
function base64url(input) {
  const buf = Buffer.from(input, "utf8");
  return buf.toString("base64url");
}

// src/client.js
var MAX_EVENT_BATCH_SIZE = 100;
var PubSubApiClient = class {
  /**
   * Client configuration
   * @type {Configuration}
   */
  #config;
  /**
   * gRPC client
   * @type {Object}
   */
  #client;
  /**
   * Map of schemas indexed by ID
   * @type {Map<string,Schema>}
   */
  #schemas;
  /**
   * Map of subscriptions indexed by topic name
   * @type {Map<string,Subscription>}
   */
  #subscriptions;
  /**
   * Map of managed subscriptions indexed by subscription ID
   * @type {Map<string,Subscription>}
   */
  #managedSubscriptions;
  /**
   * Map of publish streams indexed by topic name
   * @type {Map<string,PublishStream>}
   */
  #publishStreams;
  /**
   * Logger
   * @type {Logger}
   */
  #logger;
  /**
   * Builds a new Pub/Sub API client
   * @param {Configuration} config the client configuration
   * @param {Logger} [logger] an optional custom logger. The client uses the console if no value is supplied.
   */
  constructor(config, logger = console) {
    this.#logger = logger;
    this.#schemas = /* @__PURE__ */ new Map();
    this.#subscriptions = /* @__PURE__ */ new Map();
    this.#managedSubscriptions = /* @__PURE__ */ new Map();
    this.#publishStreams = /* @__PURE__ */ new Map();
    try {
      this.#config = ConfigurationLoader.load(config);
    } catch (error) {
      this.#logger.error(error);
      throw new Error("Failed to initialize Pub/Sub API client", {
        cause: error
      });
    }
  }
  /**
   * Authenticates with Salesforce (if not using user-supplied authentication mode) then,
   * connects to the Pub/Sub API.
   * @returns {Promise<void>} Promise that resolves once the connection is established
   */
  async connect() {
    if (this.#config.authType !== AuthType.USER_SUPPLIED) {
      try {
        const auth = new SalesforceAuth(this.#config, this.#logger);
        const conMetadata = await auth.authenticate();
        this.#config.accessToken = conMetadata.accessToken;
        this.#config.username = conMetadata.username;
        this.#config.instanceUrl = conMetadata.instanceUrl;
        this.#config.organizationId = conMetadata.organizationId;
        this.#logger.info(
          `Connected to Salesforce org ${conMetadata.instanceUrl} (${this.#config.organizationId}) as ${conMetadata.username}`
        );
      } catch (error) {
        throw new Error("Failed to authenticate with Salesforce", {
          cause: error
        });
      }
    }
    try {
      this.#logger.debug(`Connecting to Pub/Sub API`);
      const rootCert = fs.readFileSync(certifi);
      const protoFilePath = fileURLToPath(
        new URL("./pubsub_api-07e1f84a.proto?hash=07e1f84a", import.meta.url)
      );
      const packageDef = protoLoader.loadSync(protoFilePath, {});
      const grpcObj = grpc.loadPackageDefinition(packageDef);
      const sfdcPackage = grpcObj.eventbus.v1;
      const metaCallback = (_params, callback) => {
        const meta = new grpc.Metadata();
        meta.add("accesstoken", this.#config.accessToken);
        meta.add("instanceurl", this.#config.instanceUrl);
        meta.add("tenantid", this.#config.organizationId);
        callback(null, meta);
      };
      const callCreds = grpc.credentials.createFromMetadataGenerator(metaCallback);
      const combCreds = grpc.credentials.combineChannelCredentials(
        grpc.credentials.createSsl(rootCert),
        callCreds
      );
      this.#client = new sfdcPackage.PubSub(
        this.#config.pubSubEndpoint,
        combCreds
      );
      this.#logger.info(
        `Connected to Pub/Sub API endpoint ${this.#config.pubSubEndpoint}`
      );
    } catch (error) {
      throw new Error("Failed to connect to Pub/Sub API", {
        cause: error
      });
    }
  }
  /**
   * Gets the gRPC connectivity state from the current channel.
   * @returns {Promise<connectivityState>} Promise that holds channel's connectivity information {@link connectivityState}
   */
  async getConnectivityState() {
    return this.#client?.getChannel()?.getConnectivityState(false);
  }
  /**
   * Subscribes to a topic and retrieves all past events in retention window.
   * @param {string} topicName name of the topic that we're subscribing to
   * @param {SubscribeCallback} subscribeCallback callback function for handling subscription events
   * @param {number | null} [numRequested] optional number of events requested. If not supplied or null, the client keeps the subscription alive forever.
   */
  subscribeFromEarliestEvent(topicName, subscribeCallback, numRequested = null) {
    this.#subscribe(
      {
        topicName,
        numRequested,
        replayPreset: 1
      },
      subscribeCallback
    );
  }
  /**
   * Subscribes to a topic and retrieves past events starting from a replay ID.
   * @param {string} topicName name of the topic that we're subscribing to
   * @param {SubscribeCallback} subscribeCallback callback function for handling subscription events
   * @param {number | null} numRequested number of events requested. If null, the client keeps the subscription alive forever.
   * @param {number} replayId replay ID
   */
  subscribeFromReplayId(topicName, subscribeCallback, numRequested, replayId) {
    this.#subscribe(
      {
        topicName,
        numRequested,
        replayPreset: 2,
        replayId: encodeReplayId(replayId)
      },
      subscribeCallback
    );
  }
  /**
   * Subscribes to a topic.
   * @param {string} topicName name of the topic that we're subscribing to
   * @param {SubscribeCallback} subscribeCallback callback function for handling subscription events
   * @param {number | null} [numRequested] optional number of events requested. If not supplied or null, the client keeps the subscription alive forever.
   */
  subscribe(topicName, subscribeCallback, numRequested = null) {
    this.#subscribe(
      {
        topicName,
        numRequested
      },
      subscribeCallback
    );
  }
  /**
   * Subscribes to a topic using the gRPC client and an event schema
   * @param {SubscribeRequest} subscribeRequest subscription request
   * @param {SubscribeCallback} subscribeCallback callback function for handling subscription events
   */
  #subscribe(subscribeRequest, subscribeCallback) {
    this.#logger.debug(
      `Preparing subscribe request: ${toJsonString(subscribeRequest)}`
    );
    if (!this.#client) {
      throw new Error("Pub/Sub API client is not connected.");
    }
    let { topicName, numRequested } = subscribeRequest;
    try {
      let isInfiniteEventRequest = false;
      if (numRequested === null || numRequested === void 0) {
        isInfiniteEventRequest = true;
        subscribeRequest.numRequested = numRequested = MAX_EVENT_BATCH_SIZE;
      } else {
        subscribeRequest.numRequested = this.#validateRequestedEventCount(topicName, numRequested);
      }
      if (!this.#client) {
        throw new Error("Pub/Sub API client is not connected.");
      }
      let subscription = this.#subscriptions.get(topicName);
      let grpcSubscription;
      if (subscription) {
        this.#logger.debug(
          `${topicName} - Reusing cached gRPC subscription`
        );
        grpcSubscription = subscription.grpcSubscription;
        subscription.info.receivedEventCount = 0;
        subscription.info.requestedEventCount = subscribeRequest.numRequested;
        subscription.info.isInfiniteEventRequest = isInfiniteEventRequest;
      } else {
        this.#logger.debug(
          `${topicName} - Establishing new gRPC subscription`
        );
        grpcSubscription = this.#client.Subscribe();
        subscription = {
          info: {
            isManaged: false,
            topicName,
            requestedEventCount: subscribeRequest.numRequested,
            receivedEventCount: 0,
            lastReplayId: null
          },
          grpcSubscription,
          subscribeCallback
        };
        this.#subscriptions.set(topicName, subscription);
      }
      this.#injectEventHandlingLogic(subscription);
      grpcSubscription.write(subscribeRequest);
      this.#logger.info(
        `${topicName} - Subscribe request sent for ${numRequested} events`
      );
    } catch (error) {
      throw new Error(
        `Failed to subscribe to events for topic ${topicName}`,
        { cause: error }
      );
    }
  }
  /**
   * Subscribes to a topic thanks to a managed subscription.
   * @param {string} subscriptionIdOrName managed subscription ID or developer name
   * @param {SubscribeCallback} subscribeCallback callback function for handling subscription events
   * @param {number | null} [numRequested] optional number of events requested. If not supplied or null, the client keeps the subscription alive forever.
   * @throws Throws an error if the managed subscription does not exist or is not in the `RUN` state.
   */
  async subscribeWithManagedSubscription(subscriptionIdOrName, subscribeCallback, numRequested = null) {
    this.#logger.debug(
      `Preparing managed subscribe request: ${toJsonString({ subscriptionIdOrName, numRequested })}`
    );
    if (!this.#client) {
      throw new Error("Pub/Sub API client is not connected.");
    }
    const managedSubscription = await getManagedSubscription(
      this.#config.instanceUrl,
      this.#config.accessToken,
      subscriptionIdOrName
    );
    const subscriptionId = managedSubscription.Id;
    const subscriptionName = managedSubscription.DeveloperName;
    const subscriptionLabel = `${subscriptionName} (${subscriptionId})`;
    const { topicName, state } = managedSubscription.Metadata;
    this.#logger.info(
      `Retrieved managed subscription ${subscriptionLabel}: ${toJsonString(managedSubscription.Metadata)}`
    );
    if (state !== EventSubscriptionAdminState.RUN) {
      throw new Error(
        `Can't subscribe to managed subscription ${subscriptionLabel}: subscription is in ${state} state`
      );
    }
    try {
      let isInfiniteEventRequest = false;
      if (numRequested === null || numRequested === void 0) {
        isInfiniteEventRequest = true;
        numRequested = MAX_EVENT_BATCH_SIZE;
      } else {
        numRequested = this.#validateRequestedEventCount(
          topicName,
          numRequested
        );
      }
      if (!this.#client) {
        throw new Error("Pub/Sub API client is not connected.");
      }
      let subscription = this.#managedSubscriptions.get(subscriptionId);
      let grpcSubscription;
      if (subscription) {
        this.#logger.debug(
          `${topicName} - Reusing cached gRPC subscription`
        );
        grpcSubscription = subscription.grpcSubscription;
        subscription.info.receivedEventCount = 0;
        subscription.info.requestedEventCount = numRequested;
        subscription.info.isInfiniteEventRequest = isInfiniteEventRequest;
      } else {
        this.#logger.debug(
          `${topicName} - Establishing new gRPC subscription`
        );
        grpcSubscription = this.#client.ManagedSubscribe();
        subscription = {
          info: {
            isManaged: true,
            topicName,
            subscriptionId,
            subscriptionName,
            requestedEventCount: numRequested,
            receivedEventCount: 0,
            lastReplayId: null
          },
          grpcSubscription,
          subscribeCallback
        };
        this.#managedSubscriptions.set(subscriptionId, subscription);
      }
      this.#injectEventHandlingLogic(subscription);
      grpcSubscription.write({
        subscriptionId,
        numRequested
      });
      this.#logger.info(
        `${topicName} - Managed subscribe request sent to ${subscriptionLabel} for ${numRequested} events`
      );
    } catch (error) {
      throw new Error(
        `Failed to subscribe to managed subscription ${subscriptionLabel}`,
        { cause: error }
      );
    }
  }
  /**
   * Request additional events on an existing subscription.
   * @param {string} topicName topic name
   * @param {number} numRequested number of events requested
   */
  requestAdditionalEvents(topicName, numRequested) {
    if (!this.#client) {
      throw new Error("Pub/Sub API client is not connected.");
    }
    const subscription = this.#subscriptions.get(topicName);
    if (!subscription) {
      throw new Error(
        `Failed to request additional events for topic ${topicName}: no active subscription found.`
      );
    }
    subscription.info.receivedEventCount = 0;
    subscription.info.requestedEventCount = numRequested;
    subscription.grpcSubscription.write({
      topicName,
      numRequested
    });
    this.#logger.debug(
      `${topicName} - Resubscribing to a batch of ${numRequested} events`
    );
  }
  /**
   * Request additional events on an existing managed subscription.
   * @param {string} subscriptionId managed subscription ID
   * @param {number} numRequested number of events requested
   */
  requestAdditionalManagedEvents(subscriptionId, numRequested) {
    if (!this.#client) {
      throw new Error("Pub/Sub API client is not connected.");
    }
    const subscription = this.#managedSubscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(
        `Failed to request additional events for managed subscription with ID ${subscriptionId}: no active subscription found.`
      );
    }
    subscription.info.receivedEventCount = 0;
    subscription.info.requestedEventCount = numRequested;
    subscription.grpcSubscription.write({
      subscriptionId,
      numRequested
    });
    const { subscriptionName } = subscription.info;
    this.#logger.debug(
      `${subscriptionName} (${subscriptionId}) - Resubscribing to a batch of ${numRequested} events`
    );
  }
  /**
   * Commits a replay ID on a managed subscription.
   * @param {string} subscriptionId managed subscription ID
   * @param {number} replayId event replay ID
   * @returns {string} commit request UUID
   */
  commitReplayId(subscriptionId, replayId) {
    if (!this.#client) {
      throw new Error("Pub/Sub API client is not connected.");
    }
    const subscription = this.#managedSubscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(
        `Failed to commit a replay ID on managed subscription with ID ${subscriptionId}: no active subscription found.`
      );
    }
    const commitRequestId = crypto2.randomUUID();
    subscription.grpcSubscription.write({
      subscriptionId,
      commitReplayIdRequest: {
        commitRequestId,
        replayId: encodeReplayId(replayId)
      }
    });
    const { subscriptionName } = subscription.info;
    this.#logger.debug(
      `${subscriptionName} (${subscriptionId}) - Sent replay ID commit request (request ID: ${commitRequestId}, replay ID: ${replayId})`
    );
    return commitRequestId;
  }
  /**
   * Publishes a payload to a topic using the gRPC client. This is a synchronous operation, use `publishBatch` when publishing event batches.
   * @param {string} topicName name of the topic that we're publishing on
   * @param {Object} payload payload of the event that is being published
   * @param {string} [correlationKey] optional correlation key. If you don't provide one, we'll generate a random UUID for you.
   * @returns {Promise<PublishResult>} Promise holding a PublishResult object with replayId and correlationKey
   */
  async publish(topicName, payload, correlationKey) {
    try {
      this.#logger.debug(
        `${topicName} - Preparing to publish event: ${toJsonString(payload)}`
      );
      if (!this.#client) {
        throw new Error("Pub/Sub API client is not connected.");
      }
      const schema = await this.#fetchEventSchemaFromTopicNameWithClient(topicName);
      const id = correlationKey ? correlationKey : crypto2.randomUUID();
      const response = await new Promise((resolve, reject) => {
        this.#client.Publish(
          {
            topicName,
            events: [
              {
                id,
                // Correlation key
                schemaId: schema.id,
                payload: schema.type.toBuffer(payload)
              }
            ]
          },
          (err, response2) => {
            if (err) {
              reject(err);
            } else {
              resolve(response2);
            }
          }
        );
      });
      const result = response.results[0];
      result.replayId = decodeReplayId(result.replayId);
      return result;
    } catch (error) {
      throw new Error(`Failed to publish event for topic ${topicName}`, {
        cause: error
      });
    }
  }
  /**
   * Publishes a batch of events using the gRPC client's publish stream.
   * @param {string} topicName name of the topic that we're publishing on
   * @param {ProducerEvent[]} events events to be published
   * @param {PublishCallback} publishCallback callback function for handling publish responses
   */
  async publishBatch(topicName, events, publishCallback) {
    try {
      this.#logger.debug(
        `${topicName} - Preparing to publish a batch of ${events.length} event(s): ${toJsonString(events)}`
      );
      if (!this.#client) {
        throw new Error("Pub/Sub API client is not connected.");
      }
      let publishStream = this.#publishStreams.get(topicName);
      let grpcPublishStream;
      if (publishStream) {
        this.#logger.debug(
          `${topicName} - Reusing cached gRPC publish stream`
        );
        grpcPublishStream = publishStream.grpcPublishStream;
      } else {
        this.#logger.debug(
          `${topicName} - Establishing new gRPC publish stream`
        );
        grpcPublishStream = this.#client.PublishStream();
        publishStream = {
          info: {
            topicName
          },
          grpcPublishStream,
          publishCallback
        };
        this.#publishStreams.set(topicName, publishStream);
      }
      const schema = await this.#fetchEventSchemaFromTopicNameWithClient(topicName);
      grpcPublishStream.removeAllListeners();
      grpcPublishStream.on("data", async (data) => {
        if (data.results) {
          data.results = data.results.map((result) => ({
            replayId: decodeReplayId(result.replayId),
            correlationKey: result.correlationKey
          }));
          this.#logger.info(
            `${topicName} - Received batch publish response for ${data.results.length} events: ${toJsonString(data)}`
          );
          publishCallback(
            publishStream.info,
            PublishCallbackType.PUBLISH_RESPONSE,
            data
          );
        } else {
          this.#logger.debug(
            `${topicName} - Received batch publish keepalive message: ${toJsonString(data)}`
          );
          publishCallback(
            publishStream.info,
            PublishCallbackType.GRPC_KEEP_ALIVE,
            data
          );
        }
      });
      grpcPublishStream.on("error", async (data) => {
        this.#logger.debug(
          `${topicName} - Batch publish error: ${toJsonString(data)}`
        );
        publishCallback(
          publishStream.info,
          PublishCallbackType.ERROR,
          data
        );
      });
      grpcPublishStream.on("status", (status) => {
        this.#logger.info(
          `${topicName} - Batch publish gRPC stream status: ${toJsonString(status)}`
        );
        publishCallback(
          publishStream.info,
          PublishCallbackType.GRPC_STATUS,
          status
        );
      });
      const eventBatch = events.map((baseEvent) => ({
        id: baseEvent.id ? baseEvent.id : crypto2.randomUUID(),
        // Generate ID if not provided
        schemaId: schema.id,
        payload: schema.type.toBuffer(baseEvent.payload)
      }));
      grpcPublishStream.write({
        topicName,
        events: eventBatch
      });
      this.#logger.info(
        `${topicName} - Batch publish request sent with ${events.length} events`
      );
    } catch (error) {
      throw new Error(
        `Failed to publish event batch for topic ${topicName}`,
        {
          cause: error
        }
      );
    }
  }
  /**
   * Closes the gRPC connection. The client will no longer receive events for any topic.
   */
  close() {
    this.#logger.info("Clear subscriptions and streams");
    this.#subscriptions.forEach(
      (sub) => sub.grpcSubscription.removeAllListeners()
    );
    this.#subscriptions.clear();
    this.#managedSubscriptions.forEach(
      (sub) => sub.grpcSubscription.removeAllListeners()
    );
    this.#managedSubscriptions.clear();
    this.#publishStreams.forEach(
      (pub) => pub.grpcPublishStream.removeAllListeners()
    );
    this.#publishStreams.clear();
    this.#schemas.clear();
    this.#logger.info("Closing gRPC client");
    this.#client?.close();
  }
  /**
   * Injects the standard event handling logic on a subscription
   * @param {Subscription} subscription
   */
  #injectEventHandlingLogic(subscription) {
    const { grpcSubscription, subscribeCallback } = subscription;
    const { topicName, subscriptionId, subscriptionName, isManaged } = subscription.info;
    const logLabel = subscription.info.isManaged ? `${subscriptionName} (${subscriptionId})` : topicName;
    grpcSubscription.removeAllListeners();
    grpcSubscription.on("data", async (data) => {
      const latestReplayId = decodeReplayId(data.latestReplayId);
      subscription.info.lastReplayId = latestReplayId;
      if (data.events) {
        this.#logger.info(
          `${logLabel} - Received ${data.events.length} events, latest replay ID: ${latestReplayId}`
        );
        for (const event of data.events) {
          try {
            this.#logger.debug(
              `${logLabel} - Raw event: ${toJsonString(event)}`
            );
            this.#logger.debug(
              `${logLabel} - Retrieving schema ID: ${event.event.schemaId}`
            );
            const schema = await this.#getEventSchemaFromId(
              event.event.schemaId
            );
            let subscription2;
            if (isManaged) {
              subscription2 = this.#managedSubscriptions.get(subscriptionId);
            } else {
              subscription2 = this.#subscriptions.get(topicName);
            }
            if (!subscription2) {
              throw new Error(
                `Failed to retrieve ${isManaged ? "managed " : ""}subscription: ${logLabel}.`
              );
            }
            subscription2.info.receivedEventCount++;
            const parsedEvent = parseEvent(schema, event);
            this.#logger.debug(
              `${logLabel} - Parsed event: ${toJsonString(parsedEvent)}`
            );
            subscribeCallback(
              subscription2.info,
              SubscribeCallbackType.EVENT,
              parsedEvent
            );
          } catch (error) {
            let replayId;
            try {
              if (event.replayId) {
                replayId = decodeReplayId(event.replayId);
              }
            } catch (error2) {
            }
            const message = replayId ? `Failed to parse event with replay ID ${replayId}` : `Failed to parse event with unknown replay ID (latest replay ID was ${latestReplayId})`;
            const parseError = new EventParseError(
              message,
              error,
              replayId,
              event,
              latestReplayId
            );
            subscribeCallback(
              subscription.info,
              SubscribeCallbackType.ERROR,
              parseError
            );
            this.#logger.error(parseError);
          }
          if (subscription.info.receivedEventCount === subscription.info.requestedEventCount) {
            this.#logger.debug(
              `${logLabel} - Reached last of ${subscription.info.requestedEventCount} requested event on channel.`
            );
            if (subscription.info.isInfiniteEventRequest) {
              if (isManaged) {
                this.requestAdditionalManagedEvents(
                  subscription.info.subscriptionId,
                  subscription.info.requestedEventCount
                );
              } else {
                this.requestAdditionalEvents(
                  subscription.info.topicName,
                  subscription.info.requestedEventCount
                );
              }
            } else {
              subscribeCallback(
                subscription.info,
                SubscribeCallbackType.LAST_EVENT
              );
            }
          }
        }
      } else {
        this.#logger.debug(
          `${logLabel} - Received keepalive message. Latest replay ID: ${latestReplayId}`
        );
        data.latestReplayId = latestReplayId;
        subscribeCallback(
          subscription.info,
          SubscribeCallbackType.GRPC_KEEP_ALIVE
        );
      }
    });
    grpcSubscription.on("end", () => {
      if (isManaged) {
        this.#managedSubscriptions.delete(subscriptionId);
      } else {
        this.#subscriptions.delete(topicName);
      }
      this.#logger.info(`${logLabel} - gRPC stream ended`);
      subscribeCallback(subscription.info, SubscribeCallbackType.END);
    });
    grpcSubscription.on("error", (error) => {
      this.#logger.error(
        `${logLabel} - gRPC stream error: ${toJsonString(error)}`
      );
      subscribeCallback(
        subscription.info,
        SubscribeCallbackType.ERROR,
        error
      );
    });
    grpcSubscription.on("status", (status) => {
      this.#logger.info(
        `${logLabel} - gRPC stream status: ${toJsonString(status)}`
      );
      subscribeCallback(
        subscription.info,
        SubscribeCallbackType.GRPC_STATUS,
        status
      );
    });
  }
  /**
   * Retrieves an event schema from the cache based on its ID.
   * If it's not cached, fetches the shema with the gRPC client.
   * @param {string} schemaId ID of the schema that we're fetching
   * @returns {Promise<Schema>} Promise holding parsed event schema
   */
  async #getEventSchemaFromId(schemaId) {
    let schema = this.#schemas.get(schemaId);
    if (!schema) {
      try {
        schema = await this.#fetchEventSchemaFromIdWithClient(schemaId);
        this.#schemas.set(schema.schema, schema);
      } catch (error) {
        throw new Error(`Failed to load schema with ID ${schemaId}`, {
          cause: error
        });
      }
    }
    return schema;
  }
  /**
   * Requests the event schema for a topic using the gRPC client
   * @param {string} topicName name of the topic that we're fetching
   * @returns {Promise<Schema>} Promise holding parsed event schema
   */
  async #fetchEventSchemaFromTopicNameWithClient(topicName) {
    return new Promise((resolve, reject) => {
      this.#client.GetTopic(
        { topicName },
        async (topicError, response) => {
          if (topicError) {
            reject(topicError);
          } else {
            const { schemaId } = response;
            this.#logger.debug(
              `${topicName} - Retrieving schema ID: ${schemaId}`
            );
            let schema = this.#schemas.get(schemaId);
            if (!schema) {
              schema = await this.#fetchEventSchemaFromIdWithClient(
                schemaId
              );
            }
            this.#schemas.set(schema.id, schema);
            resolve(schema);
          }
        }
      );
    });
  }
  /**
   * Requests the event schema from an ID using the gRPC client
   * @param {string} schemaId schema ID that we're fetching
   * @returns {Promise<Schema>} Promise holding parsed event schema
   */
  async #fetchEventSchemaFromIdWithClient(schemaId) {
    return new Promise((resolve, reject) => {
      this.#client.GetSchema({ schemaId }, (schemaError, res) => {
        if (schemaError) {
          reject(schemaError);
        } else {
          const schemaType = avro3.parse(res.schemaJson, {
            registry: { long: CustomLongAvroType }
          });
          resolve({
            id: schemaId,
            type: schemaType
          });
        }
      });
    });
  }
  /**
   * Validates the number of requested events
   * @param {string} topicName for logging purposes
   * @param {number} numRequested number of requested events
   * @returns safe value for number of requested events
   */
  #validateRequestedEventCount(topicName, numRequested) {
    if (typeof numRequested !== "number") {
      throw new Error(
        `Expected a number type for number of requested events but got ${typeof numRequested}`
      );
    }
    if (!Number.isSafeInteger(numRequested) || numRequested < 1) {
      throw new Error(
        `Expected an integer greater than 1 for number of requested events but got ${numRequested}`
      );
    }
    if (numRequested > MAX_EVENT_BATCH_SIZE) {
      this.#logger.warn(
        `The number of requested events for ${topicName} exceeds max event batch size (${MAX_EVENT_BATCH_SIZE}).`
      );
      return MAX_EVENT_BATCH_SIZE;
    }
    return numRequested;
  }
};
export {
  PubSubApiClient as default
};
