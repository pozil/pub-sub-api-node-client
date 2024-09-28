/**
 * Enum for auth type values
 */
export type AuthType = string;
export namespace AuthType {
    let USER_SUPPLIED: string;
    let USERNAME_PASSWORD: string;
    let OAUTH_CLIENT_CREDENTIALS: string;
    let OAUTH_JWT_BEARER: string;
}
export class Configuration {
    /**
     * @param {Configuration} config the client configuration
     * @returns {Configuration} the sanitized client configuration
     */
    static load(config: Configuration): Configuration;
    /**
     * @param {Configuration} config the client configuration
     * @returns {Configuration} sanitized configuration
     */
    static "__#2@#loadUserSuppliedAuth"(config: Configuration): Configuration;
    static "__#2@#checkMandatoryVariables"(config: any, varNames: any): void;
}
//# sourceMappingURL=configuration.d.ts.map