import crypto from 'crypto';
import jsforce from 'jsforce';
import { fetch } from 'undici';
import Configuration from './configuration.js';

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
    static async authenticate() {
        if (Configuration.isUsernamePasswordAuth()) {
            return SalesforceAuth.#authWithUsernamePassword();
        } else if (Configuration.isOAuthClientCredentialsAuth()) {
            return SalesforceAuth.#authWithOAuthClientCredentials();
        } else if (Configuration.isOAuthJwtBearerAuth()) {
            return SalesforceAuth.#authWithJwtBearer();
        } else {
            throw new Error('Unsupported authentication mode.');
        }
    }

    /**
     * Authenticates with the username/password flow
     * @returns {ConnectionMetadata}
     */
    static async #authWithUsernamePassword() {
        const sfConnection = new jsforce.Connection({
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
        params.append('grant_type', 'client_credentials');
        params.append('client_id', Configuration.getSfClientId());
        params.append('client_secret', Configuration.getSfClientSecret());
        return SalesforceAuth.#authWithOAuth(params.toString());
    }

    /**
     * Authenticates with the OAuth 2.0 JWT bearer flow
     * @returns {ConnectionMetadata}
     */
    static async #authWithJwtBearer() {
        // Prepare token
        const header = JSON.stringify({ alg: 'RS256' });
        const claims = JSON.stringify({
            iss: Configuration.getSfClientId(),
            sub: Configuration.getSfUsername(),
            aud: Configuration.getSfLoginUrl(),
            exp: Math.floor(Date.now() / 1000) + 60 * 5
        });
        let token = `${base64url(header)}.${base64url(claims)}`;
        // Sign token
        const sign = crypto.createSign('RSA-SHA256');
        sign.update(token);
        sign.end();
        token += `.${base64url(sign.sign(Configuration.getSfPrivateKey()))}`;
        // Log in
        const body = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`;
        return SalesforceAuth.#authWithOAuth(body);
    }

    /**
     * Generic OAuth 2.0 connect method
     * @param {string} body URL encoded body
     * @returns {ConnectionMetadata} connection metadata
     */
    static async #authWithOAuth(body) {
        // Log in
        const loginResponse = await fetch(
            `${Configuration.getSfLoginUrl()}/services/oauth2/token`,
            {
                method: 'post',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body
            }
        );
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
            `${Configuration.getSfLoginUrl()}/services/oauth2/userinfo`,
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
