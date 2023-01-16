export function parseEvent(schema: any, event: any): {
    replayId: number;
    payload: any;
};
/**
 * Decodes the value of a replay ID from a buffer
 * @param {Buffer} encodedReplayId
 * @returns {number} decoded replay ID
 */
export function decodeReplayId(encodedReplayId: Buffer): number;
/**
 * Encodes the value of a replay ID
 * @param {number} replayId
 * @returns {Buffer} encoded replay ID
 */
export function encodeReplayId(replayId: number): Buffer;
//# sourceMappingURL=eventParser.d.ts.map