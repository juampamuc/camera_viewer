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
            visualizeBtn: document.getElementById('visualize-btn'),
            parseStatus: document.getElementById('parse-status'),
            poseFormat: document.getElementById('pose-format'),
            coordConvention: document.getElementById('coord-convention'),
            poseInfo: document.getElementById('pose-info'),
            
            // Display settings
            frameStep: document.getElementById('frame-step'),
            frustumSize: document.getElementById('frustum-size'),
            cameraFov: document.getElementById('camera-fov'),
            whiteBackground: document.getElementById('white-background'),
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
            
            // Canvas
            canvas: document.getElementById('three-canvas')
        };
        
        // Scene manager
        this.sceneManager = null;
        
        // Current trajectories data
        this.currentTrajectories = [];
        
        this.init();
    }

    init() {
        // Initialize Three.js scene
        this.sceneManager = new SceneManager(this.ui.canvas);
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load sample data for demonstration
        this.loadSampleData();
    }

    setupEventListeners() {
        // Visualize button
        this.ui.visualizeBtn.addEventListener('click', () => this.visualize());
        
        // Pose settings changes
        this.ui.poseFormat.addEventListener('change', () => this.onPoseSettingsChange());
        this.ui.coordConvention.addEventListener('change', () => this.onPoseSettingsChange());
        
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
        
        this.ui.whiteBackground.addEventListener('change', (e) => {
            this.sceneManager.updateSetting('whiteBackground', e.target.checked);
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
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+Enter to visualize
            if (e.ctrlKey && e.key === 'Enter') {
                this.visualize();
            }
        });
    }

    visualize() {
        const input = this.ui.poseInput.value.trim();
        
        if (!input) {
            this.showStatus('Please enter pose data', 'warning');
            return;
        }
        
        // Parse the input for multiple trajectories
        const result = PoseParser.parseMultiple(input);
        
        if (!result.success) {
            const errorMsg = result.errors.length > 0 ? result.errors.join('; ') : 'Failed to parse input';
            this.showStatus(errorMsg, 'error');
            return;
        }
        
        this.currentTrajectories = result.trajectories;
        
        // Get pose settings
        const poseFormat = this.ui.poseFormat.value;
        const convention = this.ui.coordConvention.value;
        
        // Update scene with all trajectories
        this.sceneManager.setTrajectories(this.currentTrajectories, poseFormat, convention);
        
        // Show success message
        const trajCount = result.trajectories.length;
        const poseCount = result.totalCount;
        const message = trajCount > 1 
            ? `Loaded ${trajCount} trajectories with ${poseCount} total poses`
            : `Loaded ${poseCount} poses`;
        this.showStatus(message, 'success');
        
        // Update info panel and trajectory list
        this.updateInfoPanel();
        this.updateTrajectoryList();
    }

    onPoseSettingsChange() {
        if (this.currentTrajectories.length > 0) {
            const poseFormat = this.ui.poseFormat.value;
            const convention = this.ui.coordConvention.value;
            this.sceneManager.updateTrajectoriesKeepView(this.currentTrajectories, poseFormat, convention);
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
    }

    updateTrajectoryList() {
        if (!this.ui.trajectoryList) return;
        
        if (this.currentTrajectories.length === 0) {
            this.ui.trajectoryList.innerHTML = '<p class="has-text-grey is-size-7">No trajectories</p>';
            return;
        }
        
        let html = '';
        this.currentTrajectories.forEach((traj, index) => {
            const color = this.sceneManager.getTrajectoryColor(index);
            const checked = traj.visible ? 'checked' : '';
            
            html += `
                <div class="trajectory-item field mb-1">
                    <label class="checkbox is-size-7">
                        <input type="checkbox" 
                               class="trajectory-checkbox" 
                               data-trajectory-id="${traj.id}" 
                               ${checked}>
                        <span class="trajectory-color" style="background-color: ${color}"></span>
                        <span class="trajectory-name">${traj.name}</span>
                        <span class="trajectory-count">(${traj.count})</span>
                    </label>
                </div>
            `;
        });
        
        this.ui.trajectoryList.innerHTML = html;
        
        // Add event listeners to the new checkboxes
        const checkboxes = this.ui.trajectoryList.querySelectorAll('.trajectory-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const trajId = parseInt(e.target.dataset.trajectoryId);
                const visible = e.target.checked;
                this.sceneManager.setTrajectoryVisibility(trajId, visible);
                
                // Update the trajectory data
                const traj = this.currentTrajectories.find(t => t.id === trajId);
                if (traj) {
                    traj.visible = visible;
                }
                
                this.updateInfoPanel();
            });
        });
    }

    loadSampleData() {
        // Generate two sample trajectories for demonstration
        const circlePoses = PoseParser.generateSample(24, 'circle');
        const helixPoses = PoseParser.generateSample(30, 'helix');
        
        // Format as two separate blocks with names
        const sampleText = '# Circle Path\n' +
                          JSON.stringify(circlePoses, null, 2) + 
                          '\n\n# Helix Path\n' + 
                          JSON.stringify(helixPoses, null, 2);
        
        this.ui.poseInput.value = sampleText;
        
        // Auto-visualize the samples
        this.currentTrajectories = [
            { id: 0, name: 'Circle Path', poses: circlePoses, count: circlePoses.length, visible: true },
            { id: 1, name: 'Helix Path', poses: helixPoses, count: helixPoses.length, visible: true }
        ];
        
        this.sceneManager.setTrajectories(this.currentTrajectories, 'c2w', 'opengl');
        this.updateInfoPanel();
        this.updateTrajectoryList();
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
