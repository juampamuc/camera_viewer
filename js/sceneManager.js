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
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Scene objects
        this.frustumGroups = [];  // One group per trajectory
        this.gridHelper = null;
        this.worldAxes = null;
        
        // Multiple trajectories support
        this.trajectories = [];  // Array of { id, name, poses, convertedPoses, visible, group }
        
        // Current convention (needed for axis visualization)
        this.currentConvention = 'opengl';

        // Export state
        this.isExporting = false;
        this.exportCancelled = false;
        
        // Distinct hues for different trajectories (colorByTime uses dark-to-bright of same hue)
        this.trajectoryHues = [
            0.0,    // Red
            0.58,   // Blue
            0.33,   // Green
            0.08,   // Orange
            0.75,   // Purple
            0.50,   // Cyan
            0.92,   // Pink/Magenta
            0.17,   // Yellow
        ];
        
        // Settings
        this.settings = {
            frameStep: 1,
            frustumSize: 0.2,
            fov: 60,
            aspectRatio: 1.33,
            backgroundColor: '#f5f5f5',
            showAxes: true,
            showFrustum: true,
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

        // Handle double click for focusing
        this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
        
        // Start animation loop
        this.animate();
    }

    updateBackgroundColor() {
        this.scene.background = new THREE.Color(this.settings.backgroundColor);
    }

    /**
     * Whether the current background is light (luminance > 0.5)
     */
    isLightBackground() {
        const c = new THREE.Color(this.settings.backgroundColor);
        // Relative luminance
        return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) > 0.5;
    }

    createGrid() {
        if (this.gridHelper) {
            this.scene.remove(this.gridHelper);
        }
        
        const gridColor = this.isLightBackground() ? 0xcccccc : 0x2a4a6e;
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
            color: this.isLightBackground() ? 0xd94848 : 0xff6b6b,
            linewidth: 3,
            resolution: resolution
        });
        this.worldAxes.add(new Line2(xGeom, xMat));
        
        // Y axis (green)
        const yGeom = new LineGeometry();
        yGeom.setPositions([0, 0, 0, 0, axisLength, 0]);
        const yMat = new LineMaterial({
            color: this.isLightBackground() ? 0x2f9e44 : 0x51cf66,
            linewidth: 3,
            resolution: resolution
        });
        this.worldAxes.add(new Line2(yGeom, yMat));
        
        // Z axis (blue)
        const zGeom = new LineGeometry();
        zGeom.setPositions([0, 0, 0, 0, 0, axisLength]);
        const zMat = new LineMaterial({
            color: this.isLightBackground() ? 0x1c7ed6 : 0x4dabf7,
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
        const hue = this.trajectoryHues[trajectoryIndex % this.trajectoryHues.length];
        frustumColor = new THREE.Color();
        
        if (this.settings.colorByTime && totalCount > 1) {
            // Same hue, but dark-to-bright transition for time visualization
            const t = totalCount > 1 ? index / (totalCount - 1) : 0;
            
            let lightness;
            if (this.isLightBackground()) {
                // Light background: avoid very bright colors (0.1 to 0.75)
                lightness = 0.1 + t * 0.65;
            } else {
                // Dark background: avoid very dark colors (0.25 to 0.9)
                lightness = 0.25 + t * 0.65;
            }
            
            frustumColor.setHSL(hue, 1.0, lightness);
        } else {
            // Use fixed mid-brightness color per trajectory
            frustumColor.setHSL(hue, 0.75, 0.5);
        }
        
        // Line pairs for frustum edges
        if (this.settings.showFrustum) {
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
        }
        
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
                color: this.isLightBackground() ? 0xd94848 : 0xff6b6b,
                linewidth: axisLineWidth,
                resolution: resolution
            });
            group.add(new Line2(xGeom, xMat));
            
            // Y axis (green)
            const yGeom = new LineGeometry();
            yGeom.setPositions([0, 0, 0, 0, ySign * axisLength, 0]);
            const yMat = new LineMaterial({
                color: this.isLightBackground() ? 0x2f9e44 : 0x51cf66,
                linewidth: axisLineWidth,
                resolution: resolution
            });
            group.add(new Line2(yGeom, yMat));
            
            // Z axis (blue)
            const zGeom = new LineGeometry();
            zGeom.setPositions([0, 0, 0, 0, 0, zSign * axisLength]);
            const zMat = new LineMaterial({
                color: this.isLightBackground() ? 0x1c7ed6 : 0x4dabf7,
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
        if (this.isExporting) return;
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
        
        // Adjust camera near/far planes based on scene size
        // This helps with Z-fighting on large scales and clipping on small scales
        this.camera.near = Math.max(0.001, sceneSize / 10000);
        this.camera.far = Math.max(100, sceneSize * 100);
        this.camera.updateProjectionMatrix();

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
        
        this.controls.update();
    }

    /**
     * Handle double click to focus on a point
     */
    onDoubleClick(event) {
        // Calculate mouse position in normalized device coordinates
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Intersect with all trajectory groups
        const intersects = [];
        this.trajectories.forEach(traj => {
            if (traj.visible && traj.group) {
                // We need to intersect recursively because frustums are groups of lines
                const trajIntersects = this.raycaster.intersectObject(traj.group, true);
                intersects.push(...trajIntersects);
            }
        });

        if (intersects.length > 0) {
            // Sort by distance
            intersects.sort((a, b) => a.distance - b.distance);
            
            // Focus on the first hit point
            const point = intersects[0].point;
            
            // Smoothly move target to the point
            // For now, just snap to it
            this.controls.target.copy(point);
            this.controls.update();
        }
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
            case 'backgroundColor':
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
            case 'showFrustum':
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
        
        // TrackballControls needs to know about resize
        this.controls.handleResize();
        
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
        const hue = this.trajectoryHues[trajectoryIndex % this.trajectoryHues.length];
        const color = new THREE.Color();
        color.setHSL(hue, 0.75, 0.5);
        return '#' + color.getHexString();
    }

    /**
     * Export the visualization as a video.
     * Animates frames appearing one by one (first to last), then holds.
     */
    async exportVideo(width, height, fps, holdSeconds, format, onProgress) {
        if (this.isExporting) return null;
        this.isExporting = true;
        this.exportCancelled = false;

        // Create offscreen canvas and renderer
        const offCanvas = document.createElement('canvas');
        offCanvas.width = width;
        offCanvas.height = height;

        const offRenderer = new THREE.WebGLRenderer({
            canvas: offCanvas,
            antialias: true,
            preserveDrawingBuffer: true
        });
        offRenderer.setPixelRatio(1);
        offRenderer.setSize(width, height);

        // Clone camera with export aspect ratio
        const exportCamera = this.camera.clone();
        exportCamera.aspect = width / height;
        exportCamera.updateProjectionMatrix();

        // Collect line materials for resolution switching
        const lineMaterials = [];
        this.scene.traverse(obj => {
            if (obj.material && obj.material.resolution) {
                lineMaterials.push(obj.material);
            }
        });
        const exportRes = new THREE.Vector2(width, height);
        const viewportRes = new THREE.Vector2(this.canvas.clientWidth, this.canvas.clientHeight);

        // Count displayed frames per trajectory
        const trajFrameCounts = this.trajectories.map(traj =>
            traj.group ? traj.group.children.length : 0
        );
        const maxFrames = Math.max(...trajFrameCounts, 0);

        if (maxFrames === 0) {
            this.isExporting = false;
            offRenderer.dispose();
            return null;
        }

        const holdFrames = Math.round((holdSeconds || 0) * fps);
        const totalVideoFrames = maxFrames + holdFrames;

        // Set up MediaRecorder via captureStream
        const stream = offCanvas.captureStream(0);
        const videoTrack = stream.getVideoTracks()[0];

        // Select mime type based on requested format with fallback
        let mimeType;
        if (format === 'mp4') {
            if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
                mimeType = 'video/mp4;codecs=avc1';
            } else if (MediaRecorder.isTypeSupported('video/mp4')) {
                mimeType = 'video/mp4';
            } else {
                // Fallback to webm if mp4 not supported
                mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                    ? 'video/webm;codecs=vp9' : 'video/webm';
            }
        } else {
            mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                ? 'video/webm;codecs=vp9' : 'video/webm';
        }

        const mediaRecorder = new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond: 8_000_000
        });

        const chunks = [];
        mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        // Save current child visibility state
        const savedState = this.trajectories.map(traj =>
            traj.group.children.map(c => c.visible)
        );

        return new Promise((resolve) => {
            mediaRecorder.onstop = () => {
                // Restore child visibility
                this.trajectories.forEach((traj, i) => {
                    traj.group.children.forEach((child, j) => {
                        child.visible = savedState[i][j] ?? true;
                    });
                });
                // Restore line material resolutions
                lineMaterials.forEach(m => m.resolution.copy(viewportRes));

                offRenderer.dispose();
                this.isExporting = false;

                if (this.exportCancelled) {
                    resolve(null);
                } else {
                    resolve(new Blob(chunks, { type: mimeType }));
                }
            };

            mediaRecorder.start();

            let frame = 0;
            const renderNext = () => {
                if (this.exportCancelled || frame >= totalVideoFrames) {
                    mediaRecorder.stop();
                    return;
                }

                const animStep = Math.min(frame, maxFrames - 1);

                // Reveal frustums 0..animStep for each trajectory
                this.trajectories.forEach((traj, ti) => {
                    const count = trajFrameCounts[ti];
                    traj.group.children.forEach((child, ci) => {
                        child.visible = ci <= animStep && ci < count;
                    });
                });

                // Switch line material resolutions for export render
                lineMaterials.forEach(m => m.resolution.copy(exportRes));
                offRenderer.render(this.scene, exportCamera);
                lineMaterials.forEach(m => m.resolution.copy(viewportRes));

                // Capture frame
                if (videoTrack.requestFrame) {
                    videoTrack.requestFrame();
                }

                frame++;
                if (onProgress) onProgress(frame / totalVideoFrames);

                setTimeout(renderNext, 1000 / fps);
            };

            renderNext();
        });
    }

    /**
     * Cancel an in-progress export
     */
    cancelExport() {
        this.exportCancelled = true;
    }
}

