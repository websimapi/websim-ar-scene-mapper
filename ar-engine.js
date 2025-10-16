import * as tf from 'tf';
import * as cocoSsd from 'tfcoco';
import { SceneManager } from './scene-manager.js';
import { ObjectDetector } from './object-detector.js';
import { UIManager } from './ui-manager.js';

class AREngine {
    constructor() {
        this.video = document.getElementById('videoStream');
        this.canvas = document.getElementById('canvasOverlay');
        this.ctx = this.canvas.getContext('2d');
        
        this.sceneManager = new SceneManager();
        this.objectDetector = null;
        this.uiManager = new UIManager();
        
        this.isDetecting = true;
        this.isMapping = true;
        this.detectedObjects = [];
        this.frameCount = 0;
        this.lastFpsTime = Date.now();
        this.fps = 0;
        
        this.floorLevel = null;
        this.wallPlanes = [];
        this.sceneMap = new Map();
        
        this.init();
    }

    async init() {
        try {
            this.setupCanvasDimensions();
            await this.requestCameraPermissions();
            await this.startCamera();
            await this.loadModels();
            this.setupControls();
            this.startARLoop();
        } catch (error) {
            console.error('AR Engine initialization failed:', error);
            alert('Failed to initialize AR: ' + error.message);
        }
    }

    setupCanvasDimensions() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        });
    }

    async requestCameraPermissions() {
        try {
            await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
        } catch (error) {
            throw new Error('Camera permission denied');
        }
    }

    async startCamera() {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });
        this.video.srcObject = stream;
        return new Promise(resolve => {
            this.video.onloadedmetadata = () => {
                this.video.play();
                resolve();
            };
        });
    }

    async loadModels() {
        document.getElementById('loadingSpinner').style.display = 'block';
        try {
            this.objectDetector = new ObjectDetector();
            await this.objectDetector.loadModel();
            document.getElementById('loadingSpinner').style.display = 'none';
        } catch (error) {
            console.error('Failed to load models:', error);
            throw error;
        }
    }

    setupControls() {
        document.getElementById('toggleDetection').addEventListener('click', () => {
            this.isDetecting = !this.isDetecting;
            document.getElementById('toggleDetection').textContent = 
                `Detection: ${this.isDetecting ? 'ON' : 'OFF'}`;
        });

        document.getElementById('toggleMapping').addEventListener('click', () => {
            this.isMapping = !this.isMapping;
            document.getElementById('toggleMapping').textContent = 
                `Mapping: ${this.isMapping ? 'ON' : 'OFF'}`;
        });

        document.getElementById('captureScene').addEventListener('click', () => {
            this.captureScene();
        });

        document.getElementById('clearScene').addEventListener('click', () => {
            this.clearScene();
        });
    }

    async startARLoop() {
        const loop = async () => {
            await this.update();
            this.render();
            requestAnimationFrame(loop);
        };
        loop();
    }

    async update() {
        if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
            if (this.isDetecting) {
                this.detectedObjects = await this.objectDetector.detect(this.video);
                this.updateSceneMap();
            }

            if (this.isMapping) {
                this.analyzeScene();
            }

            this.updateStats();
        }
    }

    updateSceneMap() {
        this.detectedObjects.forEach(obj => {
            const key = `${obj.class}-${Math.floor(obj.bbox[0] / 10)}-${Math.floor(obj.bbox[1] / 10)}`;
            if (!this.sceneMap.has(key)) {
                this.sceneMap.set(key, {
                    class: obj.class,
                    positions: [],
                    confidence: 0
                });
            }
            const entry = this.sceneMap.get(key);
            entry.positions.push(obj.bbox);
            entry.confidence = obj.score;
        });
    }

    analyzeScene() {
        // Basic floor detection (bottom third of frame)
        const bottomThird = this.canvas.height * 0.67;
        const floorObjects = this.detectedObjects.filter(obj => obj.bbox[1] > bottomThird);
        this.floorLevel = floorObjects.length > 0 ? bottomThird : null;

        // Wall detection (edges of frame)
        const frameWidth = this.canvas.width;
        const frameHeight = this.canvas.height;
        
        const leftWall = this.detectedObjects.filter(obj => obj.bbox[0] < frameWidth * 0.1);
        const rightWall = this.detectedObjects.filter(obj => obj.bbox[0] + obj.bbox[2] > frameWidth * 0.9);
        
        this.wallPlanes = [
            ...(leftWall.length > 0 ? ['left'] : []),
            ...(rightWall.length > 0 ? ['right'] : [])
        ];
    }

    updateStats() {
        this.frameCount++;
        const now = Date.now();
        if (now - this.lastFpsTime > 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsTime = now;
        }

        const avgConfidence = this.detectedObjects.length > 0
            ? (this.detectedObjects.reduce((sum, obj) => sum + obj.score, 0) / this.detectedObjects.length * 100).toFixed(1)
            : 0;

        this.uiManager.updateStats({
            fps: this.fps,
            objectCount: this.detectedObjects.length,
            avgConfidence: avgConfidence,
            floorDetected: this.floorLevel !== null,
            sceneStatus: `${this.sceneMap.size} zones`
        });

        this.uiManager.updateDetectionList(this.detectedObjects);
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw detected objects
        this.detectedObjects.forEach((obj, index) => {
            this.drawBoundingBox(obj);
            this.drawLabel(obj);
        });

        // Draw floor indicator
        if (this.floorLevel !== null) {
            this.drawFloorLine();
        }

        // Draw wall indicators
        this.drawWallIndicators();

        // Draw scene heatmap
        this.drawSceneHeatmap();
    }

    drawBoundingBox(obj) {
        const [x, y, width, height] = obj.bbox;
        const confidence = (obj.score * 100).toFixed(1);
        
        // Box outline
        this.ctx.strokeStyle = `hsl(${confidence * 1.2}, 100%, 50%)`;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, width, height);

        // Corners
        this.ctx.fillStyle = this.ctx.strokeStyle;
        const cornerSize = 8;
        const corners = [
            [x, y], [x + width, y], [x, y + height], [x + width, y + height]
        ];
        corners.forEach(([cx, cy]) => {
            this.ctx.fillRect(cx - cornerSize / 2, cy - cornerSize / 2, cornerSize, cornerSize);
        });
    }

    drawLabel(obj) {
        const [x, y, width, height] = obj.bbox;
        const label = `${obj.class} ${(obj.score * 100).toFixed(0)}%`;
        
        this.ctx.font = 'bold 12px Arial';
        this.ctx.fillStyle = '#0f0';
        this.ctx.shadowColor = '#000';
        this.ctx.shadowBlur = 4;
        this.ctx.shadowOffsetX = 2;
        this.ctx.shadowOffsetY = 2;
        
        const metrics = this.ctx.measureText(label);
        const textX = x + width / 2 - metrics.width / 2;
        const textY = y - 10;
        
        this.ctx.fillText(label, textX, textY);
    }

    drawFloorLine() {
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([10, 10]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.floorLevel);
        this.ctx.lineTo(this.canvas.width, this.floorLevel);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        this.ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
        this.ctx.fillRect(0, this.floorLevel, this.canvas.width, this.canvas.height - this.floorLevel);
    }

    drawWallIndicators() {
        const margin = 20;
        this.ctx.font = 'bold 14px Arial';
        this.ctx.fillStyle = '#0f0';

        if (this.wallPlanes.includes('left')) {
            this.ctx.fillText('WALL', margin, this.canvas.height / 2);
        }
        if (this.wallPlanes.includes('right')) {
            this.ctx.fillText('WALL', this.canvas.width - 80, this.canvas.height / 2);
        }
    }

    drawSceneHeatmap() {
        if (this.sceneMap.size === 0) return;

        const gridSize = 80;
        const intensity = Math.min(this.sceneMap.size / 10, 1);

        this.sceneMap.forEach((entry, key) => {
            if (entry.positions.length > 0) {
                const lastPos = entry.positions[entry.positions.length - 1];
                const [x, y, w, h] = lastPos;
                
                this.ctx.fillStyle = `rgba(0, 255, 0, ${intensity * 0.1})`;
                this.ctx.fillRect(x, y, w, h);
            }
        });
    }

    captureScene() {
        console.log('Scene captured:', {
            objects: this.detectedObjects.length,
            zones: this.sceneMap.size,
            floorDetected: this.floorLevel !== null,
            walls: this.wallPlanes
        });
        this.uiManager.showNotification('Scene captured!');
    }

    clearScene() {
        this.sceneMap.clear();
        this.detectedObjects = [];
        this.floorLevel = null;
        this.wallPlanes = [];
        this.uiManager.showNotification('Scene cleared!');
    }
}

// Initialize AR Engine on page load
window.addEventListener('load', () => {
    new AREngine();
});

