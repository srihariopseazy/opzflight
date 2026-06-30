/**
 * Builds and returns a THREE.Group containing the full low-poly airplane.
 * Import THREE externally and pass it in so this file has no CDN dependency.
 */
export function buildAirplane(THREE) {
  const g = new THREE.Group();

  /* Fuselage */
  const fuseGeo = new THREE.CylinderGeometry(0.28, 0.18, 4.2, 7);
  fuseGeo.rotateZ(Math.PI / 2);
  g.add(new THREE.Mesh(fuseGeo, new THREE.MeshLambertMaterial({ color: 0x6366f1 })));

  /* Nose cone */
  const noseGeo = new THREE.ConeGeometry(0.28, 0.9, 7);
  noseGeo.rotateZ(-Math.PI / 2);
  const noseMesh = new THREE.Mesh(noseGeo, new THREE.MeshLambertMaterial({ color: 0x4f46e5 }));
  noseMesh.position.set(2.55, 0, 0);
  g.add(noseMesh);

  /* Tail cone */
  const tailGeo = new THREE.ConeGeometry(0.18, 0.6, 6);
  tailGeo.rotateZ(Math.PI / 2);
  const tailMesh = new THREE.Mesh(tailGeo, new THREE.MeshLambertMaterial({ color: 0x4f46e5 }));
  tailMesh.position.set(-2.4, 0, 0);
  g.add(tailMesh);

  /* Wings */
  const wingMat = new THREE.MeshLambertMaterial({ color: 0x818cf8 });
  const wingGeo = new THREE.BoxGeometry(2.0, 0.08, 3.0);
  wingGeo.translate(0.2, -0.05, 0);
  const wingL = new THREE.Mesh(wingGeo, wingMat);
  wingL.rotation.y = 0.12;
  g.add(wingL);
  const wingR = new THREE.Mesh(wingGeo, wingMat);
  wingR.scale.z = -1;
  wingR.rotation.y = -0.12;
  g.add(wingR);

  /* Winglets (orange) */
  const wlGeo = new THREE.BoxGeometry(0.12, 0.38, 0.06);
  const wlMat = new THREE.MeshLambertMaterial({ color: 0xf97316 });
  const wlL = new THREE.Mesh(wlGeo, wlMat);
  wlL.position.set(0.5, 0.18, 1.47);
  g.add(wlL);
  const wlR = new THREE.Mesh(wlGeo, wlMat);
  wlR.position.set(0.5, 0.18, -1.47);
  g.add(wlR);

  /* Horizontal stabilizers */
  const stabGeo = new THREE.BoxGeometry(1.0, 0.06, 1.3);
  stabGeo.translate(-0.2, 0, 0);
  const stabMat = new THREE.MeshLambertMaterial({ color: 0x818cf8 });
  const stabL = new THREE.Mesh(stabGeo, stabMat);
  stabL.position.set(-1.85, 0.1, 0);
  g.add(stabL);
  const stabR = stabL.clone();
  stabR.scale.z = -1;
  g.add(stabR);

  /* Vertical tail fin (orange) */
  const finGeo = new THREE.BoxGeometry(0.9, 0.9, 0.08);
  finGeo.translate(-0.25, 0.45, 0);
  const fin = new THREE.Mesh(finGeo, new THREE.MeshLambertMaterial({ color: 0xf97316 }));
  fin.position.set(-1.7, 0.28, 0);
  g.add(fin);

  /* Engine pods */
  const engGeo = new THREE.CylinderGeometry(0.18, 0.14, 0.9, 8);
  engGeo.rotateZ(Math.PI / 2);
  const engMat = new THREE.MeshLambertMaterial({ color: 0x475569 });
  const eng1 = new THREE.Mesh(engGeo, engMat);
  eng1.position.set(0.3, -0.22, 0.95);
  g.add(eng1);
  const eng2 = eng1.clone();
  eng2.position.set(0.3, -0.22, -0.95);
  g.add(eng2);

  /* Nacelle rings (amber) */
  const ringGeo = new THREE.TorusGeometry(0.18, 0.03, 6, 10);
  const ringMat = new THREE.MeshLambertMaterial({ color: 0xfbbf24 });
  const r1 = new THREE.Mesh(ringGeo, ringMat);
  r1.rotation.y = Math.PI / 2;
  r1.position.set(0.74, -0.22, 0.95);
  g.add(r1);
  const r2 = r1.clone();
  r2.position.set(0.74, -0.22, -0.95);
  g.add(r2);

  /* Cockpit windows (sky blue) */
  const cock = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.12, 0.44),
    new THREE.MeshLambertMaterial({ color: 0x7dd3fc })
  );
  cock.position.set(2.1, 0.14, 0);
  g.add(cock);

  return g;
}

/** Low-poly cloud cluster centred at (x,y,z) */
export function makeCloud(THREE, x, y, z, scale) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
  [[0,0,0,1.1],[1.0,0.1,0,0.85],[-0.9,0.1,0,0.85],[0.4,0.6,0.2,0.7],[-0.3,0.55,-0.1,0.65]]
    .forEach(([cx,cy,cz,r]) => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat);
      m.position.set(cx, cy, cz);
      g.add(m);
    });
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  return g;
}

/** Simple runway group: ground + tarmac strip + centreline dashes */
export function buildRunway(THREE) {
  const g = new THREE.Group();

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 25),
    new THREE.MeshLambertMaterial({ color: 0x0f172a })
  );
  ground.rotation.x = -Math.PI / 2;
  g.add(ground);

  const tarmac = new THREE.Mesh(
    new THREE.PlaneGeometry(55, 2.6),
    new THREE.MeshLambertMaterial({ color: 0x1e293b })
  );
  tarmac.rotation.x = -Math.PI / 2;
  tarmac.position.y = 0.01;
  g.add(tarmac);

  const dashMat = new THREE.MeshLambertMaterial({ color: 0xfbbf24 });
  for (let i = -6; i <= 6; i++) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.1), dashMat);
    d.rotation.x = -Math.PI / 2;
    d.position.set(i * 4, 0.02, 0);
    g.add(d);
  }

  return g;
}
