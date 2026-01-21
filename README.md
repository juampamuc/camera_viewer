# Camera Pose Visualizer

A web-based tool to visualize camera pose sequences in 3D. Perfect for inspecting camera trajectories from SLAM, NeRF, 3D Gaussian Splatting, or any computer vision pipeline.

🔗 **[Live Demo](https://YOUR_USERNAME.github.io/pose_visualizer/)**

![Camera Pose Visualizer Screenshot](https://via.placeholder.com/800x450?text=Camera+Pose+Visualizer)

## Features

- 📷 **Visualize camera frustums** in 3D with customizable size and FOV
- 🎨 **Color by time** - gradient coloring shows temporal order of poses
- 📊 **Multiple trajectories** - compare different camera paths side by side
- 🏷️ **Named trajectories** - label each trajectory with `# Name` comments
- 🔄 **Format conversion** - supports both Camera-to-World (c2w) and World-to-Camera (w2c) matrices
- 🎯 **Convention support** - handles OpenGL (Y-up) and OpenCV (Y-down) coordinate systems
- 👁️ **Visibility controls** - show/hide individual trajectories
- 🖱️ **Free camera rotation** - TrackballControls for viewing from any angle
- ⚡ **No backend required** - runs entirely in the browser

## Usage

### Input Format

Paste one or more camera pose arrays in Python-like list format. Each array should have shape `[T, 4, 4]` where T is the number of frames.

#### Single Trajectory
```python
[
  [[1, 0, 0, 0],
   [0, 1, 0, 0],
   [0, 0, 1, 0],
   [0, 0, 0, 1]],
  [[1, 0, 0, 0.5],
   [0, 1, 0, 0],
   [0, 0, 1, 0],
   [0, 0, 0, 1]],
  ...
]
```

#### Multiple Trajectories

Separate trajectories with blank lines. Optionally name them with `# Name`:

```python
# Ground Truth
[
  [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]],
  ...
]

# Predicted
[
  [[1, 0, 0, 0.1], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]],
  ...
]
```

### Pose Settings

| Setting | Description |
|---------|-------------|
| **Pose Format** | `c2w` (Camera-to-World) or `w2c` (World-to-Camera/Extrinsic) |
| **Coordinate Convention** | `OpenGL` (Y-up, -Z forward) or `OpenCV` (Y-down, Z forward) |

### Display Settings

| Setting | Description |
|---------|-------------|
| **Every N frames** | Skip frames to reduce visual clutter |
| **Frustum Size** | Size of camera frustum visualization |
| **FOV** | Field of view for frustum shape |
| **White Background** | Toggle between light/dark theme |
| **Show Camera Axes** | Display RGB axes (X=red, Y=green, Z=blue) |
| **Show Grid** | Display ground plane grid |
| **Show World Axes** | Display world coordinate axes at origin |
| **Color by Time** | Gradient coloring based on frame index |

### Controls

- **Left Mouse**: Rotate view
- **Middle Mouse / Scroll**: Zoom
- **Right Mouse**: Pan
- **Ctrl+Enter**: Visualize (keyboard shortcut)

## Coordinate Conventions

### OpenGL Convention (default)
- X: Right
- Y: Up
- Z: Backward (camera looks down -Z)

### OpenCV Convention
- X: Right
- Y: Down
- Z: Forward (camera looks down +Z)

The visualizer shows the **original** axis directions from your input matrix, making it easy to verify your data is correct.

## Hosting on GitHub Pages

1. Fork or clone this repository

2. Push to your GitHub account:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/pose_visualizer.git
   git push -u origin main
   ```

3. Enable GitHub Pages:
   - Go to repository **Settings** → **Pages**
   - Under "Source", select **Deploy from a branch**
   - Choose `main` branch and `/ (root)` folder
   - Click **Save**

4. Your site will be available at:
   ```
   https://YOUR_USERNAME.github.io/pose_visualizer/
   ```

## Local Development

Simply serve the files with any static server:

```bash
# Python
python -m http.server 8080

# Node.js
npx serve

# Then open http://localhost:8080
```

## Project Structure

```
pose_visualizer/
├── index.html          # Main HTML file
├── css/
│   └── style.css       # Styles (light theme)
├── js/
│   ├── main.js         # Application entry point
│   ├── poseParser.js   # Parses Python-like arrays
│   ├── poseConverter.js # c2w/w2c and OpenGL/OpenCV conversion
│   └── sceneManager.js # Three.js scene management
└── README.md
```

## Dependencies

All dependencies are loaded via CDN (no installation required):

- [Three.js](https://threejs.org/) - 3D rendering
- [Bulma](https://bulma.io/) - CSS framework
- [Font Awesome](https://fontawesome.com/) - Icons

## License

MIT License - feel free to use and modify for your projects.

## Contributing

Issues and pull requests are welcome! Some ideas for improvements:

- [ ] Export camera path as video animation
- [ ] Load poses from JSON/NPY files
- [ ] Add point cloud visualization
- [ ] Camera path interpolation/smoothing
- [ ] Measure distances between cameras

