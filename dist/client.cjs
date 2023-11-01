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
var import_fs2 = __toESM(require("fs"), 1);
var import_url = require("url");
var import_avro_js2 = __toESM(require("avro-js"), 1);
var import_certifi = __toESM(require("certifi"), 1);
var import_grpc_js = __toESM(require("@grpc/grpc-js"), 1);
var import_proto_loader = __toESM(require("@grpc/proto-loader"), 1);

// src/configuration.js
var dotenv = __toESM(require("dotenv"), 1);
var import_fs = __toESM(require("fs"), 1);
var AUTH_USER_SUPPLIED = "user-supplied";
var AUTH_USERNAME_PASSWORD = "username-password";
var AUTH_OAUTH_CLIENT_CREDENTIALS = "oauth-client-credentials";
var AUTH_OAUTH_JWT_BEARER = "oauth-jwt-bearer";
var Configuration = class _Configuration {
  static load() {
    dotenv.config();
    _Configuration.#checkMandatoryVariables([
      "SALESFORCE_AUTH_TYPE",
      "PUB_SUB_ENDPOINT"
    ]);
    if (_Configuration.isUsernamePasswordAuth()) {
      _Configuration.#checkMandatoryVariables([
        "SALESFORCE_LOGIN_URL",
        "SALESFORCE_USERNAME",
        "SALESFORCE_PASSWORD"
      ]);
    } else if (_Configuration.isOAuthClientCredentialsAuth()) {
      _Configuration.#checkMandatoryVariables([
        "SALESFORCE_LOGIN_URL",
        "SALESFORCE_CLIENT_ID",
        "SALESFORCE_CLIENT_SECRET"
      ]);
    } else if (_Configuration.isOAuthJwtBearerAuth()) {
      _Configuration.#checkMandatoryVariables([
        "SALESFORCE_LOGIN_URL",
        "SALESFORCE_CLIENT_ID",
        "SALESFORCE_USERNAME",
        "SALESFORCE_PRIVATE_KEY_FILE"
      ]);
      _Configuration.getSfPrivateKey();
    } else if (!_Configuration.isUserSuppliedAuth()) {
      throw new Error(
        `Invalid value for SALESFORCE_AUTH_TYPE environment variable: ${_Configuration.getAuthType()}`
      );
    }
  }
  static getAuthType() {
    return process.env.SALESFORCE_AUTH_TYPE;
  }
  static getSfLoginUrl() {
    return process.env.SALESFORCE_LOGIN_URL;
  }
  static getSfUsername() {
    return process.env.SALESFORCE_USERNAME;
  }
  static getSfSecuredPassword() {
    if (process.env.SALESFORCE_TOKEN) {
      return process.env.SALESFORCE_PASSWORD + process.env.SALESFORCE_TOKEN;
    }
    return process.env.SALESFORCE_PASSWORD;
  }
  static getSfClientId() {
    return process.env.SALESFORCE_CLIENT_ID;
  }
  static getSfClientSecret() {
    return process.env.SALESFORCE_CLIENT_SECRET;
  }
  static getSfPrivateKey() {
    try {
      const keyPath = process.env.SALESFORCE_PRIVATE_KEY_FILE;
      return import_fs.default.readFileSync(keyPath, "utf8");
    } catch (error) {
      throw new Error("Failed to load private key file", {
        cause: error
      });
    }
  }
  static getPubSubEndpoint() {
    return process.env.PUB_SUB_ENDPOINT;
  }
  static isUserSuppliedAuth() {
    return _Configuration.getAuthType() === AUTH_USER_SUPPLIED;
  }
  static isUsernamePasswordAuth() {
    return _Configuration.getAuthType() === AUTH_USERNAME_PASSWORD;
  }
  static isOAuthClientCredentialsAuth() {
    return _Configuration.getAuthType() === AUTH_OAUTH_CLIENT_CREDENTIALS;
  }
  static isOAuthJwtBearerAuth() {
    return _Configuration.getAuthType() === AUTH_OAUTH_JWT_BEARER;
  }
  static #checkMandatoryVariables(varNames) {
    varNames.forEach((varName) => {
      if (!process.env[varName]) {
        throw new Error(`Missing ${varName} environment variable`);
      }
    });
  }
};

// src/eventParser.js
var import_avro_js = __toESM(require("avro-js"), 1);
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
    if (type instanceof import_avro_js.default.types.RecordType) {
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

// src/auth.js
var import_crypto = __toESM(require("crypto"), 1);
var import_jsforce = __toESM(require("jsforce"), 1);
var import_undici = require("undici");
var SalesforceAuth = class _SalesforceAuth {
  /**
   * Authenticates with the auth mode specified in configuration
   * @returns {ConnectionMetadata}
   */
  static async authenticate() {
    if (Configuration.isUsernamePasswordAuth()) {
      return _SalesforceAuth.#authWithUsernamePassword();
    } else if (Configuration.isOAuthClientCredentialsAuth()) {
      return _SalesforceAuth.#authWithOAuthClientCredentials();
    } else if (Configuration.isOAuthJwtBearerAuth()) {
      return _SalesforceAuth.#authWithJwtBearer();
    } else {
      throw new Error("Unsupported authentication mode.");
    }
  }
  /**
   * Authenticates with the username/password flow
   * @returns {ConnectionMetadata}
   */
  static async #authWithUsernamePassword() {
    const sfConnection = new import_jsforce.default.Connection({
      loginUrl: Configuration.getSfLoginUrl()
    });
    await sfConnection.login(
      Configuration.getSfUsername(),
      Configuration.getSfSecuredPassword()
    );
    return {
      accessToken: sfConnection.accessToken,
      instanceUrl: sfConnection.instanceUrl,
      organizationId: sfConnection.userInfo.organizationId,
      username: Configuration.getSfUsername()
    };
  }
  /**
   * Authenticates with the OAuth 2.0 client credentials flow
   * @returns {ConnectionMetadata}
   */
  static async #authWithOAuthClientCredentials() {
    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");
    params.append("client_id", Configuration.getSfClientId());
    params.append("client_secret", Configuration.getSfClientSecret());
    return _SalesforceAuth.#authWithOAuth(params.toString());
  }
  /**
   * Authenticates with the OAuth 2.0 JWT bearer flow
   * @returns {ConnectionMetadata}
   */
  static async #authWithJwtBearer() {
    const header = JSON.stringify({ alg: "RS256" });
    const claims = JSON.stringify({
      iss: Configuration.getSfClientId(),
      sub: Configuration.getSfUsername(),
      aud: Configuration.getSfLoginUrl(),
      exp: Math.floor(Date.now() / 1e3) + 60 * 5
    });
    let token = `${base64url(header)}.${base64url(claims)}`;
    const sign = import_crypto.default.createSign("RSA-SHA256");
    sign.update(token);
    sign.end();
    token += `.${base64url(sign.sign(Configuration.getSfPrivateKey()))}`;
    const body = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`;
    return _SalesforceAuth.#authWithOAuth(body);
  }
  /**
   * Generic OAuth 2.0 connect method
   * @param {string} body URL encoded body
   * @returns {ConnectionMetadata} connection metadata
   */
  static async #authWithOAuth(body) {
    const loginResponse = await (0, import_undici.fetch)(
      `${Configuration.getSfLoginUrl()}/services/oauth2/token`,
      {
        method: "post",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body
      }
    );
    if (loginResponse.status !== 200) {
      throw new Error(
        `Authentication error: HTTP ${loginResponse.status} - ${await loginResponse.text()}`
      );
    }
    const { access_token, instance_url } = await loginResponse.json();
    const userInfoResponse = await (0, import_undici.fetch)(
      `${Configuration.getSfLoginUrl()}/services/oauth2/userinfo`,
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

// src/pubSubEventEmitter.js
var import_events = require("events");
var PubSubEventEmitter = class extends import_events.EventEmitter {
  #topicName;
  #requestedEventCount;
  #receivedEventCount;
  /**
   * Create a new EventEmitter for Pub/Sub API events
   * @param {string} topicName
   * @param {number} requestedEventCount
   */
  constructor(topicName, requestedEventCount) {
    super();
    this.#topicName = topicName;
    this.#requestedEventCount = requestedEventCount;
    this.#receivedEventCount = 0;
  }
  emit(eventName, args) {
    if (eventName === "data") {
      this.#receivedEventCount++;
    }
    return super.emit(eventName, args);
  }
  /**
   * Returns the number of events that were requested during the subscription
   * @returns {number} the number of events that were requested
   */
  getRequestedEventCount() {
    return this.#requestedEventCount;
  }
  /**
   * Returns the number of events that were received since the subscription
   * @returns {number} the number of events that were received
   */
  getReceivedEventCount() {
    return this.#receivedEventCount;
  }
  /**
   * Returns the topic name for this subscription
   * @returns {string} the topic name
   */
  getTopicName() {
    return this.#topicName;
  }
};

// src/client.js
var PubSubApiClient = class {
  /**
   * gRPC client
   * @type {Object}
   */
  #client;
  /**
   * Map of schemas indexed by topic name
   * @type {Map<string,Schema>}
   */
  #schemaChache;
  #logger;
  /**
   * Builds a new Pub/Sub API client
   * @param {Logger} logger an optional custom logger. The client uses the console if no value is supplied.
   */
  constructor(logger = console) {
    this.#logger = logger;
    this.#schemaChache = /* @__PURE__ */ new Map();
    try {
      Configuration.load();
    } catch (error) {
      this.#logger.error(error);
      throw new Error("Failed to initialize Pub/Sub API client", {
        cause: error
      });
    }
  }
  /**
   * Authenticates with Salesforce then, connects to the Pub/Sub API
   * @returns {Promise<void>} Promise that resolves once the connection is established
   */
  async connect() {
    if (Configuration.isUserSuppliedAuth()) {
      throw new Error(
        'You selected user-supplied authentication mode so you cannot use the "connect()" method. Use "connectWithAuth(...)" instead.'
      );
    }
    let conMetadata;
    try {
      conMetadata = await SalesforceAuth.authenticate();
      this.#logger.info(
        `Connected to Salesforce org ${conMetadata.instanceUrl} as ${conMetadata.username}`
      );
    } catch (error) {
      throw new Error("Failed to authenticate with Salesforce", {
        cause: error
      });
    }
    return this.#connectToPubSubApi(conMetadata);
  }
  /**
   * Connects to the Pub/Sub API with user-supplied authentication
   * @param {string} accessToken
   * @param {string} instanceUrl
   * @param {string} organizationId optional organizationId. If you don't provide one, we'll attempt to parse it from the accessToken.
   * @returns {Promise<void>} Promise that resolves once the connection is established
   */
  async connectWithAuth(accessToken, instanceUrl, organizationId) {
    if (!instanceUrl || !instanceUrl.startsWith("https://")) {
      throw new Error(
        `Invalid Salesforce Instance URL format supplied: ${instanceUrl}`
      );
    }
    let validOrganizationId = organizationId;
    if (!organizationId) {
      try {
        validOrganizationId = accessToken.split("!").at(0);
      } catch (error) {
        throw new Error("Unable to parse organizationId from given access token", {
          cause: error
        });
      }
    }
    if (validOrganizationId.length !== 15 && validOrganizationId.length !== 18) {
      throw new Error(
        `Invalid Salesforce Org ID format supplied: ${validOrganizationId}`
      );
    }
    return this.#connectToPubSubApi({
      accessToken,
      instanceUrl,
      organizationId: validOrganizationId
    });
  }
  /**
   * Connects to the Pub/Sub API
   * @param {import('./auth.js').ConnectionDetails} conDetails
   * @returns {Promise<void>} Promise that resolves once the connection is established
   */
  async #connectToPubSubApi(conDetails) {
    try {
      const rootCert = import_fs2.default.readFileSync(import_certifi.default);
      const protoFilePath = (0, import_url.fileURLToPath)(
        new URL("./pubsub_api-961def31.proto?hash=961def31", "file://" + __filename)
      );
      const packageDef = import_proto_loader.default.loadSync(protoFilePath, {});
      const grpcObj = import_grpc_js.default.loadPackageDefinition(packageDef);
      const sfdcPackage = grpcObj.eventbus.v1;
      const metaCallback = (_params, callback) => {
        const meta = new import_grpc_js.default.Metadata();
        meta.add("accesstoken", conDetails.accessToken);
        meta.add("instanceurl", conDetails.instanceUrl);
        meta.add("tenantid", conDetails.organizationId);
        callback(null, meta);
      };
      const callCreds = import_grpc_js.default.credentials.createFromMetadataGenerator(metaCallback);
      const combCreds = import_grpc_js.default.credentials.combineChannelCredentials(
        import_grpc_js.default.credentials.createSsl(rootCert),
        callCreds
      );
      this.#client = new sfdcPackage.PubSub(
        Configuration.getPubSubEndpoint(),
        combCreds
      );
      this.#logger.info(
        `Connected to Pub/Sub API endpoint ${Configuration.getPubSubEndpoint()}`
      );
    } catch (error) {
      throw new Error("Failed to connect to Pub/Sub API", {
        cause: error
      });
    }
  }
  /**
   * Subscribes to a topic and retrieves all past events in retention window
   * @param {string} topicName name of the topic that we're subscribing to
   * @param {number} numRequested number of events requested
   * @returns {Promise<EventEmitter>} Promise that holds an emitter that allows you to listen to received events and stream lifecycle events
   */
  async subscribeFromEarliestEvent(topicName, numRequested) {
    return this.#subscribe({
      topicName,
      numRequested,
      replayPreset: 1
    });
  }
  /**
   * Subscribes to a topic and retrieve past events starting from a replay ID
   * @param {string} topicName name of the topic that we're subscribing to
   * @param {number} numRequested number of events requested
   * @param {number} replayId replay ID
   * @returns {Promise<EventEmitter>} Promise that holds an emitter that allows you to listen to received events and stream lifecycle events
   */
  async subscribeFromReplayId(topicName, numRequested, replayId) {
    return this.#subscribe({
      topicName,
      numRequested,
      replayPreset: 2,
      replayId: encodeReplayId(replayId)
    });
  }
  /**
   * Subscribes to a topic
   * @param {string} topicName name of the topic that we're subscribing to
   * @param {number} numRequested number of events requested
   * @returns {Promise<EventEmitter>} Promise that holds an emitter that allows you to listen to received events and stream lifecycle events
   */
  async subscribe(topicName, numRequested) {
    return this.#subscribe({
      topicName,
      numRequested
    });
  }
  /**
   * Subscribes to a topic using the gRPC client and an event schema
   * @param {object} subscribeRequest subscription request
   * @return {PubSubEventEmitter} emitter that allows you to listen to received events and stream lifecycle events
   */
  async #subscribe(subscribeRequest) {
    try {
      if (!this.#client) {
        throw new Error("Pub/Sub API client is not connected.");
      }
      const schema = await this.#getEventSchema(
        subscribeRequest.topicName
      );
      const subscription = this.#client.Subscribe();
      subscription.write(subscribeRequest);
      this.#logger.info(
        `Subscribe request sent for ${subscribeRequest.numRequested} events from ${subscribeRequest.topicName}...`
      );
      const eventEmitter = new PubSubEventEmitter(
        subscribeRequest.topicName,
        subscribeRequest.numRequested
      );
      subscription.on("data", (data) => {
        if (data.events) {
          const latestReplayId = decodeReplayId(data.latestReplayId);
          this.#logger.info(
            `Received ${data.events.length} events, latest replay ID: ${latestReplayId}`
          );
          data.events.forEach((event) => {
            const parsedEvent = parseEvent(schema, event);
            this.#logger.debug(parsedEvent);
            eventEmitter.emit("data", parsedEvent);
            if (eventEmitter.getReceivedEventCount() === eventEmitter.getRequestedEventCount()) {
              eventEmitter.emit("lastevent");
            }
          });
        } else {
        }
      });
      subscription.on("end", () => {
        this.#logger.info("gRPC stream ended");
        eventEmitter.emit("end");
      });
      subscription.on("error", (error) => {
        this.#logger.error(
          `gRPC stream error: ${JSON.stringify(error)}`
        );
        eventEmitter.emit("error", error);
      });
      subscription.on("status", (status) => {
        this.#logger.info(
          `gRPC stream status: ${JSON.stringify(status)}`
        );
        eventEmitter.emit("status", status);
      });
      return eventEmitter;
    } catch (error) {
      throw new Error(
        `Failed to subscribe to events for topic ${subscribeRequest.topicName}`,
        { cause: error }
      );
    }
  }
  /**
   * Publishes a payload to a topic using the gRPC client
   * @param {string} topicName name of the topic that we're subscribing to
   * @param {Object} payload
   * @param {string} [correlationKey] optional correlation key. If you don't provide one, we'll generate a random UUID for you.
   * @returns {Promise<PublishResult>} Promise holding a PublishResult object with replayId and correlationKey
   */
  async publish(topicName, payload, correlationKey) {
    try {
      if (!this.#client) {
        throw new Error("Pub/Sub API client is not connected.");
      }
      const schema = await this.#getEventSchema(topicName);
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
   */
  close() {
    this.#logger.info("closing gRPC stream");
    this.#client.close();
  }
  /**
   * Retrieves the event schema for a topic from the cache.
   * If it's not cached, fetches the shema with the gRPC client.
   * @param {string} topicName name of the topic that we're fetching
   * @returns {Promise<Schema>} Promise holding parsed event schema
   */
  async #getEventSchema(topicName) {
    let schema = this.#schemaChache.get(topicName);
    if (!schema) {
      try {
        schema = await this.#fetchEventSchemaWithClient(topicName);
        this.#schemaChache.set(topicName, schema);
      } catch (error) {
        throw new Error(
          `Failed to load schema for topic ${topicName}`,
          { cause: error }
        );
      }
    }
    return schema;
  }
  /**
   * Requests the event schema for a topic using the gRPC client
   * @param {string} topicName name of the topic that we're fetching
   * @returns {Promise<Schema>} Promise holding parsed event schema
   */
  async #fetchEventSchemaWithClient(topicName) {
    return new Promise((resolve, reject) => {
      this.#client.GetTopic({ topicName }, (topicError, response) => {
        if (topicError) {
          reject(topicError);
        } else {
          const { schemaId } = response;
          this.#client.GetSchema({ schemaId }, (schemaError, res) => {
            if (schemaError) {
              reject(schemaError);
            } else {
              const schemaType = import_avro_js2.default.parse(res.schemaJson);
              this.#logger.info(
                `Topic schema loaded: ${topicName}`
              );
              resolve({
                id: schemaId,
                type: schemaType
              });
            }
          });
        }
      });
    });
  }
};
