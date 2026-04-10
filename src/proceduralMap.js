/**
 * Procedural cave environment generator for level-3 ("Neon Cavern").
 * Builds the scene entirely from Three.js geometry — no GLTF required.
 */

import {
	Color,
	ConeGeometry,
	DoubleSide,
	FogExp2,
	Group,
	IcosahedronGeometry,
	Mesh,
	MeshStandardMaterial,
	PlaneGeometry,
	PointLight,
	TorusGeometry,
} from 'three';

// Cave dimensions (all in Three.js units)
const CAVE_HALF_W = 28;
const CAVE_HALF_D = 55;
const FLOOR_Y = 0;
const CEILING_Y = 13;
const CAVE_H = CEILING_Y - FLOOR_Y;

const CRYSTAL_COLORS = [0x00ffff, 0xff00ff, 0x7700ff, 0x00ff88, 0xff6600];

/**
 * Creates the glowing neon ring used as the target in level-3.
 * Named 'ring' so the existing GameSystem can find it via getObjectByName.
 */
export function createNeonRing() {
	const geo = new TorusGeometry(1, 0.07, 16, 64);
	const mat = new MeshStandardMaterial({
		color: 0x00ffff,
		emissive: new Color(0x00ffff),
		emissiveIntensity: 1.2,
		roughness: 0,
		metalness: 1,
	});
	const ring = new Mesh(geo, mat);
	ring.name = 'ring';
	ring.position.set(0, 5, 34);
	return ring;
}

/**
 * Builds the procedural cave environment and returns a Group.
 * Also sets scene fog and background to match the cave atmosphere.
 *
 * @param {import('three').Scene} scene - The Three.js scene (for fog/background).
 * @returns {Group} The cave group to add to the scene.
 */
export function createProceduralCave(scene) {
	const group = new Group();
	group.name = 'proceduralCave';

	// Dark cave atmosphere
	scene.fog = new FogExp2(0x080010, 0.012);
	scene.background = new Color(0x080010);

	// --- Floor ---
	const floorMat = new MeshStandardMaterial({ color: 0x0d0820, roughness: 1 });
	const floor = new Mesh(
		new PlaneGeometry(CAVE_HALF_W * 2, CAVE_HALF_D * 2, 30, 30),
		floorMat,
	);
	floor.rotation.x = -Math.PI / 2;
	floor.position.y = FLOOR_Y;
	group.add(floor);

	// --- Ceiling ---
	const ceilMat = new MeshStandardMaterial({
		color: 0x0a0518,
		roughness: 1,
		side: DoubleSide,
	});
	const ceiling = new Mesh(
		new PlaneGeometry(CAVE_HALF_W * 2, CAVE_HALF_D * 2, 30, 30),
		ceilMat,
	);
	ceiling.rotation.x = Math.PI / 2;
	ceiling.position.y = CEILING_Y;
	group.add(ceiling);

	// --- Walls ---
	const wallMat = new MeshStandardMaterial({ color: 0x0c0620, roughness: 0.95 });
	const wallDefs = [
		{ pos: [-CAVE_HALF_W, FLOOR_Y + CAVE_H / 2, 0], ry: Math.PI / 2, w: CAVE_HALF_D * 2 },
		{ pos: [CAVE_HALF_W, FLOOR_Y + CAVE_H / 2, 0], ry: -Math.PI / 2, w: CAVE_HALF_D * 2 },
		{ pos: [0, FLOOR_Y + CAVE_H / 2, -CAVE_HALF_D], ry: 0, w: CAVE_HALF_W * 2 },
		{ pos: [0, FLOOR_Y + CAVE_H / 2, CAVE_HALF_D], ry: Math.PI, w: CAVE_HALF_W * 2 },
	];
	for (const { pos, ry, w } of wallDefs) {
		const wall = new Mesh(new PlaneGeometry(w, CAVE_H), wallMat.clone());
		wall.rotation.y = ry;
		wall.position.set(pos[0], pos[1], pos[2]);
		group.add(wall);
	}

	// --- Stalactites (hanging from ceiling) ---
	const rockMat = new MeshStandardMaterial({ color: 0x180930, roughness: 0.9 });
	for (let i = 0; i < 70; i++) {
		const h = 1 + Math.random() * 4.5;
		const r = 0.12 + Math.random() * 0.45;
		const stal = new Mesh(
			new ConeGeometry(r, h, 5 + Math.floor(Math.random() * 4)),
			rockMat,
		);
		stal.position.set(
			(Math.random() - 0.5) * CAVE_HALF_W * 1.85,
			CEILING_Y - h / 2,
			(Math.random() - 0.5) * CAVE_HALF_D * 1.85,
		);
		stal.rotation.z = Math.PI; // point downward
		group.add(stal);
	}

	// --- Stalagmites (rising from floor) ---
	for (let i = 0; i < 60; i++) {
		const h = 0.4 + Math.random() * 3.5;
		const r = 0.1 + Math.random() * 0.4;
		const stag = new Mesh(
			new ConeGeometry(r, h, 5 + Math.floor(Math.random() * 4)),
			rockMat.clone(),
		);
		stag.position.set(
			(Math.random() - 0.5) * CAVE_HALF_W * 1.85,
			FLOOR_Y + h / 2,
			(Math.random() - 0.5) * CAVE_HALF_D * 1.85,
		);
		group.add(stag);
	}

	// --- Glowing crystals + scattered point lights ---
	for (let i = 0; i < 35; i++) {
		const color = CRYSTAL_COLORS[i % CRYSTAL_COLORS.length];
		const size = 0.25 + Math.random() * 0.65;
		const crystalMat = new MeshStandardMaterial({
			color,
			emissive: new Color(color),
			emissiveIntensity: 0.9,
			roughness: 0.1,
			metalness: 0.8,
		});
		const crystal = new Mesh(new IcosahedronGeometry(size, 0), crystalMat);
		crystal.position.set(
			(Math.random() - 0.5) * CAVE_HALF_W * 1.9,
			FLOOR_Y + 0.5 + Math.random() * (CAVE_H - 1),
			(Math.random() - 0.5) * CAVE_HALF_D * 1.9,
		);
		crystal.rotation.set(
			Math.random() * Math.PI,
			Math.random() * Math.PI,
			Math.random() * Math.PI,
		);
		group.add(crystal);

		// One point light per every 3 crystals to keep draw calls manageable
		if (i % 3 === 0) {
			const light = new PointLight(color, 4, 22);
			light.position.copy(crystal.position);
			group.add(light);
		}
	}

	return group;
}
