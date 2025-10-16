export class UIManager {
    constructor() {
        this.objectsList = document.getElementById('objectsList');
        this.notificationTimeout = null;
    }

    updateStats(stats) {
        document.getElementById('fps').textContent = stats.fps;
        document.getElementById('objectCount').textContent = stats.objectCount;
        document.getElementById('avgConfidence').textContent = stats.avgConfidence + '%';
        document.getElementById('floorStatus').textContent = stats.floorDetected ? 'Yes' : 'No';
        document.getElementById('sceneStatus').textContent = stats.sceneStatus;
    }

    updateDetectionList(objects) {
        this.objectsList.innerHTML = '';

        const objectCounts = {};
        objects.forEach(obj => {
            objectCounts[obj.class] = (objectCounts[obj.class] || 0) + 1;
        });

        Object.entries(objectCounts).forEach(([className, count]) => {
            const div = document.createElement('div');
            div.className = 'detected-object';
            const confidence = objects
                .filter(o => o.class === className)
                .reduce((sum, o) => sum + o.score, 0) / count;
            div.innerHTML = `<strong>${className}</strong> ×${count} (${(confidence * 100).toFixed(0)}%)`;
            this.objectsList.appendChild(div);
        });
    }

    showNotification(message) {
        const notif = document.createElement('div');
        notif.style.cssText = `
            position: fixed;
            bottom: 250px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 255, 0, 0.9);
            color: #000;
            padding: 15px 25px;
            border-radius: 4px;
            font-weight: bold;
            z-index: 1000;
        `;
        notif.textContent = message;
        document.body.appendChild(notif);

        if (this.notificationTimeout) {
            clearTimeout(this.notificationTimeout);
        }

        this.notificationTimeout = setTimeout(() => {
            notif.remove();
        }, 2000);
    }
}

