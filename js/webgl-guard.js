(function () {
  function hasWebGL() {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }
  window.__hasWebGL = hasWebGL();

  if (!window.__hasWebGL) {
    document.addEventListener('DOMContentLoaded', function () {
      const el = document.getElementById('game3d');
      if (!el) return;
      el.innerHTML =
        '<div style="display:grid;place-items:center;height:100%;padding:24px;text-align:center;">' +
        '<div><div style="font-size:40px;margin-bottom:10px;">⚠️</div>' +
        '<h3 style="margin-bottom:8px;color:#f5f7ff;font-family:\'Space Grotesk\',sans-serif;">WebGL Not Available</h3>' +
        '<p style="color:#a5a8c8;font-size:14px;max-width:320px;font-family:sans-serif;">' +
        'Your browser or device doesn\'t support WebGL, which this 3D game needs. ' +
        'Try updating your browser, enabling hardware acceleration, or switching devices.</p></div></div>';
      const overlay = document.getElementById('overlay');
      if (overlay) overlay.classList.remove('show');
    });
  }
})();
