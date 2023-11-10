/**
 * @typedef {Object} ConnectionMetadata
 * @property {string} accessToken
 * @property {string} instanceUrl
 * @property {string} [organizationId] Optional organization ID. Can be omitted when working with user-supplied authentication.
 * @property {string} [username] Optional username. Omitted when working with user-supplied authentication.
 */
export default class SalesforceAuth {
    /**
     * Authenticates with the auth mode specified in configuration
     * @returns {ConnectionMetadata}
     */
    static authenticate(): ConnectionMetadata;
    /**
     * Authenticates with the username/password flow
     * @returns {ConnectionMetadata}
     */
    static "__#3@#authWithUsernamePassword"(): ConnectionMetadata;
    /**
     * Authenticates with the OAuth 2.0 client credentials flow
     * @returns {ConnectionMetadata}
     */
    static "__#3@#authWithOAuthClientCredentials"(): ConnectionMetadata;
    /**
     * Authenticates with the OAuth 2.0 JWT bearer flow
     * @returns {ConnectionMetadata}
     */
    static "__#3@#authWithJwtBearer"(): ConnectionMetadata;
    /**
     * Generic OAuth 2.0 connect method
     * @param {string} body URL encoded body
     * @returns {ConnectionMetadata} connection metadata
     */
    static "__#3@#authWithOAuth"(body: string): ConnectionMetadata;
}
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
//# sourceMappingURL=auth.d.ts.map