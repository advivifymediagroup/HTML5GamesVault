/* Shared visual quality layer for the 3D games.
   Generates a studio-style environment map in-code (no external assets) so
   metallic and glossy materials have something real to reflect, and raises
   shadow / lighting quality across the board. */
(function () {
  if (typeof THREE === 'undefined') return;

  function makeEnvTexture(renderer, opts) {
    opts = opts || {};
    const top = opts.top || '#3a3f7a';
    const mid = opts.mid || '#1a1c3a';
    const bottom = opts.bottom || '#0a0a18';

    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 256;
    const ctx = cv.getContext('2d');

    // vertical sky gradient
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, top);
    g.addColorStop(0.55, mid);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 256);

    // soft key light — the bright spot glossy surfaces pick up
    const key = ctx.createRadialGradient(150, 60, 5, 150, 60, 130);
    key.addColorStop(0, 'rgba(255,255,255,0.95)');
    key.addColorStop(0.4, 'rgba(210,225,255,0.35)');
    key.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = key;
    ctx.fillRect(0, 0, 512, 256);

    // cooler rim light on the opposite side
    const rim = ctx.createRadialGradient(390, 105, 5, 390, 105, 150);
    rim.addColorStop(0, 'rgba(120,220,255,0.5)');
    rim.addColorStop(1, 'rgba(120,220,255,0)');
    ctx.fillStyle = rim;
    ctx.fillRect(0, 0, 512, 256);

    // faint warm bounce from below
    const bounce = ctx.createRadialGradient(256, 250, 5, 256, 250, 170);
    bounce.addColorStop(0, 'rgba(255,190,140,0.22)');
    bounce.addColorStop(1, 'rgba(255,190,140,0)');
    ctx.fillStyle = bounce;
    ctx.fillRect(0, 0, 512, 256);

    const tex = new THREE.CanvasTexture(cv);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    // r152+ uses colorSpace; r128 and earlier use encoding.
    if (THREE.SRGBColorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
    else if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;

    // Pre-filter into a proper PMREM env map when available — gives correct
    // roughness-aware reflections instead of a mirror-sharp one.
    if (renderer && THREE.PMREMGenerator) {
      try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        const rt = pmrem.fromEquirectangular(tex);
        tex.dispose();
        pmrem.dispose();
        return rt.texture;
      } catch (e) { /* fall through to raw texture */ }
    }
    return tex;
  }

  window.SceneKit = {
    /* Call right after the renderer + scene exist. */
    enhance: function (renderer, scene, opts) {
      opts = opts || {};
      if (!renderer || !scene) return;

      // Crisper, softer shadows
      renderer.shadowMap.enabled = true;
      if (THREE.PCFSoftShadowMap) renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      // Slightly richer contrast than the default. Exposure is tuned for sRGB
      // output — the materials read too hot at 1.0+ once gamma is correct.
      if (THREE.ACESFilmicToneMapping) renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = opts.exposure || 0.95;

      // Reflections
      if (opts.env !== false) {
        try {
          const env = makeEnvTexture(renderer, opts);
          scene.environment = env;
        } catch (e) { /* non-fatal — game still renders */ }
      }

      // Upgrade existing lights' shadow quality
      scene.traverse(function (o) {
        if (o.isDirectionalLight && o.castShadow && o.shadow) {
          o.shadow.mapSize.set(2048, 2048);
          o.shadow.bias = -0.0005;
          o.shadow.normalBias = 0.02;
        }
      });
    },

    /* Apply after meshes are built, to lift material response.

       Also fixes colour handling: this build of three treats a material's
       colour as already-linear, but the renderer gamma-encodes on output, so
       a hex picked in sRGB renders washed out and desaturated. Converting it
       once puts the shading maths in linear space and the pixel back where
       the colour was chosen. `__sk` guards against double-converting when
       polish runs on every frame batch. */
    polishMaterials: function (scene, opts) {
      opts = opts || {};
      const envInt = opts.envMapIntensity == null ? 0.55 : opts.envMapIntensity;
      const linearize = opts.linearize !== false;

      // Background and fog are authored as sRGB hexes too, so they need the
      // same treatment or they drift away from the linearised materials.
      if (linearize) {
        [scene.background, scene.fog && scene.fog.color].forEach(function (col) {
          if (col && col.convertSRGBToLinear && !col.__sk) {
            col.convertSRGBToLinear();
            col.__sk = true;
          }
        });
      }

      scene.traverse(function (o) {
        const m = o.material;
        if (!m) return;
        (Array.isArray(m) ? m : [m]).forEach(function (mat) {
          if (linearize && !mat.__sk) {
            mat.__sk = true;
            if (mat.color && mat.color.convertSRGBToLinear) mat.color.convertSRGBToLinear();
            if (mat.emissive && mat.emissive.convertSRGBToLinear) mat.emissive.convertSRGBToLinear();
            mat.needsUpdate = true;
          }
          if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
            mat.envMapIntensity = envInt;
            mat.needsUpdate = true;
          }
        });
      });
    }
  };
})();
