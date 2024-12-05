import jsforce from 'jsforce';

const API_VERSION = '62.0';
const MANAGED_SUBSCRIPTION_KEY_PREFIX = '18x';

/**
 * Calls the Tooling API to retrieve a managed subscription from its ID or name
 * @param {string} instanceUrl
 * @param {string} accessToken
 * @param {string} subscriptionIdOrName
 * @returns topic name
 */
export async function getManagedSubscription(
    instanceUrl,
    accessToken,
    subscriptionIdOrName
) {
    const conn = new jsforce.Connection({ instanceUrl, accessToken });

    // Check for SOQL injection
    if (subscriptionIdOrName.indexOf("'") !== -1) {
        throw new Error(
            `Suspected SOQL injection in subscription ID or name string value: ${subscriptionIdOrName}`
        );
    }
    // Guess input parameter type
    let filter;
    if (
        (subscriptionIdOrName.length === 15 ||
            subscriptionIdOrName.length === 18) &&
        subscriptionIdOrName
            .toLowerCase()
            .startsWith(MANAGED_SUBSCRIPTION_KEY_PREFIX)
    ) {
        filter = `Id='${subscriptionIdOrName}'`;
    } else {
        filter = `DeveloperName='${subscriptionIdOrName}'`;
    }
    // Call Tooling API to retrieve topic name from
    const query = `SELECT Id, DeveloperName, Metadata FROM ManagedEventSubscription WHERE ${filter} LIMIT 1`;
    const res = await conn.request(
        `/services/data/v${API_VERSION}/tooling/query/?q=${encodeURIComponent(query)}`
    );
    if (res.size === 0) {
        throw new Error(
            `Failed to retrieve managed event subscription with ${filter}`
        );
    }
    return res.records[0];
}
