var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.js
var client_exports = {};
__export(client_exports, {
  default: () => PubSubApiClient
});
module.exports = __toCommonJS(client_exports);
var import_crypto2 = __toESM(require("crypto"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_url = require("url");
var import_avro_js3 = __toESM(require("avro-js"), 1);
var import_certifi = __toESM(require("certifi"), 1);
var import_grpc_js = __toESM(require("@grpc/grpc-js"), 1);
var import_proto_loader = __toESM(require("@grpc/proto-loader"), 1);
var import_grpc_js2 = require("@grpc/grpc-js");

// src/utils/schemaCache.js
var SchemaCache = class {
  /**
   * Map of schemas indexed by ID
   * @type {Map<string,Schema>}
   */
  #schemaChache;
  constructor() {
    this.#schemaChache = /* @__PURE__ */ new Map();
  }
  /**
   * Retrieves a schema based on its ID
   * @param {string} schemaId
   * @returns {Schema} schema or undefined if not found
   */
  getFromId(schemaId) {
    return this.#schemaChache.get(schemaId);
  }
  /**
   * Caches a schema
   * @param {Schema} schema
   */
  set(schema) {
    this.#schemaChache.set(schema.id, schema);
  }
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
var import_avro_js = __toESM(require("avro-js"), 1);
var CustomLongAvroType = import_avro_js.default.types.LongType.using({
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

// src/utils/configuration.js
var DEFAULT_PUB_SUB_ENDPOINT = "api.pubsub.salesforce.com:7443";
var AuthType = {
  USER_SUPPLIED: "user-supplied",
  USERNAME_PASSWORD: "username-password",
  OAUTH_CLIENT_CREDENTIALS: "oauth-client-credentials",
  OAUTH_JWT_BEARER: "oauth-jwt-bearer"
};
var Configuration = class _Configuration {
  /**
   * @param {Configuration} config the client configuration
   * @returns {Configuration} the sanitized client configuration
   */
  static load(config) {
    config.pubSubEndpoint = config.pubSubEndpoint ?? DEFAULT_PUB_SUB_ENDPOINT;
    _Configuration.#checkMandatoryVariables(config, ["authType"]);
    switch (config.authType) {
      case AuthType.USER_SUPPLIED:
        config = _Configuration.#loadUserSuppliedAuth(config);
        break;
      case AuthType.USERNAME_PASSWORD:
        _Configuration.#checkMandatoryVariables(config, [
          "loginUrl",
          "username",
          "password"
        ]);
        config.userToken = config.userToken ?? "";
        break;
      case AuthType.OAUTH_CLIENT_CREDENTIALS:
        _Configuration.#checkMandatoryVariables(config, [
          "loginUrl",
          "clientId",
          "clientSecret"
        ]);
        break;
      case AuthType.OAUTH_JWT_BEARER:
        _Configuration.#checkMandatoryVariables(config, [
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
    _Configuration.#checkMandatoryVariables(config, [
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
var import_avro_js2 = __toESM(require("avro-js"), 1);
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
    if (type instanceof import_avro_js2.default.types.RecordType) {
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

// src/utils/auth.js
var import_crypto = __toESM(require("crypto"), 1);
var import_jsforce = __toESM(require("jsforce"), 1);
var import_undici = require("undici");
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
    const sfConnection = new import_jsforce.default.Connection({
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
    const sign = import_crypto.default.createSign("RSA-SHA256");
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
    const loginResponse = await (0, import_undici.fetch)(`${loginUrl}/services/oauth2/token`, {
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
    const userInfoResponse = await (0, import_undici.fetch)(
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
var SubscribeCallbackType = {
  EVENT: "event",
  LAST_EVENT: "lastEvent",
  ERROR: "error",
  END: "end",
  GRPC_STATUS: "grpcStatus",
  GRPC_KEEP_ALIVE: "grpcKeepAlive"
};
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
   * Schema cache
   * @type {SchemaCache}
   */
  #schemaChache;
  /**
   * Map of subscriptions indexed by topic name
   * @type {Map<string,Subscription>}
   */
  #subscriptions;
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
    this.#schemaChache = new SchemaCache();
    this.#subscriptions = /* @__PURE__ */ new Map();
    try {
      this.#config = Configuration.load(config);
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
   * @memberof PubSubApiClient.prototype
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
      const rootCert = import_fs.default.readFileSync(import_certifi.default);
      const protoFilePath = (0, import_url.fileURLToPath)(
        new URL("./pubsub_api-07e1f84a.proto?hash=07e1f84a", "file://" + __filename)
      );
      const packageDef = import_proto_loader.default.loadSync(protoFilePath, {});
      const grpcObj = import_grpc_js.default.loadPackageDefinition(packageDef);
      const sfdcPackage = grpcObj.eventbus.v1;
      const metaCallback = (_params, callback) => {
        const meta = new import_grpc_js.default.Metadata();
        meta.add("accesstoken", this.#config.accessToken);
        meta.add("instanceurl", this.#config.instanceUrl);
        meta.add("tenantid", this.#config.organizationId);
        callback(null, meta);
      };
      const callCreds = import_grpc_js.default.credentials.createFromMetadataGenerator(metaCallback);
      const combCreds = import_grpc_js.default.credentials.combineChannelCredentials(
        import_grpc_js.default.credentials.createSsl(rootCert),
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
   * Get connectivity state from current channel.
   * @returns {Promise<connectivityState>} Promise that holds channel's connectivity information {@link connectivityState}
   * @memberof PubSubApiClient.prototype
   */
  async getConnectivityState() {
    return this.#client?.getChannel()?.getConnectivityState(false);
  }
  /**
   * Subscribes to a topic and retrieves all past events in retention window.
   * @param {string} topicName name of the topic that we're subscribing to
   * @param {SubscribeCallback} subscribeCallback callback function for handling subscription events
   * @param {number | null} [numRequested] optional number of events requested. If not supplied or null, the client keeps the subscription alive forever.
   * @memberof PubSubApiClient.prototype
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
   * @memberof PubSubApiClient.prototype
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
   * @memberof PubSubApiClient.prototype
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
      `Preparing subscribe request: ${JSON.stringify(subscribeRequest)}`
    );
    let { topicName, numRequested } = subscribeRequest;
    try {
      let isInfiniteEventRequest = false;
      if (numRequested === null || numRequested === void 0) {
        isInfiniteEventRequest = true;
        subscribeRequest.numRequested = numRequested = MAX_EVENT_BATCH_SIZE;
      } else {
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
          subscribeRequest.numRequested = MAX_EVENT_BATCH_SIZE;
        }
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
      } else {
        this.#logger.debug(
          `${topicName} - Establishing new gRPC subscription`
        );
        grpcSubscription = this.#client.Subscribe();
        subscription = {
          info: {
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
      grpcSubscription.on("data", async (data) => {
        const latestReplayId = decodeReplayId(data.latestReplayId);
        subscription.info.lastReplayId = latestReplayId;
        if (data.events) {
          this.#logger.info(
            `${topicName} - Received ${data.events.length} events, latest replay ID: ${latestReplayId}`
          );
          for (const event of data.events) {
            try {
              this.#logger.debug(
                `${topicName} - Raw event: ${toJsonString(event)}`
              );
              this.#logger.debug(
                `${topicName} - Retrieving schema ID: ${event.event.schemaId}`
              );
              const schema = await this.#getEventSchemaFromId(
                event.event.schemaId
              );
              const subscription2 = this.#subscriptions.get(topicName);
              if (!subscription2) {
                throw new Error(
                  `Failed to retrieve subscription for topic ${topicName}.`
                );
              }
              subscription2.info.receivedEventCount++;
              const parsedEvent = parseEvent(schema, event);
              this.#logger.debug(
                `${topicName} - Parsed event: ${toJsonString(parsedEvent)}`
              );
              subscribeCallback(
                subscription2.info,
                SubscribeCallbackType.EVENT,
                parsedEvent
              );
            } catch (error) {
              let replayId;
              try {
                replayId = decodeReplayId(event.replayId);
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
              if (isInfiniteEventRequest) {
                this.requestAdditionalEvents(
                  subscription.info.topicName,
                  subscription.info.requestedEventCount
                );
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
            `${topicName} - Received keepalive message. Latest replay ID: ${latestReplayId}`
          );
          data.latestReplayId = latestReplayId;
          subscribeCallback(
            subscription.info,
            SubscribeCallbackType.GRPC_KEEP_ALIVE
          );
        }
      });
      grpcSubscription.on("end", () => {
        this.#subscriptions.delete(topicName);
        this.#logger.info(`${topicName} - gRPC stream ended`);
        subscribeCallback(subscription.info, SubscribeCallbackType.END);
      });
      grpcSubscription.on("error", (error) => {
        this.#logger.error(
          `${topicName} - gRPC stream error: ${JSON.stringify(error)}`
        );
        subscribeCallback(
          subscription.info,
          SubscribeCallbackType.ERROR,
          error
        );
      });
      grpcSubscription.on("status", (status) => {
        this.#logger.info(
          `${topicName} - gRPC stream status: ${JSON.stringify(status)}`
        );
        subscribeCallback(
          subscription.info,
          SubscribeCallbackType.GRPC_STATUS,
          status
        );
      });
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
   * Request additional events on an existing subscription.
   * @param {string} topicName topic name
   * @param {number} numRequested number of events requested.
   */
  requestAdditionalEvents(topicName, numRequested) {
    const subscription = this.#subscriptions.get(topicName);
    if (!subscription) {
      throw new Error(
        `Failed to request additional events for topic ${topicName}, no active subscription found.`
      );
    }
    subscription.receivedEventCount = 0;
    subscription.requestedEventCount = numRequested;
    subscription.write({
      topicName,
      numRequested
    });
    this.#logger.debug(
      `${topicName} - Resubscribing to a batch of ${numRequested} events`
    );
  }
  /**
   * Publishes a payload to a topic using the gRPC client.
   * @param {string} topicName name of the topic that we're subscribing to
   * @param {Object} payload
   * @param {string} [correlationKey] optional correlation key. If you don't provide one, we'll generate a random UUID for you.
   * @returns {Promise<PublishResult>} Promise holding a PublishResult object with replayId and correlationKey
   * @memberof PubSubApiClient.prototype
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
      const id = correlationKey ? correlationKey : import_crypto2.default.randomUUID();
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
   * Closes the gRPC connection. The client will no longer receive events for any topic.
   * @memberof PubSubApiClient.prototype
   */
  close() {
    this.#logger.info("Clear subscriptions");
    this.#subscriptions.clear();
    this.#logger.info("Closing gRPC stream");
    this.#client?.close();
  }
  /**
   * Retrieves an event schema from the cache based on its ID.
   * If it's not cached, fetches the shema with the gRPC client.
   * @param {string} schemaId ID of the schema that we're fetching
   * @returns {Promise<Schema>} Promise holding parsed event schema
   */
  async #getEventSchemaFromId(schemaId) {
    let schema = this.#schemaChache.getFromId(schemaId);
    if (!schema) {
      try {
        schema = await this.#fetchEventSchemaFromIdWithClient(schemaId);
        this.#schemaChache.set(schema);
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
            let schema = this.#schemaChache.getFromId(schemaId);
            if (!schema) {
              schema = await this.#fetchEventSchemaFromIdWithClient(
                schemaId
              );
            }
            this.#schemaChache.set(schema);
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
          const schemaType = import_avro_js3.default.parse(res.schemaJson, {
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
};
