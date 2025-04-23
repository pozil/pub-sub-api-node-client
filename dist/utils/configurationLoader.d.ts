export default class ConfigurationLoader {
    /**
     * @param {Configuration} config the client configuration
     * @returns {Configuration} the sanitized client configuration
     */
    static load(config: Configuration): Configuration;
    /**
     * Loads a boolean value from a config key.
     * Falls back to the provided default value if no value is specified.
     * Errors out if the config value can't be converted to a boolean value.
     * @param {Configuration} config
     * @param {string} key
     * @param {boolean} defaultValue
     */
    static "__#1@#loadBooleanValue"(config: Configuration, key: string, defaultValue: boolean): void;
    /**
     * @param {Configuration} config the client configuration
     * @returns {Configuration} sanitized configuration
     */
    static "__#1@#loadUserSuppliedAuth"(config: Configuration): Configuration;
    static "__#1@#checkMandatoryVariables"(config: any, varNames: any): void;
}
//# sourceMappingURL=configurationLoader.d.ts.map