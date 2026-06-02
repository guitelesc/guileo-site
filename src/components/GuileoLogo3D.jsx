import { useEffect, useRef } from "react";
import * as THREE from "three";

const GREEN = 0x4fb07c, LIGHT = 0x7fc9a0, DARK = 0x2c6e4b, GOLD = 0xd6c29a, AMBER = 0xc2a878;

export default function GuileoLogo3D() {
  const mountRef = useRef();
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let w = mount.clientWidth || 480, h = mount.clientHeight || 480;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    camera.position.set(0, 0.1, 6.2);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setSize(w, h);
    mount.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2); dir.position.set(3, 5, 3); scene.add(dir);
    const pg = new THREE.PointLight(GREEN, 0.7, 12); pg.position.set(-2, 1, 2); scene.add(pg);
    const pgold = new THREE.PointLight(GOLD, 0.6, 12); pgold.position.set(0, -1.5, 1.5); scene.add(pgold);

    const plant = new THREE.Group();
    plant.position.y = -0.35; plant.scale.setScalar(0.92);
    scene.add(plant);

    const disposables = [];

    // --- Stem ---
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(0.04, 0.6, 0.02),
      new THREE.Vector3(-0.04, 1.3, -0.02), new THREE.Vector3(0.02, 2.0, 0),
    ]);
    const stemGeo = new THREE.TubeGeometry(stemCurve, 60, 0.05, 10, false);
    const stemMat = new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.6, metalness: 0.05 });
    const stemMesh = new THREE.Mesh(stemGeo, stemMat);
    plant.add(stemMesh);
    disposables.push(stemGeo, stemMat);

    // --- Leaves ---
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.bezierCurveTo(0.34, 0.45, 0.46, 1.25, 0, 1.9);
    leafShape.bezierCurveTo(-0.46, 1.25, -0.34, 0.45, 0, 0);
    const leafGeo = new THREE.ShapeGeometry(leafShape, 28);
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
        color: i % 3 === 0 ? LIGHT : GREEN, side: THREE.DoubleSide,
        roughness: 0.5, metalness: 0.02, emissive: GREEN, emissiveIntensity: 0.08,
      });
      disposables.push(mat);
      const m = new THREE.Mesh(leafGeo, mat);
      m.rotation.x = (-(90 - tilt) * Math.PI) / 180;
      m.scale.setScalar(sc);
      g.add(m); plant.add(g); leafGroups.push(g);
    });

    // --- Circuit roots + nodes + pulses ---
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
      // end node
      const nm = new THREE.MeshStandardMaterial({ color: i % 2 ? GREEN : GOLD, emissive: i % 2 ? GREEN : GOLD, emissiveIntensity: 2.2 });
      const node = new THREE.Mesh(nodeGeo, nm); node.position.copy(c.getPointAt(1)); roots.add(node); disposables.push(nm);
      // traveling pulse
      const pm = new THREE.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 5 });
      const pulse = new THREE.Mesh(pulseGeo, pm); roots.add(pulse); disposables.push(pm);
      pulses.push({ mesh: pulse, curve: c, off: i * 0.16 });
    });

    // --- Fruit (the harvest) ---
    const fruitGeo = new THREE.SphereGeometry(0.13, 20, 20);
    const fruitMat = new THREE.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.45 });
    const fruit = new THREE.Mesh(fruitGeo, fruitMat); fruit.position.set(0.02, 2.05, 0); plant.add(fruit); disposables.push(fruitGeo, fruitMat);

    // --- Growth state: start as a seed, grow roots → stem → leaves → fruit ---
    roots.scale.setScalar(0.001);
    stemMesh.scale.y = 0.001;
    leafGroups.forEach((g) => g.scale.setScalar(0.001));
    fruit.scale.setScalar(0.001);
    const GROW_DELAY = 1.3, GROW_DUR = 2.8;
    const ss = (p, a, b) => { const x = Math.min(1, Math.max(0, (p - a) / (b - a))); return x * x * (3 - 2 * x); };

    // --- Particles ---
    const pCount = 70;
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 4;
      pPos[i * 3 + 1] = (Math.random() - 0.5) * 4 + 0.8;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ color: LIGHT, size: 0.045, sizeAttenuation: true, transparent: true, opacity: 0.7, depthWrite: false });
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
    const animate = () => {
      const t = clock.getElapsedTime();
      // growth choreography (seed → roots → stem → leaves → fruit)
      const gp = Math.min(1, Math.max(0, (t - GROW_DELAY) / GROW_DUR));
      roots.scale.setScalar(0.001 + ss(gp, 0.0, 0.4));
      stemMesh.scale.y = 0.001 + ss(gp, 0.2, 0.6);
      leafGroups.forEach((g, i) => g.scale.setScalar(0.001 + ss(gp, 0.42 + (i % 8) * 0.03, 0.78 + (i % 8) * 0.02)));
      const fg = ss(gp, 0.82, 1);
      fruit.scale.setScalar(0.001 + fg);
      fruit.material.emissiveIntensity = 0.5 + fg * 0.9 + Math.sin(t * 2) * 0.12 * fg;
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

    // --- Resize ---
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
