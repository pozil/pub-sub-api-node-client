/**
 * @typedef {Object} Schema
 * @property {string} id
 * @property {Object} type
 * @protected
 */

export default class SchemaCache {
    /**
     * Map of schemas indexed by ID
     * @type {Map<string,Schema>}
     */
    #schemaChache;

    constructor() {
        this.#schemaChache = new Map();
    }

    /**
     * Retrieves a schema based on its ID
     * @param {string} schemaId
     * @returns {Schema} schema or undefined if not found
     */
    getFromId(schemaId) {
        return this.#schemaChache.get(schemaId);
    }

    /**
     * Caches a schema
     * @param {Schema} schema
     */
    set(schema) {
        this.#schemaChache.set(schema.id, schema);
    }
}
