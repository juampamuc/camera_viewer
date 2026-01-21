/**
 * Pose Converter Module
 * Handles conversion between different camera pose conventions:
 * - Camera-to-World (c2w) vs World-to-Camera (w2c)
 * - OpenGL vs OpenCV coordinate systems
 */

export class PoseConverter {
    /**
     * Convert a single 4x4 pose matrix to camera-to-world format in OpenGL convention
     * This is the target format for Three.js visualization
     * @param {Array} pose - 4x4 transformation matrix
     * @param {string} poseFormat - 'c2w' or 'w2c'
     * @param {string} convention - 'opengl' or 'opencv'
     * @returns {Array} - 4x4 matrix in c2w OpenGL format
     */
    static toThreeJS(pose, poseFormat = 'c2w', convention = 'opengl') {
        let result = this.cloneMatrix(pose);
        
        // Step 1: Convert w2c to c2w if needed
        if (poseFormat === 'w2c') {
            result = this.invertMatrix(result);
        }
        
        // Step 2: Convert from OpenCV to OpenGL convention if needed
        // OpenCV: X-right, Y-down, Z-forward
        // OpenGL: X-right, Y-up, Z-backward
        if (convention === 'opencv') {
            result = this.opencvToOpengl(result);
        }
        
        return result;
    }

    /**
     * Convert an array of poses to Three.js format
     * @param {Array} poses - Array of 4x4 matrices
     * @param {string} poseFormat - 'c2w' or 'w2c'
     * @param {string} convention - 'opengl' or 'opencv'
     * @returns {Array} - Array of converted matrices
     */
    static convertAll(poses, poseFormat = 'c2w', convention = 'opengl') {
        return poses.map(pose => this.toThreeJS(pose, poseFormat, convention));
    }

    /**
     * Deep clone a 4x4 matrix
     */
    static cloneMatrix(matrix) {
        return matrix.map(row => [...row]);
    }

    /**
     * Invert a 4x4 transformation matrix
     * For rigid body transformations: [R|t] -> [R^T | -R^T * t]
     */
    static invertMatrix(matrix) {
        // Extract rotation (3x3) and translation
        const R = [
            [matrix[0][0], matrix[0][1], matrix[0][2]],
            [matrix[1][0], matrix[1][1], matrix[1][2]],
            [matrix[2][0], matrix[2][1], matrix[2][2]]
        ];
        const t = [matrix[0][3], matrix[1][3], matrix[2][3]];
        
        // Transpose rotation
        const RT = [
            [R[0][0], R[1][0], R[2][0]],
            [R[0][1], R[1][1], R[2][1]],
            [R[0][2], R[1][2], R[2][2]]
        ];
        
        // Compute -R^T * t
        const newT = [
            -(RT[0][0] * t[0] + RT[0][1] * t[1] + RT[0][2] * t[2]),
            -(RT[1][0] * t[0] + RT[1][1] * t[1] + RT[1][2] * t[2]),
            -(RT[2][0] * t[0] + RT[2][1] * t[1] + RT[2][2] * t[2])
        ];
        
        // Construct inverted matrix
        return [
            [RT[0][0], RT[0][1], RT[0][2], newT[0]],
            [RT[1][0], RT[1][1], RT[1][2], newT[1]],
            [RT[2][0], RT[2][1], RT[2][2], newT[2]],
            [0, 0, 0, 1]
        ];
    }

    /**
     * Convert from OpenCV to OpenGL coordinate convention
     * OpenCV: X-right, Y-down, Z-forward (camera looks down +Z)
     * OpenGL: X-right, Y-up, Z-backward (camera looks down -Z)
     * 
     * For a c2w matrix, the columns represent the camera's local axes in world space:
     * - Column 0: camera's X axis (right) in world
     * - Column 1: camera's Y axis (down in OpenCV, up in OpenGL) in world
     * - Column 2: camera's Z axis (forward in OpenCV, backward in OpenGL) in world
     * - Column 3: camera position in world (unchanged)
     * 
     * The conversion: M_opengl = M_opencv * diag(1, -1, -1, 1)
     * This negates columns 1 and 2 of the rotation, but keeps translation unchanged.
     */
    static opencvToOpengl(matrix) {
        const result = this.cloneMatrix(matrix);
        
        // Flip the Y and Z columns (local camera axes)
        // This converts from Y-down/Z-forward to Y-up/Z-backward camera convention
        for (let i = 0; i < 3; i++) {
            result[i][1] = -matrix[i][1]; // Negate Y column (down → up)
            result[i][2] = -matrix[i][2]; // Negate Z column (forward → backward)
        }
        
        // Translation (camera position in world) stays unchanged
        // The camera is at the same world position, only its local axes change
        
        return result;
    }

    /**
     * Convert from OpenGL to OpenCV coordinate convention
     * This is the inverse operation of opencvToOpengl.
     * Since diag(1,-1,-1,1) is its own inverse, the same operation applies.
     */
    static openglToOpencv(matrix) {
        // The transformation diag(1,-1,-1,1) is self-inverse
        return this.opencvToOpengl(matrix);
    }

    /**
     * Convert a JavaScript 4x4 array to Three.js Matrix4
     */
    static toMatrix4(matrix) {
        // Three.js uses column-major order, so we need to transpose
        return [
            matrix[0][0], matrix[1][0], matrix[2][0], matrix[3][0],
            matrix[0][1], matrix[1][1], matrix[2][1], matrix[3][1],
            matrix[0][2], matrix[1][2], matrix[2][2], matrix[3][2],
            matrix[0][3], matrix[1][3], matrix[2][3], matrix[3][3]
        ];
    }

    /**
     * Extract position from a 4x4 transformation matrix
     */
    static extractPosition(matrix) {
        return {
            x: matrix[0][3],
            y: matrix[1][3],
            z: matrix[2][3]
        };
    }

    /**
     * Extract rotation matrix (3x3) from a 4x4 transformation matrix
     */
    static extractRotation(matrix) {
        return [
            [matrix[0][0], matrix[0][1], matrix[0][2]],
            [matrix[1][0], matrix[1][1], matrix[1][2]],
            [matrix[2][0], matrix[2][1], matrix[2][2]]
        ];
    }

    /**
     * Compute the bounding box of all camera positions
     */
    static computeBoundingBox(poses) {
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        
        for (const pose of poses) {
            const pos = this.extractPosition(pose);
            minX = Math.min(minX, pos.x);
            minY = Math.min(minY, pos.y);
            minZ = Math.min(minZ, pos.z);
            maxX = Math.max(maxX, pos.x);
            maxY = Math.max(maxY, pos.y);
            maxZ = Math.max(maxZ, pos.z);
        }
        
        return {
            min: { x: minX, y: minY, z: minZ },
            max: { x: maxX, y: maxY, z: maxZ },
            center: {
                x: (minX + maxX) / 2,
                y: (minY + maxY) / 2,
                z: (minZ + maxZ) / 2
            },
            size: {
                x: maxX - minX,
                y: maxY - minY,
                z: maxZ - minZ
            }
        };
    }

    /**
     * Compute the diagonal length of the bounding box
     */
    static computeSceneSize(poses) {
        const bbox = this.computeBoundingBox(poses);
        return Math.sqrt(
            bbox.size.x * bbox.size.x +
            bbox.size.y * bbox.size.y +
            bbox.size.z * bbox.size.z
        );
    }
}

