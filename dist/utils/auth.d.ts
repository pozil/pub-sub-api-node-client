export type ConnectionMetadata = {
    accessToken: string;
    instanceUrl: string;
    /**
     * Optional organization ID. Can be omitted when working with user-supplied authentication.
     */
    organizationId?: string;
    /**
     * Optional username. Omitted when working with user-supplied authentication.
     */
    username?: string;
};
/**
 * @typedef {Object} ConnectionMetadata
 * @property {string} accessToken
 * @property {string} instanceUrl
 * @property {string} [organizationId] Optional organization ID. Can be omitted when working with user-supplied authentication.
 * @property {string} [username] Optional username. Omitted when working with user-supplied authentication.
 */
export default class SalesforceAuth {
    #private;
    /**
     * Builds a new Pub/Sub API client
     * @param {Configuration} config the client configuration
     * @param {Logger} logger a logger
     */
    constructor(config: Configuration, logger: Logger);
    /**
     * Authenticates with the auth mode specified in configuration
     * @returns {ConnectionMetadata}
     */
    authenticate(): ConnectionMetadata;
}
//# sourceMappingURL=auth.d.ts.map