import * as tf from 'tf';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

export class ObjectDetector {
    constructor() {
        this.model = null;
        this.minConfidence = 0.4;
    }

    async loadModel() {
        try {
            console.log('Loading COCO-SSD model...');
            this.model = await cocoSsd.load();
            console.log('COCO-SSD model loaded successfully');
        } catch (error) {
            console.error('Failed to load COCO-SSD model:', error);
            throw new Error('Failed to load object detection model: ' + error.message);
        }
    }

    async detect(videoElement) {
        if (!this.model) {
            console.warn('Model not loaded, skipping detection');
            return [];
        }

        try {
            const predictions = await this.model.estimateObjects(videoElement, this.minConfidence);
            
            return predictions.map(pred => ({
                class: pred.class,
                score: pred.score,
                bbox: [
                    pred.bbox[0],
                    pred.bbox[1],
                    pred.bbox[2],
                    pred.bbox[3]
                ]
            }));
        } catch (error) {
            console.error('Detection error:', error);
            return [];
        }
    }

    setMinConfidence(confidence) {
        this.minConfidence = Math.max(0, Math.min(1, confidence));
    }

    dispose() {
        if (this.model) {
            this.model.dispose();
        }
    }
}