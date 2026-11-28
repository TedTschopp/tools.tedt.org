import { assetUrl, portable } from "./assets.js";

// Keep one worker patch in flight and only the latest request behind it.
export class TerrainRaster {
  constructor(civ) {
    this.civ = civ;
    this.available = typeof Worker === "function" && typeof OffscreenCanvas === "function" &&
      typeof OffscreenCanvas.prototype.transferToImageBitmap === "function";
  }
  start() {
    if (this.worker || !this.available) return;
    try {
      const url = portable ? assetUrl("js/terrain-painter.js") :
        (import.meta.resolve?.("./terrain-painter.js") ?? new URL("./terrain-painter.js", import.meta.url));
      this.worker = new Worker(url, { name: "Edison terrain painter" });
      this.worker.onerror = this.worker.onmessageerror = () => this.fallback();
      this.worker.onmessage = ({ data }) => {
        clearTimeout(this.deadline);
        const finished = this.active;
        this.active = null;
        if (finished) finished.resolve(data);
        else data.close();
        this.dispatch();
      };
      this.worker.postMessage(this.civ.terrainData());
    } catch {
      this.fallback();
    }
  }
  paint(view, indices, places, water) {
    if (!this.worker) return null;
    const cells = indices.map(i => this.civ.indices[i]);
    return new Promise(resolve => {
      this.waiting?.resolve(null);
      this.waiting = { message: { view, cells, places, water }, resolve };
      this.dispatch();
    });
  }
  dispatch() {
    if (this.active || !this.waiting) return;
    this.active = this.waiting;
    this.waiting = null;
    try {
      this.worker.postMessage(this.active.message);
      this.deadline = setTimeout(() => this.fallback(), 4000);
    } catch {
      this.fallback();
    }
  }
  fallback() {
    this.available = false;
    this.stop();
  }
  stop() {
    clearTimeout(this.deadline);
    if (this.worker) {
      this.worker.onmessage = this.worker.onerror = this.worker.onmessageerror = null;
      this.worker.terminate();
    }
    this.worker = null;
    this.active?.resolve(null);
    this.waiting?.resolve(null);
    this.active = this.waiting = null;
  }
}
