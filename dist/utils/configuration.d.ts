export default class Configuration {
    static load(): void;
    static getAuthType(): string;
    static getSfLoginUrl(): string;
    static getSfUsername(): string;
    static getSfSecuredPassword(): string;
    static getSfClientId(): string;
    static getSfClientSecret(): string;
    static getSfPrivateKey(): any;
    static getPubSubEndpoint(): string;
    static isUserSuppliedAuth(): boolean;
    static isUsernamePasswordAuth(): boolean;
    static isOAuthClientCredentialsAuth(): boolean;
    static isOAuthJwtBearerAuth(): boolean;
    static "__#2@#checkMandatoryVariables"(varNames: any): void;
}
//# sourceMappingURL=configuration.d.ts.map