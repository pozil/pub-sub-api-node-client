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

    /**
     * Map of schemas IDs indexed by topic name
     * @type {Map<string,string>}
     */
    #topicNameCache;

    constructor() {
        this.#schemaChache = new Map();
        this.#topicNameCache = new Map();
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
     * Retrieves a schema based on a topic name
     * @param {string} topicName
     * @returns {Schema} schema or undefined if not found
     */
    getFromTopicName(topicName) {
        const schemaId = this.#topicNameCache.get(topicName);
        if (schemaId) {
            return this.getFromId(schemaId);
        }
        return undefined;
    }

    /**
     * Caches a schema
     * @param {Schema} schema
     */
    set(schema) {
        this.#schemaChache.set(schema.id, schema);
    }

    /**
     * Caches a schema with a topic name
     * @param {string} topicName
     * @param {Schema} schema
     */
    setWithTopicName(topicName, schema) {
        this.#topicNameCache.set(topicName, schema.id);
        this.set(schema);
    }

    /**
     * Delete a schema based on the topic name
     * @param {string} topicName
     */
    deleteWithTopicName(topicName) {
        const schemaId = this.#topicNameCache.get(topicName);
        if (schemaId) {
            this.#schemaChache.delete(schemaId);
        }
        this.#topicNameCache.delete(topicName);
    }
}
