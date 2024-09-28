/**
 * @typedef {Object} Schema
 * @property {string} id
 * @property {Object} type
 * @protected
 */
export default class SchemaCache {
    /**
     * Retrieves a schema based on its ID
     * @param {string} schemaId
     * @returns {Schema} schema or undefined if not found
     */
    getFromId(schemaId: string): Schema;
    /**
     * Caches a schema
     * @param {Schema} schema
     */
    set(schema: Schema): void;
    #private;
}
export type Schema = {
    id: string;
    type: any;
};
//# sourceMappingURL=schemaCache.d.ts.map