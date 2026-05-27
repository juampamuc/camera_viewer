/**
 * Main Application Module
 * Coordinates all components of the Camera Pose Visualizer
 */

import { PoseParser } from './poseParser.js';
import { SceneManager } from './sceneManager.js';

class CameraPoseVisualizer {
    constructor() {
        // UI Elements
        this.ui = {
            poseInput: document.getElementById('pose-input'),
            trajectoryNameInput: document.getElementById('trajectory-name-input'),
            addTrajBtn: document.getElementById('add-traj-btn'),
            clearInputBtn: document.getElementById('clear-input-btn'),
            cancelEditBtn: document.getElementById('cancel-edit-btn'),
            trajectoryComposer: document.getElementById('trajectory-composer'),
            composerCollapsed: document.getElementById('composer-collapsed'),
            expandComposerBtn: document.getElementById('expand-composer-btn'),
            parseStatus: document.getElementById('parse-status'),
            poseFormat: document.getElementById('pose-format'),
            inputFormat: document.getElementById('input-format'),
            coordConvention: document.getElementById('coord-convention'),
            poseInfo: document.getElementById('pose-info'),
            
            // Display settings
            frameStep: document.getElementById('frame-step'),
            frustumSize: document.getElementById('frustum-size'),
            cameraFov: document.getElementById('camera-fov'),
            bgColor: document.getElementById('bg-color'),
            showFrustum: document.getElementById('show-frustum'),
            showAxes: document.getElementById('show-axes'),
            showGrid: document.getElementById('show-grid'),
            showWorldAxes: document.getElementById('show-world-axes'),
            colorByTime: document.getElementById('color-by-time'),
            resetViewBtn: document.getElementById('reset-view-btn'),
            
            // Settings panel fold
            settingsToggle: document.getElementById('settings-toggle'),
            settingsContent: document.getElementById('settings-content'),
            foldIcon: document.getElementById('fold-icon'),
            
            // Trajectory visibility container
            trajectoryList: document.getElementById('trajectory-list'),
            clearTrajectoriesBtn: document.getElementById('clear-trajectories-btn'),
            
            // Canvas
            canvas: document.getElementById('three-canvas'),

            // Video export
            exportWidth: document.getElementById('export-width'),
            exportHeight: document.getElementById('export-height'),
            exportFps: document.getElementById('export-fps'),
            exportHold: document.getElementById('export-hold'),
            exportFormat: document.getElementById('export-format'),
            exportPreview: document.getElementById('export-preview'),
            exportBtn: document.getElementById('export-btn'),
            exportDuration: document.getElementById('export-duration'),
            exportProgress: document.getElementById('export-progress'),
            exportProgressBar: document.getElementById('export-progress-bar'),
            exportProgressText: document.getElementById('export-progress-text'),
            exportStatus: document.getElementById('export-status'),
            exportPreviewMask: document.getElementById('export-preview-mask')
        };
        
        // Scene manager
        this.sceneManager = null;
        
        // Current trajectories data
        this.currentTrajectories = [];
        this.nextTrajectoryId = 0;
        this.editingTrajectoryId = null;
        
        this.init();
    }

    init() {
        // Initialize Three.js scene
        this.sceneManager = new SceneManager(this.ui.canvas);
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load sample data for demonstration
        this.loadSampleData();

        // Initialize preview mask
        this.updatePreviewMask();
    }

    setupEventListeners() {
        this.ui.addTrajBtn.addEventListener('click', () => this.addOrUpdateTrajectory());
        this.ui.clearInputBtn.addEventListener('click', () => this.clearComposerInput());
        this.ui.cancelEditBtn.addEventListener('click', () => this.exitEditMode());
        this.ui.expandComposerBtn.addEventListener('click', () => this.expandComposer());
        this.ui.clearTrajectoriesBtn.addEventListener('click', () => this.clearTrajectories());
        
        // Pose settings changes
        this.ui.poseFormat.addEventListener('change', () => this.onPoseSettingsChange());
        this.ui.coordConvention.addEventListener('change', () => this.onPoseSettingsChange());
        
        // Input format change - update placeholder
        this.ui.inputFormat.addEventListener('change', () => {
            const format = this.ui.inputFormat.value;
            if (format === 'matrix') {
                this.ui.poseInput.placeholder = `[
  [[1, 0, 0, 0],
   [0, 1, 0, 0],
   [0, 0, 1, 0],
   [0, 0, 0, 1]],
  ...
]`;
            } else if (format === 'xyz_quat_wxyz') {
                this.ui.poseInput.placeholder = `[
  [x, y, z, qw, qx, qy, qz],
  ...
]`;
            } else if (format === 'xyz_quat_xyzw') {
                this.ui.poseInput.placeholder = `[
  [x, y, z, qx, qy, qz, qw],
  ...
]`;
            } else if (format === 'quat_wxyz_xyz') {
                this.ui.poseInput.placeholder = `[
  [qw, qx, qy, qz, x, y, z],
  ...
]`;
            }
        });
        
        // Display settings
        this.ui.frameStep.addEventListener('input', (e) => {
            this.sceneManager.updateSetting('frameStep', parseInt(e.target.value) || 1);
            this.updateInfoPanel();
        });
        
        this.ui.frustumSize.addEventListener('input', (e) => {
            this.sceneManager.updateSetting('frustumSize', parseFloat(e.target.value) || 0.2);
        });
        
        this.ui.cameraFov.addEventListener('input', (e) => {
            this.sceneManager.updateSetting('fov', parseInt(e.target.value) || 60);
        });
        
        this.ui.bgColor.addEventListener('input', (e) => {
            this.sceneManager.updateSetting('backgroundColor', e.target.value);
        });

        this.ui.showFrustum.addEventListener('change', (e) => {
            this.sceneManager.updateSetting('showFrustum', e.target.checked);
        });
        
        this.ui.showAxes.addEventListener('change', (e) => {
            this.sceneManager.updateSetting('showAxes', e.target.checked);
        });
        
        this.ui.showGrid.addEventListener('change', (e) => {
            this.sceneManager.updateSetting('showGrid', e.target.checked);
        });
        
        this.ui.showWorldAxes.addEventListener('change', (e) => {
            this.sceneManager.updateSetting('showWorldAxes', e.target.checked);
        });
        
        this.ui.colorByTime.addEventListener('change', (e) => {
            this.sceneManager.updateSetting('colorByTime', e.target.checked);
        });
        
        // Reset view button
        this.ui.resetViewBtn.addEventListener('click', () => {
            this.sceneManager.resetView();
        });
        
        // Settings panel fold/unfold
        this.ui.settingsToggle.addEventListener('click', () => {
            this.toggleSettingsPanel();
        });
        
        // Video export
        this.ui.exportWidth.addEventListener('input', () => {
            this.updatePreviewMask();
            this.updateExportDuration();
        });
        this.ui.exportHeight.addEventListener('input', () => {
            this.updatePreviewMask();
            this.updateExportDuration();
        });
        this.ui.exportFps.addEventListener('input', () => this.updateExportDuration());
        this.ui.exportHold.addEventListener('input', () => this.updateExportDuration());
        this.ui.exportPreview.addEventListener('change', () => this.updatePreviewMask());
        this.ui.exportBtn.addEventListener('click', () => this.handleExport());

        // Update preview mask on window resize
        window.addEventListener('resize', () => this.updatePreviewMask());

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.addOrUpdateTrajectory();
            }
        });
    }

    addOrUpdateTrajectory() {
        const input = this.ui.poseInput.value.trim();
        const inputFormat = this.ui.inputFormat.value;
        
        if (!input) {
            this.showStatus('Please enter pose data', 'warning');
            return;
        }
        
        // Parse the input for multiple trajectories
        const result = PoseParser.parseMultiple(input, inputFormat);
        
        if (!result.success) {
            const errorMsg = result.errors.length > 0 ? result.errors.join('; ') : 'Failed to parse input';
            this.showStatus(errorMsg, 'error');
            return;
        }

        if (this.editingTrajectoryId !== null) {
            this.updateExistingTrajectory(input, inputFormat, result);
            return;
        }

        const hadTrajectories = this.currentTrajectories.length > 0;
        const sourceBlocks = PoseParser.splitIntoBlocks(input);
        const addedTrajectories = result.trajectories.map((traj, index) => {
            const globalIndex = this.currentTrajectories.length + index;
            const explicitName = this.ui.trajectoryNameInput.value.trim();
            const defaultLocalName = `Trajectory ${index + 1}`;
            const parsedName = traj.name && traj.name !== defaultLocalName
                ? traj.name
                : `Trajectory ${globalIndex + 1}`;

            return {
                id: this.nextTrajectoryId++,
                name: explicitName && result.trajectories.length === 1 ? explicitName : parsedName,
                poses: traj.poses,
                count: traj.count,
                visible: true,
                color: this.sceneManager.getDefaultTrajectoryColor(globalIndex),
                source: sourceBlocks[index] || input,
                inputFormat
            };
        });

        this.currentTrajectories.push(...addedTrajectories);
        this.refreshTrajectories({ resetView: !hadTrajectories });

        const trajCount = addedTrajectories.length;
        const poseCount = result.totalCount;
        const message = trajCount > 1
            ? `Added ${trajCount} trajectories with ${poseCount} total poses`
            : `Added ${poseCount} poses`;
        this.showStatus(message, 'success');
        this.clearComposerInput({ hideStatus: false });
        this.collapseComposer();
    }

    visualize() {
        this.addOrUpdateTrajectory();
    }

    updateExistingTrajectory(input, inputFormat, result) {
        if (result.trajectories.length !== 1) {
            this.showStatus('Edit mode accepts one trajectory at a time', 'warning');
            return;
        }

        const index = this.currentTrajectories.findIndex(t => t.id === this.editingTrajectoryId);
        if (index === -1) {
            this.showStatus('Trajectory no longer exists', 'error');
            this.exitEditMode();
            return;
        }

        const existing = this.currentTrajectories[index];
        const parsed = result.trajectories[0];
        const explicitName = this.ui.trajectoryNameInput.value.trim();
        const parsedName = parsed.name && parsed.name !== 'Trajectory 1' ? parsed.name : existing.name;

        this.currentTrajectories[index] = {
            ...existing,
            name: explicitName || parsedName,
            poses: parsed.poses,
            count: parsed.count,
            source: input,
            inputFormat
        };

        this.refreshTrajectories({ resetView: false });
        this.showStatus(`Updated ${this.currentTrajectories[index].name}`, 'success');
        this.clearComposerInput({ hideStatus: false });
        this.exitEditMode({ clearInput: false, hideStatus: false });
        this.collapseComposer();
    }

    refreshTrajectories({ resetView = false } = {}) {
        const poseFormat = this.ui.poseFormat.value;
        const convention = this.ui.coordConvention.value;
        this.sceneManager.setTrajectories(this.currentTrajectories, poseFormat, convention, { resetView });
        this.updateInfoPanel();
        this.updateTrajectoryList();
    }

    onPoseSettingsChange() {
        if (this.currentTrajectories.length > 0) {
            const poseFormat = this.ui.poseFormat.value;
            const convention = this.ui.coordConvention.value;
            this.sceneManager.updateTrajectoriesKeepView(this.currentTrajectories, poseFormat, convention);
            this.updateInfoPanel();
            this.updateTrajectoryList();
        }
    }

    showStatus(message, type = 'info') {
        const statusEl = this.ui.parseStatus;
        statusEl.textContent = message;
        statusEl.classList.remove('is-hidden', 'is-success', 'is-danger', 'is-warning', 'is-info');
        
        switch (type) {
            case 'success':
                statusEl.classList.add('is-success');
                break;
            case 'error':
                statusEl.classList.add('is-danger');
                break;
            case 'warning':
                statusEl.classList.add('is-warning');
                break;
            default:
                statusEl.classList.add('is-info');
        }
        
        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                statusEl.classList.add('is-hidden');
            }, 3000);
        }
    }

    updateInfoPanel() {
        if (this.currentTrajectories.length === 0) {
            this.ui.poseInfo.innerHTML = '<p class="has-text-grey-light">No poses loaded</p>';
            this.ui.exportDuration.textContent = '';
            return;
        }
        
        const stats = this.sceneManager.getStats();
        
        let html = `
            <div class="tags has-addons mb-2">
                <span class="tag is-dark">Trajectories</span>
                <span class="tag is-info">${stats.trajectoryCount}</span>
            </div>
            <div class="tags has-addons mb-2">
                <span class="tag is-dark">Total Frames</span>
                <span class="tag is-primary">${stats.totalPoses}</span>
            </div>
            <div class="tags has-addons mb-2">
                <span class="tag is-dark">Displayed</span>
                <span class="tag is-success">${stats.displayedPoses}</span>
            </div>
        `;
        
        this.ui.poseInfo.innerHTML = html;
        this.updateExportDuration();
    }

    updateTrajectoryList() {
        if (!this.ui.trajectoryList) return;
        
        if (this.currentTrajectories.length === 0) {
            this.ui.trajectoryList.innerHTML = '<p class="has-text-grey is-size-7">No trajectories</p>';
            this.ui.clearTrajectoriesBtn.disabled = true;
            return;
        }

        this.ui.clearTrajectoriesBtn.disabled = false;
        
        let html = '';
        this.currentTrajectories.forEach((traj, index) => {
            const color = this.normalizeColor(traj.color, this.sceneManager.getDefaultTrajectoryColor(index));
            const checked = traj.visible ? 'checked' : '';
            const escapedName = this.escapeAttribute(traj.name);
            
            html += `
                <div class="trajectory-card" data-trajectory-id="${traj.id}">
                    <div class="trajectory-main-row">
                        <input type="checkbox" 
                               class="trajectory-checkbox" 
                               data-trajectory-id="${traj.id}" 
                               ${checked}>
                        <input type="color"
                               class="trajectory-color-input"
                               data-trajectory-id="${traj.id}"
                               value="${color}">
                        <input type="text"
                               class="trajectory-name-field"
                               data-trajectory-id="${traj.id}"
                               value="${escapedName}">
                        <div class="trajectory-actions">
                            <button class="button is-small is-light trajectory-focus-btn"
                                    data-trajectory-id="${traj.id}"
                                    title="Focus"
                                    aria-label="Focus trajectory">
                                <span class="icon is-small"><i class="fas fa-crosshairs"></i></span>
                            </button>
                            <button class="button is-small is-light trajectory-edit-btn"
                                    data-trajectory-id="${traj.id}"
                                    title="Edit"
                                    aria-label="Edit trajectory">
                                <span class="icon is-small"><i class="fas fa-pen"></i></span>
                            </button>
                            <button class="button is-small is-light trajectory-remove-btn"
                                    data-trajectory-id="${traj.id}"
                                    title="Remove"
                                    aria-label="Remove trajectory">
                                <span class="icon is-small"><i class="fas fa-trash"></i></span>
                            </button>
                        </div>
                    </div>
                    <div class="trajectory-meta">
                        <span>${traj.count} poses</span>
                        <span>${traj.visible ? 'visible' : 'hidden'}</span>
                    </div>
                </div>
            `;
        });
        
        this.ui.trajectoryList.innerHTML = html;
        
        this.ui.trajectoryList.querySelectorAll('.trajectory-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const trajId = parseInt(e.target.dataset.trajectoryId);
                const visible = e.target.checked;
                this.sceneManager.setTrajectoryVisibility(trajId, visible);
                
                const traj = this.currentTrajectories.find(t => t.id === trajId);
                if (traj) {
                    traj.visible = visible;
                }
                
                this.updateInfoPanel();
                this.updateTrajectoryList();
            });
        });

        this.ui.trajectoryList.querySelectorAll('.trajectory-color-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const trajId = parseInt(e.target.dataset.trajectoryId);
                const color = this.normalizeColor(e.target.value);
                const traj = this.currentTrajectories.find(t => t.id === trajId);
                if (!traj) return;

                traj.color = color;
                this.sceneManager.setTrajectoryColor(trajId, color);
            });
        });

        this.ui.trajectoryList.querySelectorAll('.trajectory-name-field').forEach(input => {
            input.addEventListener('change', (e) => {
                const trajId = parseInt(e.target.dataset.trajectoryId);
                const name = e.target.value.trim() || 'Untitled Trajectory';
                const traj = this.currentTrajectories.find(t => t.id === trajId);
                if (!traj) return;

                traj.name = name;
                this.sceneManager.setTrajectoryName(trajId, name);
                this.updateInfoPanel();
            });
        });

        this.ui.trajectoryList.querySelectorAll('.trajectory-focus-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const trajId = parseInt(e.currentTarget.dataset.trajectoryId);
                this.sceneManager.focusTrajectory(trajId);
            });
        });

        this.ui.trajectoryList.querySelectorAll('.trajectory-edit-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const trajId = parseInt(e.currentTarget.dataset.trajectoryId);
                this.startEditingTrajectory(trajId);
            });
        });

        this.ui.trajectoryList.querySelectorAll('.trajectory-remove-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const trajId = parseInt(e.currentTarget.dataset.trajectoryId);
                this.removeTrajectory(trajId);
            });
        });
    }

    startEditingTrajectory(trajectoryId) {
        const traj = this.currentTrajectories.find(t => t.id === trajectoryId);
        if (!traj) return;

        this.editingTrajectoryId = trajectoryId;
        this.ui.trajectoryNameInput.value = traj.name;
        this.ui.poseInput.value = traj.source || this.formatPosesCompact(traj.poses);
        if (traj.inputFormat) {
            this.ui.inputFormat.value = traj.inputFormat;
            this.ui.inputFormat.dispatchEvent(new Event('change'));
        }
        this.ui.addTrajBtn.innerHTML = '<span class="icon"><i class="fas fa-check"></i></span><span>Update Traj</span>';
        this.ui.cancelEditBtn.classList.remove('is-hidden');
        this.expandComposer();
    }

    removeTrajectory(trajectoryId) {
        const index = this.currentTrajectories.findIndex(t => t.id === trajectoryId);
        if (index === -1) return;

        const [removed] = this.currentTrajectories.splice(index, 1);
        if (this.editingTrajectoryId === trajectoryId) {
            this.exitEditMode();
        }
        this.refreshTrajectories({ resetView: false });
        this.showStatus(`Removed ${removed.name}`, 'success');
    }

    clearTrajectories() {
        if (this.currentTrajectories.length === 0) return;

        this.currentTrajectories = [];
        this.exitEditMode();
        this.refreshTrajectories({ resetView: false });
        this.showStatus('Cleared trajectories', 'success');
    }

    clearComposerInput({ hideStatus = true } = {}) {
        this.ui.poseInput.value = '';
        this.ui.trajectoryNameInput.value = '';
        if (hideStatus) {
            this.ui.parseStatus.classList.add('is-hidden');
        }
    }

    collapseComposer() {
        this.ui.trajectoryComposer.classList.add('is-hidden');
        this.ui.composerCollapsed.classList.remove('is-hidden');
    }

    expandComposer() {
        this.ui.trajectoryComposer.classList.remove('is-hidden');
        this.ui.composerCollapsed.classList.add('is-hidden');
        this.ui.poseInput.focus();
    }

    exitEditMode({ clearInput = true, hideStatus = true } = {}) {
        this.editingTrajectoryId = null;
        this.ui.addTrajBtn.innerHTML = '<span class="icon"><i class="fas fa-plus"></i></span><span>Add Traj</span>';
        this.ui.cancelEditBtn.classList.add('is-hidden');
        if (clearInput) {
            this.clearComposerInput({ hideStatus });
        }
    }

    normalizeColor(color, fallback = '#4285f4') {
        return /^#[0-9a-f]{6}$/i.test(color || '') ? color : fallback;
    }

    escapeAttribute(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /**
     * Format poses array with 4 numbers per line (one row per line)
     * This matches the placeholder example format
     */
    formatPosesCompact(poses) {
        const lines = ['['];
        poses.forEach((pose, poseIdx) => {
            lines.push('  [');
            pose.forEach((row, rowIdx) => {
                const rowStr = row.map(n => {
                    // Format numbers: 2 decimal places, trim trailing zeros
                    if (Number.isInteger(n)) return n.toString();
                    const str = n.toFixed(2).replace(/\.?0+$/, '');
                    return str === '-0' ? '0' : str;
                }).join(', ');
                const comma = rowIdx < 3 ? ',' : '';
                lines.push(`   [${rowStr}]${comma}`);
            });
            const poseComma = poseIdx < poses.length - 1 ? ',' : '';
            lines.push(`  ]${poseComma}`);
        });
        lines.push(']');
        return lines.join('\n');
    }

    loadSampleData() {
        // Generate two sample trajectories for demonstration
        const circlePoses = PoseParser.generateSample(24, 'circle');
        const helixPoses = PoseParser.generateSample(30, 'helix');
        
        const circleSource = this.formatPosesCompact(circlePoses);
        const helixSource = this.formatPosesCompact(helixPoses);
        this.ui.poseInput.value = '';
        
        // Auto-visualize the samples
        this.currentTrajectories = [
            {
                id: this.nextTrajectoryId++,
                name: 'Circle Path',
                poses: circlePoses,
                count: circlePoses.length,
                visible: true,
                color: this.sceneManager.getDefaultTrajectoryColor(0),
                source: circleSource,
                inputFormat: 'matrix'
            },
            {
                id: this.nextTrajectoryId++,
                name: 'Helix Path',
                poses: helixPoses,
                count: helixPoses.length,
                visible: true,
                color: this.sceneManager.getDefaultTrajectoryColor(1),
                source: helixSource,
                inputFormat: 'matrix'
            }
        ];
        
        this.sceneManager.setTrajectories(this.currentTrajectories, 'c2w', 'opengl');
        this.updateInfoPanel();
        this.updateTrajectoryList();
    }

    updatePreviewMask() {
        const mask = this.ui.exportPreviewMask;
        if (!this.ui.exportPreview.checked) {
            mask.classList.add('is-hidden');
            return;
        }

        const container = document.getElementById('viewport-container');
        const viewW = container.clientWidth;
        const viewH = container.clientHeight;
        const exportW = parseInt(this.ui.exportWidth.value) || 1920;
        const exportH = parseInt(this.ui.exportHeight.value) || 1080;
        const exportAspect = exportW / exportH;
        const viewAspect = viewW / viewH;

        let rectW, rectH;
        if (exportAspect > viewAspect) {
            rectW = viewW;
            rectH = viewW / exportAspect;
        } else {
            rectH = viewH;
            rectW = viewH * exportAspect;
        }

        const left = (viewW - rectW) / 2;
        const top = (viewH - rectH) / 2;

        mask.style.left = left + 'px';
        mask.style.top = top + 'px';
        mask.style.width = rectW + 'px';
        mask.style.height = rectH + 'px';
        mask.classList.remove('is-hidden');
    }

    updateExportDuration() {
        const fps = parseInt(this.ui.exportFps.value) || 30;
        const holdSeconds = parseFloat(this.ui.exportHold.value) || 0;
        const stats = this.sceneManager.getStats();
        let maxFrames = 0;
        if (stats.trajectories) {
            stats.trajectories.forEach(t => {
                if (t.visible) maxFrames = Math.max(maxFrames, t.displayed);
            });
        }
        if (maxFrames > 0) {
            const duration = (maxFrames / fps + holdSeconds).toFixed(1);
            const holdLabel = holdSeconds > 0 ? ` + ${holdSeconds}s hold` : '';
            this.ui.exportDuration.textContent = `~${duration}s (${maxFrames} frames${holdLabel})`;
        } else {
            this.ui.exportDuration.textContent = '';
        }
    }

    async handleExport() {
        if (this.sceneManager.isExporting) {
            this.sceneManager.cancelExport();
            return;
        }

        const width = parseInt(this.ui.exportWidth.value) || 1920;
        const height = parseInt(this.ui.exportHeight.value) || 1080;
        const fps = parseInt(this.ui.exportFps.value) || 30;
        const holdSeconds = parseFloat(this.ui.exportHold.value) || 0;
        const format = this.ui.exportFormat.value;

        // Update button to cancel state
        this.ui.exportBtn.innerHTML = '<span class="icon"><i class="fas fa-stop"></i></span><span>Cancel Export</span>';
        this.ui.exportBtn.classList.remove('is-primary');
        this.ui.exportBtn.classList.add('is-danger');
        this.ui.exportProgress.classList.remove('is-hidden');
        this.ui.exportStatus.classList.add('is-hidden');

        try {
            const blob = await this.sceneManager.exportVideo(width, height, fps, holdSeconds, format, (progress) => {
                const pct = Math.round(progress * 100);
                this.ui.exportProgressBar.value = pct;
                this.ui.exportProgressText.textContent = `Exporting... ${pct}%`;
            });

            if (blob) {
                const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `camera_poses_${width}x${height}_${fps}fps.${ext}`;
                a.click();
                URL.revokeObjectURL(url);
                this.showExportStatus('Video exported successfully!', 'success');
            } else {
                this.showExportStatus('Export cancelled', 'warning');
            }
        } catch (e) {
            this.showExportStatus(`Export failed: ${e.message}`, 'error');
        }

        // Restore button
        this.ui.exportBtn.innerHTML = '<span class="icon"><i class="fas fa-download"></i></span><span>Export Video</span>';
        this.ui.exportBtn.classList.remove('is-danger');
        this.ui.exportBtn.classList.add('is-primary');
        this.ui.exportProgress.classList.add('is-hidden');
    }

    showExportStatus(message, type) {
        const el = this.ui.exportStatus;
        el.textContent = message;
        el.classList.remove('is-hidden', 'is-success', 'is-danger', 'is-warning');
        el.classList.add(type === 'success' ? 'is-success' : type === 'error' ? 'is-danger' : 'is-warning');
        if (type === 'success') {
            setTimeout(() => el.classList.add('is-hidden'), 5000);
        }
    }

    toggleSettingsPanel() {
        const content = this.ui.settingsContent;
        const icon = this.ui.foldIcon;
        
        if (content.classList.contains('is-hidden')) {
            content.classList.remove('is-hidden');
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
        } else {
            content.classList.add('is-hidden');
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        }
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CameraPoseVisualizer();
});
