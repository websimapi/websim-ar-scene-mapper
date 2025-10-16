export class SceneManager {
    constructor() {
        this.sceneGraph = {
            root: null,
            objects: [],
            planes: {
                floor: null,
                walls: [],
                ceiling: null
            }
        };
        
        this.cameraMatrix = new Float32Array(16);
        this.setupIdentityMatrix();
        
        this.spatialIndex = new Map();
        this.gridSize = 100;
    }

    setupIdentityMatrix() {
        this.cameraMatrix[0] = 1;
        this.cameraMatrix[5] = 1;
        this.cameraMatrix[10] = 1;
        this.cameraMatrix[15] = 1;
    }

    addObject(objectData) {
        const sceneObject = {
            id: Date.now(),
            type: objectData.class,
            bbox: objectData.bbox,
            confidence: objectData.score,
            timestamp: Date.now(),
            position: this.bboxToWorldPosition(objectData.bbox)
        };

        this.sceneGraph.objects.push(sceneObject);
        this.spatialIndex.set(sceneObject.id, sceneObject);

        return sceneObject;
    }

    bboxToWorldPosition(bbox) {
        const [x, y, w, h] = bbox;
        return {
            x: x + w / 2,
            y: y + h / 2,
            depth: Math.random() * 100 + 50
        };
    }

    detectPlane(objects, frameHeight) {
        const bottomThird = frameHeight * 0.67;
        const floorCandidates = objects.filter(obj => obj.bbox[1] > bottomThird);

        if (floorCandidates.length > 0) {
            this.sceneGraph.planes.floor = {
                normal: [0, -1, 0],
                distance: frameHeight - bottomThird,
                confidence: floorCandidates.length / objects.length
            };
            return true;
        }
        return false;
    }

    queryRegion(x, y, width, height) {
        const results = [];
        this.sceneGraph.objects.forEach(obj => {
            const [ox, oy, ow, oh] = obj.bbox;
            if (this.bboxesIntersect(x, y, width, height, ox, oy, ow, oh)) {
                results.push(obj);
            }
        });
        return results;
    }

    bboxesIntersect(x1, y1, w1, h1, x2, y2, w2, h2) {
        return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
    }

    clear() {
        this.sceneGraph.objects = [];
        this.spatialIndex.clear();
        this.sceneGraph.planes = {
            floor: null,
            walls: [],
            ceiling: null
        };
    }
}

