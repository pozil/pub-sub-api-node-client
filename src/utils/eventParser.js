import avro from 'avro-js';

/**
 * Parses the Avro encoded data of an event agains a schema
 * @param {*} schema Avro schema
 * @param {*} event Avro encoded data of the event
 * @returns {*} parsed event data
 * @protected
 */
export function parseEvent(schema, event) {
    const allFields = schema.type.getFields();
    const replayId = decodeReplayId(event.replayId);
    const payload = schema.type.fromBuffer(event.event.payload); // This schema is the same which we retreived earlier in the GetSchema rpc.
    // Parse CDC header if available
    if (payload.ChangeEventHeader) {
        try {
            payload.ChangeEventHeader.nulledFields = parseFieldBitmaps(
                allFields,
                payload.ChangeEventHeader.nulledFields
            );
        } catch (error) {
            throw new Error('Failed to parse nulledFields', { cause: error });
        }
        try {
            payload.ChangeEventHeader.diffFields = parseFieldBitmaps(
                allFields,
                payload.ChangeEventHeader.diffFields
            );
        } catch (error) {
            throw new Error('Failed to parse diffFields', { cause: error });
        }
        try {
            payload.ChangeEventHeader.changedFields = parseFieldBitmaps(
                allFields,
                payload.ChangeEventHeader.changedFields
            );
        } catch (error) {
            throw new Error('Failed to parse changedFields', { cause: error });
        }
    }
    // Eliminate intermediate types left by Avro in payload
    flattenSinglePropertyObjects(payload);
    // Return parsed data
    return {
        replayId,
        payload
    };
}

/**
 * Flattens object properies that are themself objects with a single property.
 * This is used to eliminate intermediate 'types' left by Avro.
 * For example: { city : { string: 'SFO' } } becomes { city: 'SFO' }
 * @param {Object} theObject the object to fransform
 * @private
 */
function flattenSinglePropertyObjects(theObject) {
    Object.entries(theObject).forEach(([key, value]) => {
        if (key !== 'ChangeEventHeader' && value && typeof value === 'object') {
            const subKeys = Object.keys(value);
            if (subKeys.length === 1) {
                const subValue = value[subKeys[0]];
                theObject[key] = subValue;
                if (subValue && typeof subValue === 'object') {
                    flattenSinglePropertyObjects(theObject[key]);
                }
            }
        }
    });
}

/**
 * Parses a bit map of modified fields
 * @param {Object[]} allFields
 * @param {string[]} fieldBitmapsAsHex
 * @returns {string[]} array of modified field names
 * @private
 */
function parseFieldBitmaps(allFields, fieldBitmapsAsHex) {
    if (fieldBitmapsAsHex.length === 0) {
        return [];
    }

    let fieldNames = [];
    // Replace top field level bitmap with list of fields
    if (fieldBitmapsAsHex[0].startsWith('0x')) {
        fieldNames = getFieldNamesFromBitmap(allFields, fieldBitmapsAsHex[0]);
    }
    // Process compound fields
    if (
        fieldBitmapsAsHex.length > 1 &&
        fieldBitmapsAsHex[fieldBitmapsAsHex.length - 1].indexOf('-') !== -1
    ) {
        fieldBitmapsAsHex.forEach((fieldBitmapAsHex) => {
            const bitmapMapStrings = fieldBitmapAsHex.split('-');
            // Ignore top level field bitmap
            if (bitmapMapStrings.length >= 2) {
                const parentField =
                    allFields[parseInt(bitmapMapStrings[0], 10)];
                const childFields = getChildFields(parentField);
                const childFieldNames = getFieldNamesFromBitmap(
                    childFields,
                    bitmapMapStrings[1]
                );
                fieldNames = fieldNames.concat(
                    childFieldNames.map(
                        (fieldName) => `${parentField._name}.${fieldName}`
                    )
                );
            }
        });
    }
    return fieldNames;
}

/**
 * Extracts the children of a parent field
 * @param {*} parentField
 * @returns {Object[]} child fields
 * @private
 */
function getChildFields(parentField) {
    const types = parentField._type.getTypes();
    let fields = [];
    types.forEach((type) => {
        if (type instanceof avro.types.RecordType) {
            fields = fields.concat(type.getFields());
        }
    });
    return fields;
}

/**
 * Loads field names from a bitmap
 * @param {Field[]} fields list of Avro Field
 * @param {string} fieldBitmapAsHex
 * @returns {string[]} field names
 * @private
 */
function getFieldNamesFromBitmap(fields, fieldBitmapAsHex) {
    // Convert hex to binary and reverse bits
    let binValue = hexToBin(fieldBitmapAsHex);
    binValue = binValue.split('').reverse().join('');
    // Use bitmap to figure out field names based on index
    const fieldNames = [];
    for (let i = 0; i < binValue.length && i < fields.length; i++) {
        if (binValue[i] === '1') {
            fieldNames.push(fields[i].getName());
        }
    }
    return fieldNames;
}

/**
 * Decodes the value of a replay ID from a buffer
 * @param {Buffer} encodedReplayId
 * @returns {number} decoded replay ID
 * @protected
 */
export function decodeReplayId(encodedReplayId) {
    return Number(encodedReplayId.readBigUInt64BE());
}

/**
 * Encodes the value of a replay ID
 * @param {number} replayId
 * @returns {Buffer} encoded replay ID
 * @protected
 */
export function encodeReplayId(replayId) {
    const buf = Buffer.allocUnsafe(8);
    buf.writeBigUInt64BE(BigInt(replayId), 0);
    return buf;
}

/**
 * Converts a hexadecimal string into a string binary representation
 * @param {string} hex
 * @returns {string}
 * @private
 */
function hexToBin(hex) {
    let bin = hex.substring(2); // Remove 0x prefix
    bin = bin.replaceAll('0', '0000');
    bin = bin.replaceAll('1', '0001');
    bin = bin.replaceAll('2', '0010');
    bin = bin.replaceAll('3', '0011');
    bin = bin.replaceAll('4', '0100');
    bin = bin.replaceAll('5', '0101');
    bin = bin.replaceAll('6', '0110');
    bin = bin.replaceAll('7', '0111');
    bin = bin.replaceAll('8', '1000');
    bin = bin.replaceAll('9', '1001');
    bin = bin.replaceAll('A', '1010');
    bin = bin.replaceAll('B', '1011');
    bin = bin.replaceAll('C', '1100');
    bin = bin.replaceAll('D', '1101');
    bin = bin.replaceAll('E', '1110');
    bin = bin.replaceAll('F', '1111');
    return bin;
}
