document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('canvas');
  if (!(canvas instanceof HTMLCanvasElement)) return;

  let hasStarted = false;
  const startPortrait = async () => {
    if (hasStarted) return;
    hasStarted = true;
    const { initPortraitScene } = await import('./webgl/portraitScene.js');
    initPortraitScene(canvas);
  };

  const startWhenIdle = () => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        startPortrait().catch((error) => console.error(error));
      });
      return;
    }
    window.setTimeout(() => {
      startPortrait().catch((error) => console.error(error));
    }, 1);
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          startWhenIdle();
        }
      },
      { rootMargin: '120px 0px' },
    );
    observer.observe(canvas);
    return;
  }

  startWhenIdle();
});

