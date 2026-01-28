/**
 * Pose Parser Module
 * Parses Python-like list notation into JavaScript arrays
 */

export class PoseParser {
    /**
     * Parse multiple trajectories from input (separated by blank lines)
     * Supports optional trajectory names via # comment lines before each block.
     * Example:
     *   # My Trajectory
     *   [[[1,0,0,0], ...], ...]
     * 
     * @param {string} input - The input string potentially containing multiple trajectories
     * @param {string} format - The input format ('matrix', 'xyz_quat_wxyz', 'xyz_quat_xyzw')
     * @returns {Object} - { success: boolean, trajectories: array, errors: array, totalCount: number }
     */
    static parseMultiple(input, format = 'matrix') {
        const trajectories = [];
        const errors = [];
        let totalCount = 0;
        
        // Split by double newlines or lines that only contain whitespace between arrays
        const blocks = this.splitIntoBlocks(input);
        
        if (blocks.length === 0) {
            return {
                success: false,
                trajectories: [],
                errors: ['No valid input found'],
                totalCount: 0
            };
        }
        
        blocks.forEach((block, index) => {
            // Extract name from # comment if present
            const { name, content } = this.extractNameFromBlock(block, index);
            
            const result = this.parse(content, format);
            if (result.success) {
                trajectories.push({
                    id: index,
                    name: name,
                    poses: result.data,
                    count: result.count,
                    visible: true
                });
                totalCount += result.count;
            } else {
                errors.push(`${name}: ${result.error}`);
            }
        });
        
        return {
            success: trajectories.length > 0,
            trajectories: trajectories,
            errors: errors,
            totalCount: totalCount
        };
    }

    /**
     * Extract trajectory name from a # comment line at the start of a block
     * @param {string} block - The block content
     * @param {number} index - Block index for default naming
     * @returns {Object} - { name: string, content: string }
     */
    static extractNameFromBlock(block, index) {
        const lines = block.split('\n');
        let name = `Trajectory ${index + 1}`;
        let contentStartIndex = 0;
        
        // Look for # comment lines at the start of the block
        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            
            if (trimmed === '') {
                // Skip empty lines at the start
                contentStartIndex = i + 1;
                continue;
            }
            
            if (trimmed.startsWith('#')) {
                // Found a name comment - extract the name
                const extractedName = trimmed.substring(1).trim();
                if (extractedName) {
                    name = extractedName;
                }
                contentStartIndex = i + 1;
            } else {
                // First non-comment, non-empty line - start of actual content
                break;
            }
        }
        
        // Return the content without the name comment lines
        const content = lines.slice(contentStartIndex).join('\n');
        
        return { name, content };
    }

    /**
     * Split input into separate trajectory blocks
     * Blocks are separated by blank lines (lines with only whitespace)
     * # comment lines before brackets are included as potential names
     */
    static splitIntoBlocks(input) {
        const blocks = [];
        let currentBlock = '';
        let bracketDepth = 0;
        let inBlock = false;
        let hasSeenBracket = false;  // Track if we've seen any bracket in current block
        
        const lines = input.split('\n');
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Count brackets in this line (excluding those in comments)
            if (!trimmedLine.startsWith('#')) {
                for (const char of trimmedLine) {
                    if (char === '[') bracketDepth++;
                    if (char === ']') bracketDepth--;
                }
                if (trimmedLine.includes('[')) {
                    hasSeenBracket = true;
                }
            }
            
            // Check if this is an empty line (true separator between blocks)
            const isEmpty = trimmedLine === '';
            
            // A # line at the start of a block (before any brackets) is a name, not a separator
            const isNameComment = trimmedLine.startsWith('#') && !hasSeenBracket;
            
            if (isEmpty && bracketDepth === 0 && inBlock && hasSeenBracket) {
                // End of a block (only if we've seen brackets)
                if (currentBlock.trim()) {
                    blocks.push(currentBlock.trim());
                }
                currentBlock = '';
                inBlock = false;
                hasSeenBracket = false;
            } else if (!isEmpty || bracketDepth > 0 || isNameComment) {
                // Part of a block (including # name comments before content)
                currentBlock += line + '\n';
                inBlock = true;
            }
        }
        
        // Don't forget the last block
        if (currentBlock.trim()) {
            blocks.push(currentBlock.trim());
        }
        
        return blocks;
    }

    /**
     * Parse a Python-like list string into a JavaScript array
     * Supports nested arrays, numbers (including scientific notation), and basic Python syntax
     * @param {string} input - The Python-like list string
     * @param {string} format - The input format ('matrix', 'xyz_quat_wxyz', 'xyz_quat_xyzw')
     * @returns {Object} - { success: boolean, data: array|null, error: string|null, count: number }
     */
    static parse(input, format = 'matrix') {
        try {
            // Preprocess the input
            let processed = this.preprocess(input);
            
            // Try to parse as JSON first (fastest method)
            try {
                const data = JSON.parse(processed);
                const validation = this.validateAndConvert(data, format);
                if (validation.valid) {
                    return { 
                        success: true, 
                        data: validation.data, 
                        error: null, 
                        count: validation.data.length 
                    };
                } else {
                    return { 
                        success: false, 
                        data: null, 
                        error: validation.error, 
                        count: 0 
                    };
                }
            } catch (jsonError) {
                // If JSON parsing fails, try a more lenient approach
                const data = this.parsePythonList(processed);
                const validation = this.validateAndConvert(data, format);
                if (validation.valid) {
                    return { 
                        success: true, 
                        data: validation.data, 
                        error: null, 
                        count: validation.data.length 
                    };
                } else {
                    return { 
                        success: false, 
                        data: null, 
                        error: validation.error, 
                        count: 0 
                    };
                }
            }
        } catch (error) {
            return { 
                success: false, 
                data: null, 
                error: `Parse error: ${error.message}`, 
                count: 0 
            };
        }
    }

    /**
     * Preprocess input string to make it more JSON-compatible
     * @param {string} input 
     * @returns {string}
     */
    static preprocess(input) {
        let result = input.trim();
        
        // Remove Python comments
        result = result.replace(/#.*$/gm, '');
        
        // Remove numpy array wrapper if present
        result = result.replace(/np\.array\s*\(/g, '');
        result = result.replace(/numpy\.array\s*\(/g, '');
        result = result.replace(/array\s*\(/g, '');
        result = result.replace(/torch\.tensor\s*\(/g, '');
        result = result.replace(/tensor\s*\(/g, '');
        
        // Remove dtype specifications
        result = result.replace(/,?\s*dtype\s*=\s*[^,\)]+/g, '');
        
        // Remove trailing parentheses from numpy/torch wrappers
        // Count opening brackets/parens and remove extra closing ones
        let bracketCount = 0;
        let parenCount = 0;
        for (const char of result) {
            if (char === '[') bracketCount++;
            if (char === ']') bracketCount--;
            if (char === '(') parenCount++;
            if (char === ')') parenCount--;
        }
        while (parenCount > 0) {
            result = result.replace(/\)\s*$/, '');
            parenCount--;
        }
        
        // Replace Python True/False/None with JSON equivalents
        result = result.replace(/\bTrue\b/g, 'true');
        result = result.replace(/\bFalse\b/g, 'false');
        result = result.replace(/\bNone\b/g, 'null');
        
        // Handle scientific notation (e.g., 1e-5 or 1E+5)
        // This should already work in JSON, but ensure proper formatting
        
        // Remove trailing commas before closing brackets (common in Python)
        result = result.replace(/,(\s*[\]\)])/g, '$1');
        
        // Ensure the string starts and ends with brackets
        result = result.trim();
        
        return result;
    }

    /**
     * Parse Python list notation that might not be valid JSON
     * @param {string} input 
     * @returns {Array}
     */
    static parsePythonList(input) {
        // Use Function constructor to safely evaluate the array
        // This is safer than eval() as it only allows expressions
        const sanitized = input
            .replace(/\bnan\b/gi, 'NaN')
            .replace(/\binf\b/gi, 'Infinity')
            .replace(/\b-inf\b/gi, '-Infinity');
        
        // Try to evaluate as JavaScript array literal
        try {
            const fn = new Function(`return ${sanitized}`);
            return fn();
        } catch (e) {
            throw new Error(`Could not parse input as array: ${e.message}`);
        }
    }

    /**
     * Validate and convert parsed data to [T, 4, 4] format
     * @param {Array} data 
     * @param {string} format 
     * @returns {Object} - { valid: boolean, data: Array, error: string|null }
     */
    static validateAndConvert(data, format) {
        if (!Array.isArray(data)) {
            return { valid: false, error: 'Input must be an array' };
        }
        
        if (data.length === 0) {
            return { valid: false, error: 'Array is empty' };
        }

        const convertedData = [];

        // Check each pose based on format
        for (let i = 0; i < data.length; i++) {
            const pose = data[i];
            
            if (!Array.isArray(pose)) {
                return { valid: false, error: `Pose at index ${i} is not an array` };
            }

            if (format === 'matrix') {
                // Expect [4, 4]
                if (pose.length !== 4) {
                    return { valid: false, error: `Pose at index ${i} should have 4 rows, got ${pose.length}` };
                }
                
                for (let j = 0; j < 4; j++) {
                    if (!Array.isArray(pose[j])) {
                        return { valid: false, error: `Row ${j} of pose ${i} is not an array` };
                    }
                    if (pose[j].length !== 4) {
                        return { valid: false, error: `Row ${j} of pose ${i} should have 4 columns, got ${pose[j].length}` };
                    }
                    for (let k = 0; k < 4; k++) {
                        if (typeof pose[j][k] !== 'number' || isNaN(pose[j][k])) {
                            return { valid: false, error: `Element [${j}][${k}] of pose ${i} is not a valid number` };
                        }
                    }
                }
                convertedData.push(pose);

            } else if (format === 'xyz_quat_wxyz' || format === 'xyz_quat_xyzw' || format === 'quat_wxyz_xyz') {
                // Expect [7] (x, y, z, q1, q2, q3, q4)
                if (pose.length !== 7) {
                    return { valid: false, error: `Pose at index ${i} should have 7 elements, got ${pose.length}` };
                }

                for (let k = 0; k < 7; k++) {
                    if (typeof pose[k] !== 'number' || isNaN(pose[k])) {
                        return { valid: false, error: `Element ${k} of pose ${i} is not a valid number` };
                    }
                }

                // Convert to 4x4 matrix
                let x, y, z, qw, qx, qy, qz;
                
                if (format === 'quat_wxyz_xyz') {
                    // qw, qx, qy, qz, x, y, z
                    qw = pose[0];
                    qx = pose[1];
                    qy = pose[2];
                    qz = pose[3];
                    x = pose[4];
                    y = pose[5];
                    z = pose[6];
                } else {
                    // x, y, z first
                    x = pose[0];
                    y = pose[1];
                    z = pose[2];
                    
                    if (format === 'xyz_quat_wxyz') {
                        // w, x, y, z
                        qw = pose[3];
                        qx = pose[4];
                        qy = pose[5];
                        qz = pose[6];
                    } else {
                        // x, y, z, w
                        qx = pose[3];
                        qy = pose[4];
                        qz = pose[5];
                        qw = pose[6];
                    }
                }

                const matrix = this.quatToMatrix(x, y, z, qx, qy, qz, qw);
                convertedData.push(matrix);
            } else {
                return { valid: false, error: `Unknown format: ${format}` };
            }
        }
        
        return { valid: true, data: convertedData, error: null };
    }

    /**
     * Convert position and quaternion to 4x4 matrix
     */
    static quatToMatrix(x, y, z, qx, qy, qz, qw) {
        // Normalize quaternion
        const len = Math.sqrt(qx*qx + qy*qy + qz*qz + qw*qw);
        if (len > 0) {
            qx /= len;
            qy /= len;
            qz /= len;
            qw /= len;
        }

        const x2 = qx + qx;
        const y2 = qy + qy;
        const z2 = qz + qz;
        const xx = qx * x2;
        const xy = qx * y2;
        const xz = qx * z2;
        const yy = qy * y2;
        const yz = qy * z2;
        const zz = qz * z2;
        const wx = qw * x2;
        const wy = qw * y2;
        const wz = qw * z2;

        return [
            [1 - (yy + zz), xy - wz, xz + wy, x],
            [xy + wz, 1 - (xx + zz), yz - wx, y],
            [xz - wy, yz + wx, 1 - (xx + yy), z],
            [0, 0, 0, 1]
        ];
    }

    /**
     * Generate a sample pose sequence for testing
     * @param {number} count - Number of poses
     * @param {string} pattern - 'circle', 'line', 'helix'
     * @returns {Array}
     */
    static generateSample(count = 10, pattern = 'circle') {
        const poses = [];
        
        for (let i = 0; i < count; i++) {
            const t = i / (count - 1 || 1);
            let matrix;
            
            switch (pattern) {
                case 'circle':
                    const angle = t * Math.PI * 2;
                    const radius = 2;
                    matrix = this.createPoseMatrix(
                        Math.cos(angle) * radius,
                        0,
                        Math.sin(angle) * radius,
                        0, angle + Math.PI, 0
                    );
                    break;
                    
                case 'line':
                    matrix = this.createPoseMatrix(t * 4 - 2, 0, 0, 0, 0, 0);
                    break;
                    
                case 'helix':
                    const helixAngle = t * Math.PI * 4;
                    const helixRadius = 1.5;
                    matrix = this.createPoseMatrix(
                        Math.cos(helixAngle) * helixRadius,
                        t * 2 - 1,
                        Math.sin(helixAngle) * helixRadius,
                        0, helixAngle + Math.PI, 0
                    );
                    break;
                    
                default:
                    matrix = this.createIdentityMatrix();
            }
            
            poses.push(matrix);
        }
        
        return poses;
    }

    /**
     * Create a 4x4 transformation matrix from position and Euler angles
     */
    static createPoseMatrix(x, y, z, rx, ry, rz) {
        // Rotation matrices
        const cosX = Math.cos(rx), sinX = Math.sin(rx);
        const cosY = Math.cos(ry), sinY = Math.sin(ry);
        const cosZ = Math.cos(rz), sinZ = Math.sin(rz);
        
        // Combined rotation matrix (ZYX order)
        const r00 = cosY * cosZ;
        const r01 = cosX * sinZ + sinX * sinY * cosZ;
        const r02 = sinX * sinZ - cosX * sinY * cosZ;
        
        const r10 = -cosY * sinZ;
        const r11 = cosX * cosZ - sinX * sinY * sinZ;
        const r12 = sinX * cosZ + cosX * sinY * sinZ;
        
        const r20 = sinY;
        const r21 = -sinX * cosY;
        const r22 = cosX * cosY;
        
        return [
            [r00, r01, r02, x],
            [r10, r11, r12, y],
            [r20, r21, r22, z],
            [0, 0, 0, 1]
        ];
    }

    /**
     * Create an identity 4x4 matrix
     */
    static createIdentityMatrix() {
        return [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, 1]
        ];
    }

    /**
     * Convert pose array to formatted string for display
     */
    static stringify(poses, indent = 2) {
        return JSON.stringify(poses, null, indent);
    }
}
