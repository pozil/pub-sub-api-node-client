import jsforce from 'jsforce';

let sfConnection;

export async function getSalesforceConnection() {
    if (!sfConnection) {
        sfConnection = new jsforce.Connection({
            loginUrl: process.env.SALESFORCE_LOGIN_URL
        });
        await sfConnection.login(
            process.env.SALESFORCE_USERNAME,
            process.env.SALESFORCE_TOKEN
                ? process.env.SALESFORCE_PASSWORD + process.env.SALESFORCE_TOKEN
                : process.env.SALESFORCE_PASSWORD
        );
    }
    return sfConnection;
}

export async function getSampleAccount() {
    const res = await sfConnection.query(
        `SELECT Id, Name, BillingCity FROM Account WHERE Name='Sample Account'`
    );
    let sampleAccount;
    if (res.totalSize === 0) {
        sampleAccount = { Name: 'Sample Account', BillingCity: 'SFO' };
        const ret = await sfConnection.sobject('Account').create(sampleAccount);
        sampleAccount.Id = ret.id;
    } else {
        sampleAccount = res.records[0];
    }
    return sampleAccount;
}

export async function updateSampleAccount(updatedAccount) {
    sfConnection.sobject('Account').update(updatedAccount, (err, ret) => {
        if (err || !ret.success) {
            throw new Error('Failed to update sample account');
        }
        console.log('Record updated');
    });
}
