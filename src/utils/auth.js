import crypto from 'crypto';
import jsforce from 'jsforce';
import { fetch } from 'undici';
import { AuthType } from './types.js';

/**
 * @typedef {Object} ConnectionMetadata
 * @property {string} accessToken
 * @property {string} instanceUrl
 * @property {string} [organizationId] Optional organization ID. Can be omitted when working with user-supplied authentication.
 * @property {string} [username] Optional username. Omitted when working with user-supplied authentication.
 */

export default class SalesforceAuth {
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
                    'Authenticate method should not be called in user-supplied mode.'
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

        const sfConnection = new jsforce.Connection({
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
        params.append('grant_type', 'client_credentials');
        params.append('client_id', clientId);
        params.append('client_secret', clientSecret);
        return this.#authWithOAuth(params.toString());
    }

    /**
     * Authenticates with the OAuth 2.0 JWT bearer flow
     * @returns {ConnectionMetadata}
     */
    async #authWithJwtBearer() {
        const { clientId, username, loginUrl, privateKey } = this.#config;
        // Prepare token
        const header = JSON.stringify({ alg: 'RS256' });
        const claims = JSON.stringify({
            iss: clientId,
            sub: username,
            aud: loginUrl,
            exp: Math.floor(Date.now() / 1000) + 60 * 5
        });
        let token = `${base64url(header)}.${base64url(claims)}`;
        // Sign token
        const sign = crypto.createSign('RSA-SHA256');
        sign.update(token);
        sign.end();
        token += `.${base64url(sign.sign(privateKey))}`;
        // Log in
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
        // Log in
        const loginResponse = await fetch(`${loginUrl}/services/oauth2/token`, {
            method: 'post',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body
        });
        if (loginResponse.status !== 200) {
            throw new Error(
                `Authentication error: HTTP ${
                    loginResponse.status
                } - ${await loginResponse.text()}`
            );
        }
        const { access_token, instance_url } = await loginResponse.json();
        // Get org and user info
        const userInfoResponse = await fetch(
            `${loginUrl}/services/oauth2/userinfo`,
            {
                headers: { authorization: `Bearer ${access_token}` }
            }
        );
        if (userInfoResponse.status !== 200) {
            throw new Error(
                `Failed to retrieve user info: HTTP ${
                    userInfoResponse.status
                } - ${await userInfoResponse.text()}`
            );
        }
        const { organization_id, preferred_username } =
            await userInfoResponse.json();
        return {
            accessToken: access_token,
            instanceUrl: instance_url,
            organizationId: organization_id,
            username: preferred_username
        };
    }
}

function base64url(input) {
    const buf = Buffer.from(input, 'utf8');
    return buf.toString('base64url');
}
