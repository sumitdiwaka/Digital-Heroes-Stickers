// Real three.js, but with a fake WebGLRenderer (no GPU in CI) so the scene code can be executed and inspected.
export * from '../node_modules/three/build/three.module.js';
export const __renders = [];
export const __state = { loop: null, disposed: false };
export class WebGLRenderer {
  constructor() { this.domElement = document.createElement('canvas'); this.capabilities = { getMaxAnisotropy: () => 4 }; }
  setPixelRatio() {} setSize(w, h) { this.w = w; this.h = h; }
  render(scene, camera) { __renders.push({ scene, camera }); }
  setAnimationLoop(fn) { __state.loop = fn; }
  dispose() { __state.disposed = true; } forceContextLoss() {}
}
