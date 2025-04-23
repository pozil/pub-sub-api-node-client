import { AuthType } from './types.js';

const DEFAULT_PUB_SUB_ENDPOINT = 'api.pubsub.salesforce.com:7443';
const DEFAULT_REJECT_UNAUTHORIZED_SSL = true;

export default class ConfigurationLoader {
    /**
     * @param {Configuration} config the client configuration
     * @returns {Configuration} the sanitized client configuration
     */
    static load(config) {
        // Set default pub sub endpoint if not specified
        config.pubSubEndpoint =
            config.pubSubEndpoint ?? DEFAULT_PUB_SUB_ENDPOINT;
        // Check config for specific auth types
        ConfigurationLoader.#checkMandatoryVariables(config, ['authType']);
        switch (config.authType) {
            case AuthType.USER_SUPPLIED:
                config = ConfigurationLoader.#loadUserSuppliedAuth(config);
                break;
            case AuthType.USERNAME_PASSWORD:
                ConfigurationLoader.#checkMandatoryVariables(config, [
                    'loginUrl',
                    'username',
                    'password'
                ]);
                config.userToken = config.userToken ?? '';
                break;
            case AuthType.OAUTH_CLIENT_CREDENTIALS:
                ConfigurationLoader.#checkMandatoryVariables(config, [
                    'loginUrl',
                    'clientId',
                    'clientSecret'
                ]);
                break;
            case AuthType.OAUTH_JWT_BEARER:
                ConfigurationLoader.#checkMandatoryVariables(config, [
                    'loginUrl',
                    'clientId',
                    'username',
                    'privateKey'
                ]);
                break;
            default:
                throw new Error(
                    `Unsupported authType value: ${config.authType}`
                );
        }
        // Sanitize rejectUnauthorizedSsl property
        ConfigurationLoader.#loadBooleanValue(
            config,
            'rejectUnauthorizedSsl',
            DEFAULT_REJECT_UNAUTHORIZED_SSL
        );
        return config;
    }

    /**
     * Loads a boolean value from a config key.
     * Falls back to the provided default value if no value is specified.
     * Errors out if the config value can't be converted to a boolean value.
     * @param {Configuration} config
     * @param {string} key
     * @param {boolean} defaultValue
     */
    static #loadBooleanValue(config, key, defaultValue) {
        // Load the default value if no value is specified
        if (
            !Object.hasOwn(config, key) ||
            config[key] === undefined ||
            config[key] === null
        ) {
            config[key] = defaultValue;
            return;
        }

        const value = config[key];
        const type = typeof value;
        switch (type) {
            case 'boolean':
                // Do nothing, value is valid
                break;
            case 'string':
                {
                    switch (value.toUppercase()) {
                        case 'TRUE':
                            config[key] = true;
                            break;
                        case 'FALSE':
                            config[key] = false;
                            break;
                        default:
                            throw new Error(
                                `Expected boolean value for ${key}, found ${type} with value ${value}`
                            );
                    }
                }
                break;
            default:
                throw new Error(
                    `Expected boolean value for ${key}, found ${type} with value ${value}`
                );
        }
    }

    /**
     * @param {Configuration} config the client configuration
     * @returns {Configuration} sanitized configuration
     */
    static #loadUserSuppliedAuth(config) {
        ConfigurationLoader.#checkMandatoryVariables(config, [
            'accessToken',
            'instanceUrl'
        ]);
        // Check instance URL format
        if (!config.instanceUrl.startsWith('https://')) {
            throw new Error(
                `Invalid Salesforce Instance URL format supplied: ${config.instanceUrl}`
            );
        }
        // Extract org ID from access token
        if (!config.organizationId) {
            try {
                config.organizationId = config.accessToken.split('!').at(0);
            } catch (error) {
                throw new Error(
                    'Unable to parse organizationId from access token',
                    {
                        cause: error
                    }
                );
            }
        }
        // Check org ID length
        if (
            config.organizationId.length !== 15 &&
            config.organizationId.length !== 18
        ) {
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
}
