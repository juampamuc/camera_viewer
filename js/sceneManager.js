/**
 * Scene Manager Module
 * Handles Three.js scene setup, camera frustum rendering, and viewport controls
 */

import * as THREE from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { PoseConverter } from './poseConverter.js';

export class SceneManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        
        // Scene objects
        this.frustumGroups = [];  // One group per trajectory
        this.gridHelper = null;
        this.worldAxes = null;
        
        // Multiple trajectories support
        this.trajectories = [];  // Array of { id, name, poses, convertedPoses, visible, group }
        
        // Current convention (needed for axis visualization)
        this.currentConvention = 'opengl';
        
        // Color palettes for different trajectories (when colorByTime is enabled)
        this.trajectoryColors = [
            { start: 0.55, end: 0.45 },  // Cyan to teal
            { start: 0.0, end: 0.08 },   // Red to orange
            { start: 0.75, end: 0.85 },  // Purple to pink
            { start: 0.25, end: 0.35 },  // Green to yellow-green
            { start: 0.58, end: 0.68 },  // Blue to light blue
            { start: 0.9, end: 0.98 },   // Magenta to pink
            { start: 0.12, end: 0.18 },  // Orange to yellow
            { start: 0.42, end: 0.48 },  // Teal to cyan
        ];
        
        // Settings
        this.settings = {
            frameStep: 1,
            frustumSize: 0.2,
            fov: 60,
            aspectRatio: 1.33,
            whiteBackground: true,  // Default to white background
            showAxes: true,
            showGrid: true,
            showWorldAxes: true,
            colorByTime: true
        };
        
        this.init();
    }

    init() {
        // Create scene
        this.scene = new THREE.Scene();
        this.updateBackgroundColor();
        
        // Create camera
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.01, 1000);
        this.camera.position.set(3, 3, 3);
        this.camera.lookAt(0, 0, 0);
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        
        // Create controls - use TrackballControls for free rotation in any direction
        this.controls = new TrackballControls(this.camera, this.canvas);
        this.controls.rotateSpeed = 2.0;
        this.controls.zoomSpeed = 1.2;
        this.controls.panSpeed = 0.8;
        this.controls.dynamicDampingFactor = 0.15;
        this.controls.staticMoving = false;  // Enable damping
        
        // Frustum groups will be created per trajectory
        
        // Add grid
        this.createGrid();
        
        // Add world axes
        this.createWorldAxes();
        
        // Handle resize
        window.addEventListener('resize', () => this.onResize());
        
        // Start animation loop
        this.animate();
    }

    updateBackgroundColor() {
        if (this.settings.whiteBackground) {
            this.scene.background = new THREE.Color(0xf5f5f5);
        } else {
            this.scene.background = new THREE.Color(0x111827);
        }
    }

    createGrid() {
        if (this.gridHelper) {
            this.scene.remove(this.gridHelper);
        }
        
        const gridColor = this.settings.whiteBackground ? 0xcccccc : 0x2a4a6e;
        this.gridHelper = new THREE.GridHelper(10, 20, gridColor, gridColor);
        this.gridHelper.visible = this.settings.showGrid;
        this.scene.add(this.gridHelper);
    }

    createWorldAxes() {
        if (this.worldAxes) {
            this.scene.remove(this.worldAxes);
        }
        
        this.worldAxes = new THREE.Group();
        const axisLength = 1.5;
        const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
        
        // X axis (red)
        const xGeom = new LineGeometry();
        xGeom.setPositions([0, 0, 0, axisLength, 0, 0]);
        const xMat = new LineMaterial({
            color: this.settings.whiteBackground ? 0xd94848 : 0xff6b6b,
            linewidth: 3,
            resolution: resolution
        });
        this.worldAxes.add(new Line2(xGeom, xMat));
        
        // Y axis (green)
        const yGeom = new LineGeometry();
        yGeom.setPositions([0, 0, 0, 0, axisLength, 0]);
        const yMat = new LineMaterial({
            color: this.settings.whiteBackground ? 0x2f9e44 : 0x51cf66,
            linewidth: 3,
            resolution: resolution
        });
        this.worldAxes.add(new Line2(yGeom, yMat));
        
        // Z axis (blue)
        const zGeom = new LineGeometry();
        zGeom.setPositions([0, 0, 0, 0, 0, axisLength]);
        const zMat = new LineMaterial({
            color: this.settings.whiteBackground ? 0x1c7ed6 : 0x4dabf7,
            linewidth: 3,
            resolution: resolution
        });
        this.worldAxes.add(new Line2(zGeom, zMat));
        
        this.worldAxes.visible = this.settings.showWorldAxes;
        this.scene.add(this.worldAxes);
    }

    /**
     * Create a camera frustum geometry
     * @param {Array} poseMatrix - 4x4 transformation matrix
     * @param {number} index - Frame index within trajectory
     * @param {number} totalCount - Total frames in trajectory
     * @param {number} trajectoryIndex - Which trajectory this belongs to
     */
    createFrustum(poseMatrix, index, totalCount, trajectoryIndex = 0) {
        const group = new THREE.Group();
        
        const fov = this.settings.fov;
        const aspect = this.settings.aspectRatio;
        const size = this.settings.frustumSize;
        
        const halfHeight = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * size;
        const halfWidth = halfHeight * aspect;
        
        // Frustum vertices (camera at origin looking down -Z in OpenGL)
        const vertices = [
            new THREE.Vector3(0, 0, 0),                          // Camera origin
            new THREE.Vector3(-halfWidth, -halfHeight, -size),   // Bottom-left
            new THREE.Vector3(halfWidth, -halfHeight, -size),    // Bottom-right
            new THREE.Vector3(halfWidth, halfHeight, -size),     // Top-right
            new THREE.Vector3(-halfWidth, halfHeight, -size)     // Top-left
        ];
        
        const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
        
        // Determine frustum color
        let frustumColor;
        if (this.settings.colorByTime && totalCount > 1) {
            // Use trajectory-specific color palette
            const colorPalette = this.trajectoryColors[trajectoryIndex % this.trajectoryColors.length];
            const t = totalCount > 1 ? index / (totalCount - 1) : 0;
            frustumColor = new THREE.Color();
            const hue = colorPalette.start + t * (colorPalette.end - colorPalette.start);
            frustumColor.setHSL(hue, 0.8, 0.55);
        } else {
            // Use fixed colors per trajectory when not coloring by time
            const hue = this.trajectoryColors[trajectoryIndex % this.trajectoryColors.length].start;
            frustumColor = new THREE.Color();
            frustumColor.setHSL(hue, 0.7, 0.5);
        }
        
        // Line pairs for frustum edges
        const linePairs = [
            [1, 2], [2, 3], [3, 4], [4, 1],  // Near plane
            [0, 1], [0, 2], [0, 3], [0, 4]   // Edges from camera to near plane
        ];
        
        linePairs.forEach(pair => {
            const positions = [
                vertices[pair[0]].x, vertices[pair[0]].y, vertices[pair[0]].z,
                vertices[pair[1]].x, vertices[pair[1]].y, vertices[pair[1]].z
            ];
            
            const lineGeometry = new LineGeometry();
            lineGeometry.setPositions(positions);
            
            const lineMaterial = new LineMaterial({
                color: frustumColor,
                linewidth: 2,
                resolution: resolution
            });
            
            group.add(new Line2(lineGeometry, lineMaterial));
        });
        
        // Add local camera axes if enabled
        if (this.settings.showAxes) {
            const axisLength = size * 0.4;
            const axisLineWidth = 4;
            
            // Determine axis directions based on original convention
            const ySign = this.currentConvention === 'opencv' ? -1 : 1;
            const zSign = this.currentConvention === 'opencv' ? -1 : 1;
            
            // X axis (red)
            const xGeom = new LineGeometry();
            xGeom.setPositions([0, 0, 0, axisLength, 0, 0]);
            const xMat = new LineMaterial({
                color: this.settings.whiteBackground ? 0xd94848 : 0xff6b6b,
                linewidth: axisLineWidth,
                resolution: resolution
            });
            group.add(new Line2(xGeom, xMat));
            
            // Y axis (green)
            const yGeom = new LineGeometry();
            yGeom.setPositions([0, 0, 0, 0, ySign * axisLength, 0]);
            const yMat = new LineMaterial({
                color: this.settings.whiteBackground ? 0x2f9e44 : 0x51cf66,
                linewidth: axisLineWidth,
                resolution: resolution
            });
            group.add(new Line2(yGeom, yMat));
            
            // Z axis (blue)
            const zGeom = new LineGeometry();
            zGeom.setPositions([0, 0, 0, 0, 0, zSign * axisLength]);
            const zMat = new LineMaterial({
                color: this.settings.whiteBackground ? 0x1c7ed6 : 0x4dabf7,
                linewidth: axisLineWidth,
                resolution: resolution
            });
            group.add(new Line2(zGeom, zMat));
        }
        
        // Apply transformation from pose matrix
        const matrix = new THREE.Matrix4();
        matrix.fromArray(PoseConverter.toMatrix4(poseMatrix));
        group.applyMatrix4(matrix);
        
        return group;
    }

    /**
     * Update the scene with multiple trajectories (resets view)
     * @param {Array} trajectories - Array of { id, name, poses, count, visible }
     */
    setTrajectories(trajectories, poseFormat = 'c2w', convention = 'opengl') {
        this.currentConvention = convention;
        
        // Clear existing trajectory groups
        this.clearAllTrajectories();
        
        // Process each trajectory
        this.trajectories = trajectories.map((traj, index) => {
            const convertedPoses = PoseConverter.convertAll(traj.poses, poseFormat, convention);
            const group = new THREE.Group();
            group.name = `trajectory_${traj.id}`;
            this.scene.add(group);
            
            return {
                ...traj,
                convertedPoses: convertedPoses,
                group: group
            };
        });
        
        this.updateFrustums();
        this.fitCameraToScene();
    }

    /**
     * Update trajectories without resetting the view (for format/convention changes)
     */
    updateTrajectoriesKeepView(trajectories, poseFormat = 'c2w', convention = 'opengl') {
        this.currentConvention = convention;
        
        // Update converted poses for each trajectory
        this.trajectories.forEach((traj, index) => {
            if (trajectories[index]) {
                traj.poses = trajectories[index].poses;
                traj.convertedPoses = PoseConverter.convertAll(traj.poses, poseFormat, convention);
            }
        });
        
        this.updateFrustums();
    }

    /**
     * Clear all trajectory groups from the scene
     */
    clearAllTrajectories() {
        this.trajectories.forEach(traj => {
            if (traj.group) {
                // Clear children
                while (traj.group.children.length > 0) {
                    const child = traj.group.children[0];
                    traj.group.remove(child);
                    this.disposeObject(child);
                }
                this.scene.remove(traj.group);
            }
        });
        this.trajectories = [];
    }

    /**
     * Set visibility of a specific trajectory
     */
    setTrajectoryVisibility(trajectoryId, visible) {
        const traj = this.trajectories.find(t => t.id === trajectoryId);
        if (traj) {
            traj.visible = visible;
            if (traj.group) {
                traj.group.visible = visible;
            }
        }
    }

    /**
     * Update frustum rendering based on current settings
     */
    updateFrustums() {
        const step = Math.max(1, Math.floor(this.settings.frameStep));
        
        this.trajectories.forEach((traj, trajIndex) => {
            // Clear existing frustums in this trajectory's group
            while (traj.group.children.length > 0) {
                const child = traj.group.children[0];
                traj.group.remove(child);
                this.disposeObject(child);
            }
            
            if (!traj.convertedPoses || traj.convertedPoses.length === 0) return;
            
            // Determine which frames to show
            const framesToShow = [];
            for (let i = 0; i < traj.convertedPoses.length; i += step) {
                framesToShow.push(i);
            }
            
            // Create frustums
            framesToShow.forEach((frameIdx, displayIdx) => {
                const frustum = this.createFrustum(
                    traj.convertedPoses[frameIdx],
                    displayIdx,
                    framesToShow.length,
                    trajIndex
                );
                traj.group.add(frustum);
            });
            
            // Update visibility
            traj.group.visible = traj.visible;
        });
    }

    /**
     * Legacy: Update the scene with single trajectory (for backward compatibility)
     */
    setPoses(poses, poseFormat = 'c2w', convention = 'opengl') {
        this.setTrajectories([{
            id: 0,
            name: 'Trajectory 1',
            poses: poses,
            count: poses.length,
            visible: true
        }], poseFormat, convention);
    }

    /**
     * Legacy: Update poses without resetting view (for backward compatibility)
     */
    updatePosesKeepView(poses, poseFormat = 'c2w', convention = 'opengl') {
        if (this.trajectories.length === 1) {
            this.updateTrajectoriesKeepView([{
                id: 0,
                name: 'Trajectory 1',
                poses: poses,
                count: poses.length,
                visible: true
            }], poseFormat, convention);
        }
    }

    /**
     * Dispose of Three.js objects to prevent memory leaks
     */
    disposeObject(object) {
        if (object.geometry) {
            object.geometry.dispose();
        }
        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach(m => m.dispose());
            } else {
                object.material.dispose();
            }
        }
        if (object.children) {
            object.children.forEach(child => this.disposeObject(child));
        }
    }

    /**
     * Fit the camera to view all frustums
     */
    fitCameraToScene() {
        // Gather all visible poses from all trajectories
        const allPoses = [];
        this.trajectories.forEach(traj => {
            if (traj.visible && traj.convertedPoses) {
                allPoses.push(...traj.convertedPoses);
            }
        });
        
        if (allPoses.length === 0) return;
        
        const bbox = PoseConverter.computeBoundingBox(allPoses);
        const sceneSize = PoseConverter.computeSceneSize(allPoses);
        
        // Position camera to view the entire scene
        const distance = Math.max(sceneSize * 1.5, 2);
        const targetPos = new THREE.Vector3(bbox.center.x, bbox.center.y, bbox.center.z);
        const cameraPos = new THREE.Vector3(
            bbox.center.x + distance * 0.7,
            bbox.center.y + distance * 0.5,
            bbox.center.z + distance * 0.7
        );
        
        // Set controls target first
        this.controls.target.copy(targetPos);
        
        // Set camera position and orientation
        this.camera.position.copy(cameraPos);
        this.camera.up.set(0, 1, 0);  // Reset up vector to Y-up
        this.camera.lookAt(targetPos);
        
        // Update TrackballControls internal state by storing current as target0/position0
        // This makes the current view the new "home" position for reset
        this.controls.target0.copy(targetPos);
        this.controls.position0.copy(cameraPos);
        this.controls.up0.set(0, 1, 0);
        
        this.controls.update();
    }

    /**
     * Reset the camera view
     */
    resetView() {
        this.fitCameraToScene();
    }

    /**
     * Update setting and refresh as needed
     */
    updateSetting(key, value) {
        this.settings[key] = value;
        
        switch (key) {
            case 'whiteBackground':
                this.updateBackgroundColor();
                this.createGrid();
                this.createWorldAxes();
                this.updateFrustums();
                break;
                
            case 'showGrid':
                if (this.gridHelper) {
                    this.gridHelper.visible = value;
                }
                break;
                
            case 'showWorldAxes':
                if (this.worldAxes) {
                    this.worldAxes.visible = value;
                }
                break;
                
            case 'showAxes':
            case 'colorByTime':
            case 'frameStep':
            case 'frustumSize':
            case 'fov':
                this.updateFrustums();
                break;
        }
    }

    /**
     * Handle window resize
     */
    onResize() {
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
        
        // Update line material resolutions
        const resolution = new THREE.Vector2(width, height);
        this.scene.traverse(obj => {
            if (obj.material && obj.material.resolution) {
                obj.material.resolution.copy(resolution);
            }
        });
    }

    /**
     * Animation loop
     */
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Get statistics about the current scene
     */
    getStats() {
        const step = Math.max(1, Math.floor(this.settings.frameStep));
        
        let totalPoses = 0;
        let displayedPoses = 0;
        const trajectoryStats = [];
        
        this.trajectories.forEach(traj => {
            const trajCount = traj.poses ? traj.poses.length : 0;
            const trajDisplayed = traj.visible ? Math.ceil(trajCount / step) : 0;
            totalPoses += trajCount;
            displayedPoses += trajDisplayed;
            
            trajectoryStats.push({
                id: traj.id,
                name: traj.name,
                count: trajCount,
                displayed: trajDisplayed,
                visible: traj.visible
            });
        });
        
        return {
            totalPoses: totalPoses,
            displayedPoses: displayedPoses,
            step: step,
            trajectoryCount: this.trajectories.length,
            trajectories: trajectoryStats
        };
    }

    /**
     * Get the color for a trajectory (for UI display)
     */
    getTrajectoryColor(trajectoryIndex) {
        const colorPalette = this.trajectoryColors[trajectoryIndex % this.trajectoryColors.length];
        const color = new THREE.Color();
        color.setHSL(colorPalette.start, 0.7, 0.5);
        return '#' + color.getHexString();
    }
}

