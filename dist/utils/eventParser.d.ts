/**
 * Parses the Avro encoded data of an event agains a schema
 * @param {*} schema Avro schema
 * @param {*} event Avro encoded data of the event
 * @returns {*} parsed event data
 * @protected
 */
export function parseEvent(schema: any, event: any): any;
/**
 * Decodes the value of a replay ID from a buffer
 * @param {Buffer} encodedReplayId
 * @returns {number} decoded replay ID
 * @protected
 */
export function decodeReplayId(encodedReplayId: Buffer): number;
/**
 * Encodes the value of a replay ID
 * @param {number} replayId
 * @returns {Buffer} encoded replay ID
 * @protected
 */
export function encodeReplayId(replayId: number): Buffer;
/**
 * Safely serializes an event into a JSON string
 * @param {any} event the event object
 * @returns {string} a string holding the JSON respresentation of the event
 * @protected
 */
export function toJsonString(event: any): string;
//# sourceMappingURL=eventParser.d.ts.map