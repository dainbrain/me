import {
  Scene,
  OrthographicCamera,
  WebGLRenderer,
  Vector2,
  Raycaster,
  MathUtils,
  BufferGeometry,
  Float32BufferAttribute,
  ShaderMaterial,
  Points,
} from 'three';

export function initPortraitScene(canvas) {
  const scene = new Scene();

  const camera = new OrthographicCamera(-500, 500, 500, -500, 0.1, 1000);
  camera.position.set(0, 0, 500);
  camera.lookAt(0, 0, 0);

  const renderer = new WebGLRenderer({ canvas, alpha: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.setClearColor(0x000000, 0);

  // For zooming in to the point cloud.
  let targetWidth = 0;
  let targetHeight = 0;
  const marginFactor = 1.1;

  function updateCameraFrustum() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (targetWidth && targetHeight) {
      const canvasAspect = width / height;
      const imageAspect = targetWidth / targetHeight;
      let camLeft, camRight, camTop, camBottom;
      if (canvasAspect >= imageAspect) {
        const camHeight = targetHeight * marginFactor;
        const camWidth = camHeight * canvasAspect;
        camTop = camHeight / 2;
        camBottom = -camHeight / 2;
        camLeft = -camWidth / 2;
        camRight = camWidth / 2;
      } else {
        const camWidth = targetWidth * marginFactor;
        const camHeight = camWidth / canvasAspect;
        camLeft = -camWidth / 2;
        camRight = camWidth / 2;
        camTop = camHeight / 2;
        camBottom = -camHeight / 2;
      }
      camera.left = camLeft;
      camera.right = camRight;
      camera.top = camTop;
      camera.bottom = camBottom;
      camera.updateProjectionMatrix();
    }
    renderer.setSize(width, height, false);
    updatePointScale(); // Update point scale based on canvas width.
  }

  window.addEventListener('resize', updateCameraFrustum);

  // Track mouse/touch position (used for raycasting and bulge effect)
  const mouse = new Vector2();
  let hasPointerPosition = false;
  const raycaster = new Raycaster();
  raycaster.params.Points = { threshold: 10 };

  // Track if the mouse is over the canvas (for desktop hover effects).
  let mouseIsOver = false;

  // Update mouse vector for mouse events.
  window.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    hasPointerPosition = true;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    lastPointerMoveTime = now;
  });

  canvas.addEventListener('mouseenter', (event) => {
    mouseIsOver = true;
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    hasPointerPosition = true;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    lastPointerMoveTime = now;
  });
  canvas.addEventListener('mouseleave', () => {
    mouseIsOver = false;
  });

  // Also update mouse vector for touch events.
  canvas.addEventListener('touchstart', (event) => {
    mouseIsOver = true;
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches[0];
    mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
    hasPointerPosition = true;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    lastPointerMoveTime = now;
  });

  canvas.addEventListener('touchmove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches[0];
    mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
    hasPointerPosition = true;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    lastPointerMoveTime = now;
  });

  canvas.addEventListener('touchend', () => {
    mouseIsOver = false;
  });

  // Use a userAgent check to detect mobile.
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );

  // Device orientation variables.
  let useDeviceOrientation = false;
  let deviceRotationX = 0;
  let deviceRotationY = 0;

  // Helper: Map a value from one range to another.
  function mapRange(value, inMin, inMax, outMin, outMax) {
    return outMin + ((value - inMin) * (outMax - outMin)) / (inMax - inMin);
  }

  // For mobile devices, map device orientation to rotation.
  if (isMobile && window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', (event) => {
      const maxAngle = MathUtils.degToRad(20);
      const beta = event.beta || 0; // front-back tilt
      const gamma = event.gamma || 0; // left-right tilt
      const mappedBeta = mapRange(beta, 60, 120, -maxAngle, maxAngle);
      const mappedGamma = mapRange(gamma, -30, 30, -maxAngle, maxAngle);
      const offset = MathUtils.degToRad(15);
      deviceRotationX = MathUtils.clamp(
        mappedBeta + offset,
        -maxAngle,
        maxAngle,
      );
      deviceRotationY = MathUtils.clamp(
        mappedGamma + offset,
        -maxAngle,
        maxAngle,
      );
      useDeviceOrientation = true;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      lastDeviceMotionTime = now;
    });
  }

  // For point scaling based on canvas width.
  function computePointSize(width) {
    const minWidth = 363;
    const maxWidth = 1152;
    const minSize = 2.8;
    const maxSize = 5;
    if (width <= minWidth) return minSize;
    if (width >= maxWidth) return maxSize;
    return minSize + ((width - minWidth) * (maxSize - minSize)) / (maxWidth - minWidth);
  }

  let points;
  let hasGeometry = false;
  let introStartPositions;
  let introStartTime = 0;
  let introProgress = 1;

  // Track page visibility and recent interaction to reduce idle work.
  let isPageVisible = typeof document === 'undefined' ? true : !document.hidden;
  let lastPointerMoveTime = 0;
  let lastDeviceMotionTime = 0;
  const ACTIVE_TIMEOUT_MS = 5000;

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      isPageVisible = !document.hidden;
    });
  }

  function updatePointScale() {
    if (points && points.material.uniforms && points.material.uniforms.pointScale) {
      points.material.uniforms.pointScale.value = computePointSize(canvas.clientWidth);
    }
  }

  // Load images.
  const img = new Image();
  img.src = '/me-nobg.png';

  const depthImg = new Image();
  depthImg.src = '/me-nobg-depthmap.jpg';

  let imagesLoaded = 0;

  function onImageLoad() {
    imagesLoaded += 1;
    if (imagesLoaded === 2) {
      processImages();
    }
  }

  img.onload = onImageLoad;
  depthImg.onload = onImageLoad;

  let geometry;
  let originalPositions;
  let activations;
  let driftOffsets;
  let driftVelocities;
  let edgeFactors;
  let randomStates;
  const BASE_PARTICLE_SIZE = 1;
  const MAX_RADIUS = 70;
  const DECAY = 0.92;
  const MAX_SIZE_MULTIPLIER = 1.8;
  const BROWNIAN_ACCEL = 0.018;
  const BROWNIAN_VELOCITY_DAMP = 0.9;
  const BROWNIAN_OFFSET_DAMP = 0.985;
  const BROWNIAN_MAX_OFFSET = 2.5;
  const BROWNIAN_Z_DAMPING = 0.6;
  const EDGE_TURBULENCE_GAIN = 10.0;
  const EDGE_TURBULENCE_CLAMP_GAIN = 50.0;
  const EDGE_TURBULENCE_START = 0.25;
  const EDGE_TURBULENCE_FULL = 1.0;
  const EDGE_TURBULENCE_CURVE = 1.0;
  const EDGE_DISTANCE_FALLOFF_CELLS = 8;
  const INTRO_DURATION_MS = 800;
  const INTRO_SCATTER_XY = 0.35;
  const INTRO_SCATTER_Z = 0.5;

  function processImages() {
    const imgCanvas = document.createElement('canvas');
    imgCanvas.width = img.width;
    imgCanvas.height = img.height;
    const imgCtx = imgCanvas.getContext('2d');
    imgCtx.drawImage(img, 0, 0);
    const imgData = imgCtx.getImageData(0, 0, img.width, img.height).data;

    const depthCanvas = document.createElement('canvas');
    depthCanvas.width = depthImg.width;
    depthCanvas.height = depthImg.height;
    const depthCtx = depthCanvas.getContext('2d');
    depthCtx.drawImage(depthImg, 0, 0);
    const depthData = depthCtx.getImageData(0, 0, depthImg.width, depthImg.height).data;

    geometry = new BufferGeometry();
    const positions = [];
    const colors = [];
    const sizes = [];
    const step = 3;
    const alphaThreshold = 10;
    const pointGridX = [];
    const pointGridY = [];

    for (let y = 0; y < img.height; y += step) {
      for (let x = 0; x < img.width; x += step) {
        const idx = (y * img.width + x) * 4;
        const alpha = imgData[idx + 3];
        if (alpha > alphaThreshold) {
          const px = x - img.width / 2;
          const py = -(y - img.height / 2);
          const pz = (depthData[idx] / 255) * 100;
          positions.push(px, py, pz);
          const r = imgData[idx] / 255;
          const g = imgData[idx + 1] / 255;
          const b = imgData[idx + 2] / 255;
          colors.push(r, g, b);
          sizes.push(BASE_PARTICLE_SIZE);
          pointGridX.push(Math.floor(x / step));
          pointGridY.push(Math.floor(y / step));
        }
      }
    }

    // Build a smooth silhouette-distance field on the sampled alpha grid so
    // turbulence ramps inward gradually from the actual transparent boundary.
    const pointCount = sizes.length;
    const gridWidth = Math.ceil(img.width / step);
    const gridHeight = Math.ceil(img.height / step);
    const pointIndexByCell = new Int32Array(gridWidth * gridHeight);
    pointIndexByCell.fill(-1);

    for (let i = 0; i < pointCount; i += 1) {
      const gx = pointGridX[i];
      const gy = pointGridY[i];
      pointIndexByCell[gy * gridWidth + gx] = i;
    }

    const edgeDistances = new Float32Array(pointCount);
    edgeDistances.fill(Number.POSITIVE_INFINITY);
    const queue = new Int32Array(pointCount);
    let head = 0;
    let tail = 0;

    for (let i = 0; i < pointCount; i += 1) {
      const gx = pointGridX[i];
      const gy = pointGridY[i];
      let isBoundary = false;

      for (let oy = -1; oy <= 1 && !isBoundary; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          if (ox === 0 && oy === 0) continue;
          const nx = gx + ox;
          const ny = gy + oy;
          if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight) {
            isBoundary = true;
            break;
          }
          if (pointIndexByCell[ny * gridWidth + nx] === -1) {
            isBoundary = true;
            break;
          }
        }
      }

      if (isBoundary) {
        edgeDistances[i] = 0;
        queue[tail++] = i;
      }
    }

    while (head < tail) {
      const index = queue[head++];
      const gx = pointGridX[index];
      const gy = pointGridY[index];
      const nextDistance = edgeDistances[index] + 1;

      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          if (ox === 0 && oy === 0) continue;
          const nx = gx + ox;
          const ny = gy + oy;
          if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight) continue;
          const neighborPointIndex = pointIndexByCell[ny * gridWidth + nx];
          if (neighborPointIndex === -1) continue;
          if (nextDistance < edgeDistances[neighborPointIndex]) {
            edgeDistances[neighborPointIndex] = nextDistance;
            queue[tail++] = neighborPointIndex;
          }
        }
      }
    }

    const rawEdgeFactors = new Float32Array(pointCount);
    for (let i = 0; i < pointCount; i += 1) {
      const distanceCells = edgeDistances[i];
      rawEdgeFactors[i] = Math.exp(-distanceCells / EDGE_DISTANCE_FALLOFF_CELLS);
    }

    originalPositions = new Float32Array(positions);
    introStartPositions = new Float32Array(positions.length);
    for (let i = 0; i < positions.length / 3; i += 1) {
      const baseIndex = i * 3;
      const spreadX = img.width * INTRO_SCATTER_XY;
      const spreadY = img.height * INTRO_SCATTER_XY;
      const spreadZ = 120 * INTRO_SCATTER_Z;
      introStartPositions[baseIndex] = (Math.random() * 2 - 1) * spreadX;
      introStartPositions[baseIndex + 1] = (Math.random() * 2 - 1) * spreadY;
      introStartPositions[baseIndex + 2] = (Math.random() * 2 - 1) * spreadZ;
    }

    geometry.setAttribute('position', new Float32BufferAttribute(introStartPositions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new Float32BufferAttribute(sizes, 1));
    activations = new Float32Array(sizes.length);
    driftOffsets = new Float32Array(positions.length);
    driftVelocities = new Float32Array(positions.length);
    edgeFactors = rawEdgeFactors;
    randomStates = new Uint32Array(sizes.length);
    for (let i = 0; i < randomStates.length; i += 1) {
      randomStates[i] = (i * 9781 + 0x9e3779b9) >>> 0;
    }

    targetWidth = img.width;
    targetHeight = img.height;
    updateCameraFrustum();

    introStartTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    introProgress = 0;

    const vertexShader = `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      varying float vSize;
      uniform float pointScale;
      void main() {
        vColor = color;
        vSize = size;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * pointScale;
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragmentShader = `
      varying vec3 vColor;
      varying float vSize;
      uniform float baseParticleSize;
      uniform float maxSizeMultiplier;
      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        if (length(coord) > 0.5) discard;
        float activation = clamp(
          (vSize / baseParticleSize - 1.0) / (maxSizeMultiplier - 1.0),
          0.0,
          1.0
        );
        float gray = dot(vColor, vec3(0.299, 0.587, 0.114));
        vec3 grayColor = vec3(gray);
        vec3 targetColor = vColor;
        vec3 restColor = mix(grayColor, targetColor, 0.4);
        float colorFactor = smoothstep(0.0, 1.0, activation);
        vec3 finalColor = mix(restColor, targetColor, colorFactor);
        float vibrantBoost = smoothstep(0.25, 1.0, activation) * 0.12;
        finalColor = mix(finalColor, targetColor * 1.08, vibrantBoost);
        float center = 1.0 - smoothstep(0.15, 0.5, length(coord));
        float glow = smoothstep(0.35, 1.0, activation) * center * 0.10;
        finalColor += targetColor * glow;
        finalColor = clamp(finalColor, 0.0, 1.0);
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const material = new ShaderMaterial({
      uniforms: {
        pointScale: { value: computePointSize(canvas.clientWidth) },
        baseParticleSize: { value: BASE_PARTICLE_SIZE },
        maxSizeMultiplier: { value: MAX_SIZE_MULTIPLIER },
      },
      vertexShader,
      fragmentShader,
    });

    points = new Points(geometry, material);
    scene.add(points);

    camera.position.z = 500;
    hasGeometry = true;

    // Render once immediately so the portrait appears even before interaction.
    renderer.render(scene, camera);
  }

  function shouldAnimate() {
    if (!hasGeometry || !isPageVisible) return false;

    // Keep subtle ambient motion alive whenever the page is visible.
    return true;
  }

  function updatePoints() {
    if (!points || !originalPositions) return;
    const positions = geometry.attributes.position.array;
    const sizeAttribute = geometry.attributes.size;
    const sizes = sizeAttribute.array;
    const smoothingFactor = 0.1;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const introActive = introProgress < 1;
    let introEase = 1;
    if (introActive) {
      const t = MathUtils.clamp((now - introStartTime) / INTRO_DURATION_MS, 0, 1);
      introProgress = t;
      // Ease-out quint so points gather quickly, then settle softly.
      introEase = 1 - Math.pow(1 - t, 5);
    }

    // Desktop: use raycasting to drive point size, not position.
    let intersectPoint = null;
    if (!isMobile && !introActive && hasPointerPosition) {
      // Ensure raycasting uses the latest object transform.
      points.updateMatrixWorld(true);
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(points);
      if (intersects.length > 0) {
        // Convert world-space hit point into the point cloud's local space.
        intersectPoint = points.worldToLocal(intersects[0].point.clone());
      }
    }

    for (let i = 0; i < positions.length / 3; i += 1) {
      const baseIndex = i * 3;
      const originalX = originalPositions[baseIndex];
      const originalY = originalPositions[baseIndex + 1];
      const originalZ = originalPositions[baseIndex + 2];

      if (introActive && introStartPositions) {
        const startX = introStartPositions[baseIndex];
        const startY = introStartPositions[baseIndex + 1];
        const startZ = introStartPositions[baseIndex + 2];
        positions[baseIndex] = startX + (originalX - startX) * introEase;
        positions[baseIndex + 1] = startY + (originalY - startY) * introEase;
        positions[baseIndex + 2] = startZ + (originalZ - startZ) * introEase;
        sizes[i] = BASE_PARTICLE_SIZE;
        if (activations) activations[i] = 0;
        continue;
      }

      let activation = 0;
      let targetX = originalX;
      let targetY = originalY;
      let targetZ = originalZ;

      if (!isMobile && activations) {
        let influence = 0;

        if (intersectPoint) {
          const dx = originalX - intersectPoint.x;
          const dy = originalY - intersectPoint.y;
          const dz = originalZ - intersectPoint.z;
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (distance < MAX_RADIUS && distance > 0) {
            influence = 1 - distance / MAX_RADIUS;
          }
        }

        // Decay previous activation and apply new influence to create a trail.
        activation = activations[i] || 0;
        activation *= DECAY;
        if (influence > activation) {
          activation = influence;
        }
        activations[i] = activation;

        const sizeMultiplier = 1 + activation * (MAX_SIZE_MULTIPLIER - 1);
        sizes[i] = BASE_PARTICLE_SIZE * sizeMultiplier;

        // Random per-point vibration: farther from cursor trail = more motion.
        const driftMix = Math.max(0, 1 - activation);
        const silhouetteEdge = edgeFactors ? edgeFactors[i] : 0;
        const ramp = MathUtils.smootherstep(
          silhouetteEdge,
          EDGE_TURBULENCE_START,
          EDGE_TURBULENCE_FULL,
        );
        const edgeFactor = Math.pow(ramp, EDGE_TURBULENCE_CURVE);
        const edgeTurbulence = 1 + edgeFactor * EDGE_TURBULENCE_GAIN;
        const velocityIndex = baseIndex;
        let state = randomStates[i];
        state = (state * 1664525 + 1013904223) >>> 0;
        const randX = state / 4294967295 - 0.5;
        state = (state * 1664525 + 1013904223) >>> 0;
        const randY = state / 4294967295 - 0.5;
        state = (state * 1664525 + 1013904223) >>> 0;
        const randZ = state / 4294967295 - 0.5;
        randomStates[i] = state;

        driftVelocities[velocityIndex] =
          driftVelocities[velocityIndex] * BROWNIAN_VELOCITY_DAMP +
          randX * BROWNIAN_ACCEL * driftMix * edgeTurbulence;
        driftVelocities[velocityIndex + 1] =
          driftVelocities[velocityIndex + 1] * BROWNIAN_VELOCITY_DAMP +
          randY * BROWNIAN_ACCEL * driftMix * edgeTurbulence;
        driftVelocities[velocityIndex + 2] =
          driftVelocities[velocityIndex + 2] * BROWNIAN_VELOCITY_DAMP +
          randZ * BROWNIAN_ACCEL * BROWNIAN_Z_DAMPING * driftMix * edgeTurbulence;

        driftOffsets[velocityIndex] =
          (driftOffsets[velocityIndex] + driftVelocities[velocityIndex]) * BROWNIAN_OFFSET_DAMP;
        driftOffsets[velocityIndex + 1] =
          (driftOffsets[velocityIndex + 1] + driftVelocities[velocityIndex + 1]) *
          BROWNIAN_OFFSET_DAMP;
        driftOffsets[velocityIndex + 2] =
          (driftOffsets[velocityIndex + 2] + driftVelocities[velocityIndex + 2]) *
          BROWNIAN_OFFSET_DAMP;

        const maxOffset = BROWNIAN_MAX_OFFSET * (1 + edgeFactor * EDGE_TURBULENCE_CLAMP_GAIN);
        driftOffsets[velocityIndex] = MathUtils.clamp(
          driftOffsets[velocityIndex],
          -maxOffset,
          maxOffset,
        );
        driftOffsets[velocityIndex + 1] = MathUtils.clamp(
          driftOffsets[velocityIndex + 1],
          -maxOffset,
          maxOffset,
        );
        driftOffsets[velocityIndex + 2] = MathUtils.clamp(
          driftOffsets[velocityIndex + 2],
          -maxOffset * BROWNIAN_Z_DAMPING,
          maxOffset * BROWNIAN_Z_DAMPING,
        );

        targetX += driftOffsets[velocityIndex] * driftMix;
        targetY += driftOffsets[velocityIndex + 1] * driftMix;
        targetZ += driftOffsets[velocityIndex + 2] * driftMix;
      } else {
        // On mobile, keep the base size.
        sizes[i] = BASE_PARTICLE_SIZE;
      }

      positions[baseIndex] += (targetX - positions[baseIndex]) * smoothingFactor;
      positions[baseIndex + 1] += (targetY - positions[baseIndex + 1]) * smoothingFactor;
      positions[baseIndex + 2] += (targetZ - positions[baseIndex + 2]) * smoothingFactor;
    }

    if (introActive && introProgress >= 1) {
      introStartPositions = null;
    }

    sizeAttribute.needsUpdate = true;
    geometry.attributes.position.needsUpdate = true;
  }

  function updateObjectRotation() {
    if (!points) return;
    const maxAngle = MathUtils.degToRad(20);
    let targetRotationX;
    let targetRotationY;

    if (isMobile && useDeviceOrientation) {
      targetRotationX = deviceRotationX;
      targetRotationY = deviceRotationY;
    } else if (mouseIsOver) {
      targetRotationX = mouse.y * maxAngle;
      targetRotationY = -mouse.x * maxAngle;
    } else {
      targetRotationX = 0;
      targetRotationY = 0;
    }

    points.rotation.x += (targetRotationX - points.rotation.x) * 0.1;
    points.rotation.y += (targetRotationY - points.rotation.y) * 0.1;
  }

  function animate() {
    requestAnimationFrame(animate);
    if (!shouldAnimate()) {
      return;
    }
    updateObjectRotation();
    updatePoints();
    renderer.render(scene, camera);
  }

  animate();
}

