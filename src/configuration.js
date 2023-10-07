import * as dotenv from 'dotenv';
import fs from 'fs';

const AUTH_USER_SUPPLIED = 'user-supplied',
    AUTH_USERNAME_PASSWORD = 'username-password',
    AUTH_OAUTH_CLIENT_CREDENTIALS = 'oauth-client-credentials',
    AUTH_OAUTH_JWT_BEARER = 'oauth-jwt-bearer';

export default class Configuration {
    static load() {
        // Load config from .env file
        dotenv.config();
        // Check mandatory variables
        Configuration.#checkMandatoryVariables([
            'SALESFORCE_AUTH_TYPE',
            'PUB_SUB_ENDPOINT'
        ]);
        // Check variable for specific auth types
        if (Configuration.isUsernamePasswordAuth()) {
            Configuration.#checkMandatoryVariables([
                'SALESFORCE_LOGIN_URL',
                'SALESFORCE_USERNAME',
                'SALESFORCE_PASSWORD'
            ]);
        } else if (Configuration.isOAuthClientCredentialsAuth()) {
            Configuration.#checkMandatoryVariables([
                'SALESFORCE_LOGIN_URL',
                'SALESFORCE_CLIENT_ID',
                'SALESFORCE_CLIENT_SECRET'
            ]);
        } else if (Configuration.isOAuthJwtBearerAuth()) {
            Configuration.#checkMandatoryVariables([
                'SALESFORCE_LOGIN_URL',
                'SALESFORCE_CLIENT_ID',
                'SALESFORCE_USERNAME',
                'SALESFORCE_PRIVATE_KEY_FILE'
            ]);
            Configuration.getSfPrivateKey();
        } else if (!Configuration.isUserSuppliedAuth()) {
            throw new Error(
                `Invalid value for SALESFORCE_AUTH_TYPE environment variable: ${Configuration.getAuthType()}`
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
            return (
                process.env.SALESFORCE_PASSWORD + process.env.SALESFORCE_TOKEN
            );
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
            return fs.readFileSync(keyPath, 'utf8');
        } catch (error) {
            throw new Error('Failed to load private key file', {
                cause: error
            });
        }
    }

    static getPubSubEndpoint() {
        return process.env.PUB_SUB_ENDPOINT;
    }

    static isUserSuppliedAuth() {
        return Configuration.getAuthType() === AUTH_USER_SUPPLIED;
    }

    static isUsernamePasswordAuth() {
        return Configuration.getAuthType() === AUTH_USERNAME_PASSWORD;
    }

    static isOAuthClientCredentialsAuth() {
        return Configuration.getAuthType() === AUTH_OAUTH_CLIENT_CREDENTIALS;
    }

    static isOAuthJwtBearerAuth() {
        return Configuration.getAuthType() === AUTH_OAUTH_JWT_BEARER;
    }

    static #checkMandatoryVariables(varNames) {
        varNames.forEach((varName) => {
            if (!process.env[varName]) {
                throw new Error(`Missing ${varName} environment variable`);
            }
        });
    }
}
