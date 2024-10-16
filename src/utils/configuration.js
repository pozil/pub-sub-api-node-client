const DEFAULT_PUB_SUB_ENDPOINT = 'api.pubsub.salesforce.com:7443';

/**
 * Enum for auth type values
 * @enum {string}
 */
export const AuthType = {
    USER_SUPPLIED: 'user-supplied',
    USERNAME_PASSWORD: 'username-password',
    OAUTH_CLIENT_CREDENTIALS: 'oauth-client-credentials',
    OAUTH_JWT_BEARER: 'oauth-jwt-bearer'
};

export class Configuration {
    /**
     * @param {Configuration} config the client configuration
     * @returns {Configuration} the sanitized client configuration
     */
    static load(config) {
        // Set default pub sub endpoint if not specified
        config.pubSubEndpoint =
            config.pubSubEndpoint ?? DEFAULT_PUB_SUB_ENDPOINT;
        // Check config for specific auth types
        Configuration.#checkMandatoryVariables(config, ['authType']);
        switch (config.authType) {
            case AuthType.USER_SUPPLIED:
                config = Configuration.#loadUserSuppliedAuth(config);
                break;
            case AuthType.USERNAME_PASSWORD:
                Configuration.#checkMandatoryVariables(config, [
                    'loginUrl',
                    'username',
                    'password'
                ]);
                config.userToken = config.userToken ?? '';
                break;
            case AuthType.OAUTH_CLIENT_CREDENTIALS:
                Configuration.#checkMandatoryVariables(config, [
                    'loginUrl',
                    'clientId',
                    'clientSecret'
                ]);
                break;
            case AuthType.OAUTH_JWT_BEARER:
                Configuration.#checkMandatoryVariables(config, [
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
        return config;
    }

    /**
     * @param {Configuration} config the client configuration
     * @returns {Configuration} sanitized configuration
     */
    static #loadUserSuppliedAuth(config) {
        Configuration.#checkMandatoryVariables(config, [
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
