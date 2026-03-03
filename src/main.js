import { initPortraitScene } from './webgl/portraitScene.js';

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('canvas');
  if (canvas instanceof HTMLCanvasElement) {
    initPortraitScene(canvas);
  }
});

