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
     * Retrieves a schema based on a topic name
     * @param {string} topicName
     * @returns {Schema} schema or undefined if not found
     */
    getFromTopicName(topicName: string): Schema;
    /**
     * Caches a schema
     * @param {Schema} schema
     */
    set(schema: Schema): void;
    /**
     * Caches a schema with a topic name
     * @param {string} topicName
     * @param {Schema} schema
     */
    setWithTopicName(topicName: string, schema: Schema): void;
    /**
     * Delete a schema based on the topic name
     * @param {string} topicName
     */
    deleteWithTopicName(topicName: string): void;
    #private;
}
export type Schema = {
    id: string;
    type: any;
};
//# sourceMappingURL=schemaCache.d.ts.map