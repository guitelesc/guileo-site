import { useEffect, useRef } from "react";
import * as THREE from "three";

const GREEN = 0x4fb07c, LIGHT = 0x7fc9a0, DARK = 0x2c6e4b, GOLD = 0xd6c29a, AMBER = 0xc2a878;

// Cached radial-gradient sprite texture for fake bloom (additive glow).
let _glowTex = null;
function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.7)");
  grad.addColorStop(0.6, "rgba(255,255,255,0.18)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(c);
  return _glowTex;
}

export default function GuileoLogo3D() {
  const mountRef = useRef();
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let w = mount.clientWidth || 480, h = mount.clientHeight || 480;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    camera.position.set(0, 0.15, 6.2);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setSize(w, h);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 1.15); dir.position.set(3, 5, 3); scene.add(dir);
    const pg = new THREE.PointLight(GREEN, 0.7, 12); pg.position.set(-2, 1, 2); scene.add(pg);
    const pgold = new THREE.PointLight(GOLD, 0.6, 12); pgold.position.set(0, -1.5, 1.5); scene.add(pgold);
    // a warm fill that brightens as the harvest ripens
    const harvestLight = new THREE.PointLight(GOLD, 0.0, 10); harvestLight.position.set(0, 1.4, 2); scene.add(harvestLight);

    const plant = new THREE.Group();
    plant.position.y = -0.35; plant.scale.setScalar(0.92);
    scene.add(plant);

    const disposables = [];
    const glowTex = glowTexture();
    const makeGlow = (colorHex, scale, opacity = 0.9) => {
      const m = new THREE.SpriteMaterial({ map: glowTex, color: colorHex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
      const s = new THREE.Sprite(m); s.scale.setScalar(scale); disposables.push(m);
      return s;
    };

    // --- Stem ---
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(0.04, 0.6, 0.02),
      new THREE.Vector3(-0.04, 1.3, -0.02), new THREE.Vector3(0.02, 2.0, 0),
    ]);
    const stemGeo = new THREE.TubeGeometry(stemCurve, 64, 0.05, 12, false);
    const stemMat = new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.55, metalness: 0.08, emissive: GREEN, emissiveIntensity: 0.05 });
    const stemMesh = new THREE.Mesh(stemGeo, stemMat);
    plant.add(stemMesh);
    disposables.push(stemGeo, stemMat);

    // --- Leaves ---
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.bezierCurveTo(0.34, 0.45, 0.46, 1.25, 0, 1.9);
    leafShape.bezierCurveTo(-0.46, 1.25, -0.34, 0.45, 0, 0);
    const leafGeo = new THREE.ShapeGeometry(leafShape, 44);
    // Give the flat blade a real 3D form: curl the tip back, cup it toward a central vein,
    // and paint a base→tip gradient via vertex colors so it reads as a living leaf, not paper.
    {
      const pos = leafGeo.attributes.position;
      const cBase = new THREE.Color(DARK), cTip = new THREE.Color(LIGHT), cv = new THREE.Color();
      const colors = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        const tY = Math.min(1, Math.max(0, y / 1.9));      // 0 at base → 1 at tip
        const z = -0.2 * Math.pow(tY, 1.7) - 0.12 * Math.abs(x) * (0.35 + tY); // tip curl + blade cup
        pos.setZ(i, z);
        const vein = 1 - Math.exp(-Math.abs(x) * 9) * 0.35; // central crease slightly darker
        cv.copy(cBase).lerp(cTip, (0.22 + tY * 0.78) * vein);
        colors[i * 3] = cv.r; colors[i * 3 + 1] = cv.g; colors[i * 3 + 2] = cv.b;
      }
      leafGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      leafGeo.computeVertexNormals();
    }
    disposables.push(leafGeo);
    const placements = [
      [0.55, 35, 55, 0.55], [0.55, 215, 55, 0.55], [1.05, 120, 48, 0.62], [1.05, 300, 48, 0.62],
      [1.55, 60, 42, 0.6], [1.55, 240, 42, 0.6], [1.95, 160, 30, 0.5], [2.0, 0, 22, 0.7],
    ];
    const leafGroups = [];
    placements.forEach(([y, a, tilt, sc], i) => {
      const rad = (a * Math.PI) / 180;
      const g = new THREE.Group();
      g.position.set(Math.sin(rad) * 0.05, y, Math.cos(rad) * 0.05);
      g.rotation.y = rad;
      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true, color: 0xffffff, side: THREE.DoubleSide,
        roughness: 0.42, metalness: 0.04, emissive: GREEN, emissiveIntensity: 0.07,
      });
      disposables.push(mat);
      const m = new THREE.Mesh(leafGeo, mat);
      m.rotation.x = (-(90 - tilt) * Math.PI) / 180;
      m.scale.setScalar(sc);
      g.add(m);
      g.userData = { baseRZ: g.rotation.z, baseRX: 0, phase: i * 1.7, sway: 0.05 + (i % 3) * 0.015 };
      plant.add(g); leafGroups.push(g);
    });

    // --- Circuit roots + nodes + underground pulses (the "watering" feeding the plant) ---
    const mk = (pts) => new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.2);
    const rootCurves = [
      mk([[0, -0.2, 0], [0, -0.7, 0], [0.7, -0.7, 0.1], [1.05, -1.05, 0.1]]),
      mk([[0, -0.2, 0], [0, -0.6, 0], [-0.65, -0.6, -0.1], [-0.95, -0.95, -0.1]]),
      mk([[0, -0.2, 0], [0, -0.9, 0], [0.4, -1.25, 0.3], [0.5, -1.6, 0.3]]),
      mk([[0, -0.2, 0], [0, -0.85, 0], [-0.35, -1.2, -0.25], [-0.45, -1.55, -0.25]]),
      mk([[0, -0.2, 0], [0.15, -0.7, 0.4], [0.15, -1.1, 0.7]]),
      mk([[0, -0.2, 0], [-0.15, -0.7, -0.4], [-0.15, -1.1, -0.7]]),
    ];
    const roots = new THREE.Group(); plant.add(roots);
    const pulses = [];
    const nodeGeo = new THREE.SphereGeometry(0.05, 14, 14);
    const pulseGeo = new THREE.SphereGeometry(0.05, 12, 12);
    disposables.push(nodeGeo, pulseGeo);
    rootCurves.forEach((c, i) => {
      const tg = new THREE.TubeGeometry(c, 40, 0.022, 8, false);
      const tm = new THREE.MeshStandardMaterial({ color: AMBER, emissive: GOLD, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.3 });
      roots.add(new THREE.Mesh(tg, tm)); disposables.push(tg, tm);
      const nm = new THREE.MeshStandardMaterial({ color: i % 2 ? GREEN : GOLD, emissive: i % 2 ? GREEN : GOLD, emissiveIntensity: 2.2 });
      const node = new THREE.Mesh(nodeGeo, nm); node.position.copy(c.getPointAt(1)); roots.add(node); disposables.push(nm);
      const ng = makeGlow(i % 2 ? GREEN : GOLD, 0.32, 0.6); ng.position.copy(node.position); roots.add(ng);
      const pm = new THREE.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 5 });
      const pulse = new THREE.Mesh(pulseGeo, pm); roots.add(pulse); disposables.push(pm);
      pulses.push({ mesh: pulse, curve: c, off: i * 0.16 });
    });

    // --- Rising sap: a bright bead that climbs the stem (water → energy feeding the fruit) ---
    const sapGeo = new THREE.SphereGeometry(0.045, 12, 12);
    const sapMat = new THREE.MeshStandardMaterial({ color: LIGHT, emissive: LIGHT, emissiveIntensity: 6 });
    const sap = new THREE.Mesh(sapGeo, sapMat); plant.add(sap); disposables.push(sapGeo, sapMat);
    const sapGlow = makeGlow(LIGHT, 0.5, 0.85); plant.add(sapGlow);

    // --- Fruits = the harvest (the results that matter). They ripen green → gold, one by one. ---
    const fruitGeo = new THREE.SphereGeometry(0.12, 22, 22);
    disposables.push(fruitGeo);
    const fruitDefs = [
      [0.16, 1.02, 0.14], [-0.2, 1.34, -0.12], [0.22, 1.6, 0.06],
      [-0.13, 1.82, 0.16], [0.06, 2.06, 0.0], [0.26, 1.2, -0.18],
    ];
    const fruits = fruitDefs.map(([x, y, z], i) => {
      const mat = new THREE.MeshStandardMaterial({ color: GREEN, emissive: GREEN, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.5 });
      disposables.push(mat);
      const mesh = new THREE.Mesh(fruitGeo, mat);
      mesh.position.set(x, y, z); mesh.scale.setScalar(0.001);
      plant.add(mesh);
      const glow = makeGlow(GREEN, 0.55, 0.0); glow.position.set(x, y, z); plant.add(glow);
      // tiny offset specular dot — the dewy highlight that makes the fruit read as a real berry
      const hl = makeGlow(0xffffff, 0.001, 0.0); plant.add(hl);
      return { mesh, mat, glow, hl, base: new THREE.Vector3(x, y, z), ripe0: 0.6 + i * 0.07, phase: i * 1.1 };
    });
    const cGreen = new THREE.Color(GREEN), cGold = new THREE.Color(GOLD), cTmp = new THREE.Color();

    // --- Tech halo: a thin luminous ring slowly orbiting the canopy ---
    const ringGeo = new THREE.TorusGeometry(1.15, 0.008, 8, 120);
    const ringMat = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending });
    const ring = new THREE.Mesh(ringGeo, ringMat); ring.position.y = 1.3; ring.rotation.x = Math.PI / 2.3; plant.add(ring); disposables.push(ringGeo, ringMat);

    // Subtle soil/contact shadow where the plant is rooted — grounds the composition (realism).
    const soilTex = (() => {
      const c = document.createElement("canvas"); c.width = c.height = 96;
      const g = c.getContext("2d"); const gr = g.createRadialGradient(48, 48, 0, 48, 48, 48);
      gr.addColorStop(0, "rgba(16,15,12,0.6)"); gr.addColorStop(0.55, "rgba(16,15,12,0.24)"); gr.addColorStop(1, "rgba(16,15,12,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 96, 96); return new THREE.CanvasTexture(c);
    })();
    const soilGeo = new THREE.PlaneGeometry(1.7, 0.75);
    const soilMat = new THREE.MeshBasicMaterial({ map: soilTex, transparent: true, depthWrite: false, opacity: 0.55 });
    const soil = new THREE.Mesh(soilGeo, soilMat); soil.rotation.x = -Math.PI / 2; soil.position.set(0, -0.21, 0); plant.add(soil);
    disposables.push(soilGeo, soilMat, soilTex);

    // --- Growth state (seed → roots → stem → leaves → fruits) ---
    roots.scale.setScalar(0.001);
    stemMesh.scale.y = 0.001;
    leafGroups.forEach((g) => g.scale.setScalar(0.001));
    const GROW_DELAY = 1.0, GROW_DUR = 3.0;
    const ss = (p, a, b) => { const x = Math.min(1, Math.max(0, (p - a) / (b - a))); return x * x * (3 - 2 * x); };
    // gentle spring-overshoot for fruit pop
    const pop = (x) => { if (x <= 0) return 0.001; if (x >= 1) return 1; return 1 - Math.pow(1 - x, 3) * Math.cos(x * 7) * 0.4 - Math.pow(1 - x, 3) * 0.6; };

    // --- Ambient float particles (pollen / data motes) ---
    const pCount = 80;
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 4;
      pPos[i * 3 + 1] = (Math.random() - 0.5) * 4 + 0.8;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ color: LIGHT, size: 0.045, sizeAttenuation: true, transparent: true, opacity: 0.6, depthWrite: false });
    const particles = new THREE.Points(pGeo, pMat); scene.add(particles); disposables.push(pGeo, pMat);

    // --- Interaction + animation loop ---
    let px = 0, py = 0;
    const onMove = (e) => {
      const r = mount.getBoundingClientRect();
      px = ((e.clientX - r.left) / r.width) * 2 - 1;
      py = -(((e.clientY - r.top) / r.height) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove);

    const clock = new THREE.Clock();
    let raf;
    const SAP_PERIOD = 2.6; // seconds for one bead to climb the stem
    const animate = () => {
      const t = clock.getElapsedTime();
      const gp = Math.min(1, Math.max(0, (t - GROW_DELAY) / GROW_DUR));
      roots.scale.setScalar(0.001 + ss(gp, 0.0, 0.4));
      stemMesh.scale.y = 0.001 + ss(gp, 0.18, 0.58);
      leafGroups.forEach((g, i) => {
        g.scale.setScalar(0.001 + ss(gp, 0.4 + (i % 8) * 0.03, 0.74 + (i % 8) * 0.02));
        // per-leaf wind: each blade flutters on its own phase (independent sway = realism)
        const ud = g.userData;
        g.rotation.z = ud.baseRZ + Math.sin(t * 1.55 + ud.phase) * ud.sway;
        g.rotation.x = Math.sin(t * 1.05 + ud.phase * 0.7) * ud.sway * 0.55;
      });

      // Rising sap bead climbs the stem on a loop (the "watering" that feeds the harvest)
      const sapT = ((t % SAP_PERIOD) / SAP_PERIOD);
      const sapPt = stemCurve.getPointAt(Math.min(0.999, sapT));
      sap.position.copy(sapPt); sap.visible = gp > 0.5;
      sapGlow.position.copy(sapPt); sapGlow.visible = gp > 0.5;
      const sapFade = Math.sin(sapT * Math.PI); // dim at the ends, bright mid-climb
      sapMat.emissiveIntensity = 3 + sapFade * 4;

      // Fruits ripen green → gold (the results arriving), then breathe + bob forever.
      let ripeSum = 0;
      fruits.forEach((f, i) => {
        const rp = ss(gp, f.ripe0, Math.min(1, f.ripe0 + 0.22)); // 0..1 ripeness
        ripeSum += rp;
        f.mesh.scale.setScalar(0.001 + pop(rp) * (0.85 + 0.15 * Math.sin(i)));
        // color + glow climb with ripeness; a brighter shimmer when the sap bead passes the fruit's height
        const nearSap = Math.max(0, 1 - Math.abs(sapPt.y - f.base.y) * 2.2) * sapFade;
        const shimmer = 0.6 + 0.25 * Math.sin(t * 2.2 + f.phase) + nearSap * 1.2;
        cTmp.copy(cGreen).lerp(cGold, rp);
        f.mat.color.copy(cTmp);
        f.mat.emissive.copy(cTmp);
        f.mat.emissiveIntensity = (0.5 + rp * 1.1) * shimmer;
        f.glow.material.color.copy(cTmp);
        f.glow.material.opacity = rp * (0.45 + 0.3 * Math.max(0, Math.sin(t * 2.2 + f.phase)) + nearSap * 0.5);
        f.glow.scale.setScalar((0.4 + rp * 0.35) * (1 + nearSap * 0.4));
        // gentle bob
        f.mesh.position.y = f.base.y + Math.sin(t * 1.1 + f.phase) * 0.02 * rp;
        f.glow.position.y = f.mesh.position.y;
        // dewy specular highlight rides the fruit (upper-left toward the light)
        const fs = f.mesh.scale.x;
        f.hl.position.set(f.base.x - 0.045 * fs, f.mesh.position.y + 0.05 * fs, f.base.z + 0.09 * fs);
        f.hl.scale.setScalar(0.11 * fs);
        f.hl.material.opacity = 0.85 * rp;
      });
      const harvest = ripeSum / fruits.length; // 0..1 overall harvest
      harvestLight.intensity = harvest * 0.9 + Math.sin(t * 1.5) * 0.08 * harvest;
      ringMat.opacity = harvest * 0.5;
      ring.rotation.z = t * 0.3;
      ring.scale.setScalar(1 + Math.sin(t * 0.8) * 0.03);

      plant.rotation.y = Math.sin(t * 0.25) * 0.25 + px * 0.35;
      plant.rotation.x = -0.05 + Math.sin(t * 0.2) * 0.04 - py * 0.2;
      plant.position.y = -0.35 + Math.sin(t * 0.6) * 0.04;

      pulses.forEach(({ mesh, curve, off }) => {
        const tt = (t * 0.35 + off) % 1;
        mesh.position.copy(curve.getPointAt(Math.max(0.001, Math.min(0.999, 1 - tt))));
      });
      particles.rotation.y = t * 0.04;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const resize = () => {
      w = mount.clientWidth; h = mount.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      disposables.forEach((d) => d.dispose && d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}
