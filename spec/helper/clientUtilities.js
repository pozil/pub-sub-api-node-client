import PubSubApiClient from '../../src/client.js';
import { AuthType } from '../../src/utils/types.js';

/**
 * Prepares a connected PubSub API client
 * @param {Logger} logger
 * @returns a connected PubSub API client
 */
export async function getConnectedPubSubApiClient(logger) {
    const client = new PubSubApiClient(
        {
            authType: AuthType.USERNAME_PASSWORD,
            loginUrl: process.env.SALESFORCE_LOGIN_URL,
            username: process.env.SALESFORCE_USERNAME,
            password: process.env.SALESFORCE_PASSWORD,
            userToken: process.env.SALESFORCE_TOKEN
        },
        logger
    );
    await client.connect();
    return client;
}
