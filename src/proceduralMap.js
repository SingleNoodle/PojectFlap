/**
 * Procedural cave environment generator for level-3 ("Neon Cavern").
 * Builds the scene entirely from Three.js geometry — no GLTF required.
 */

import {
    BoxGeometry,
    Color,
    ConeGeometry,
    CylinderGeometry,
    DodecahedronGeometry,
    DoubleSide,
    FogExp2,
    Group,
    IcosahedronGeometry,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    PlaneGeometry,
    PointLight,
} from 'three';

// Cave dimensions (all in Three.js units)
const CAVE_HALF_W = 52;
const CAVE_HALF_D = 75;
const FLOOR_Y = 0;
const CEILING_Y = 30;
const CAVE_H = CEILING_Y - FLOOR_Y;

const CRYSTAL_COLORS = [0x00ffff, 0xff00ff, 0x7700ff, 0x00ff88, 0xff6600];

/**
 * Creates the glowing neon ring used as the target in level-3.
 * Named 'ring' so the existing GameSystem can find it via getObjectByName.
 */
export function createNeonRing() {
    const ring = new Group();
    ring.name = 'ring';

    const radius = 1.0;
    const segmentCount = 24;
    const segmentLength = 0.24;
    const segmentThickness = 0.12;
    const segmentDepth = 0.12;

    const colors = [0xffffff, 0x8fb6ff]; // white + soft blue

    for (let i = 0; i < segmentCount; i++) {
        const angle = (i / segmentCount) * Math.PI * 2;

        const segment = new Mesh(
            new BoxGeometry(segmentLength, segmentThickness, segmentDepth),
            new MeshBasicMaterial({
                color: colors[i % 2],
            }),
        );

        segment.position.set(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            0
        );

        segment.rotation.z = angle + Math.PI / 2;
        ring.add(segment);
    }
	ring.rotation.y = Math.PI / 2;
    ring.position.set(0, 5, 34);
	
    return ring;
}
export function createMoltenRift(scene) {
    const group = new Group();
    group.name = 'proceduralMoltenRift';

    const FLOOR_Y = 0;

    // Keep the lava route near the gameplay orbit
    const ORBIT_RADIUS = 34;

    // Bigger map footprint
    const PLATFORM_RADIUS = 92;
    const PLATFORM_HEIGHT = 8;

    // Lava path settings
    const LAVA_SEGMENTS = 120;
    const LAVA_GLOW_WIDTH = 24;
    const LAVA_OUTER_WIDTH = 16;
    const LAVA_CORE_WIDTH = 8;

    // Atmosphere
    scene.fog = new FogExp2(0x52160a, 0.0025);
    scene.background = new Color(0x5e180a);

    // ---------- MAIN LOW-POLY ISLAND PLATFORM ----------
    const baseMat = new MeshStandardMaterial({
        color: 0x3a1610,
        roughness: 1,
        metalness: 0,
    });

    const topMat = new MeshStandardMaterial({
        color: 0x5a2218,
        roughness: 1,
        metalness: 0,
    });

    // Thick island base
    const islandBase = new Mesh(
        new CylinderGeometry(
            PLATFORM_RADIUS * 0.94,
            PLATFORM_RADIUS,
            PLATFORM_HEIGHT,
            10
        ),
        baseMat,
    );
    islandBase.position.y = FLOOR_Y - PLATFORM_HEIGHT / 2;
    group.add(islandBase);

    // Top plateau
    const islandTop = new Mesh(
        new CylinderGeometry(
            PLATFORM_RADIUS * 0.98,
            PLATFORM_RADIUS * 0.94,
            2.4,
            10
        ),
        topMat,
    );
    islandTop.position.y = FLOOR_Y + 0.6;
    group.add(islandTop);

    // ---------- LAVA BED ON ORBIT PATH ----------
    const lavaOuterColors = [0xff4a1c, 0xff5f1f, 0xff7700, 0xff2a00];

    for (let i = 0; i < LAVA_SEGMENTS; i++) {
        const t = (i / LAVA_SEGMENTS) * Math.PI * 2;

        // Keep it on the orbit, but add slight wobble so it feels more natural
        const radialOffset =
            Math.sin(t * 3.0) * 2.8 +
            Math.sin(t * 6.0) * 1.1;

        const radius = ORBIT_RADIUS + radialOffset;

        const x = Math.cos(t) * radius;
        const z = Math.sin(t) * radius;

        const nextT = ((i + 1) / LAVA_SEGMENTS) * Math.PI * 2;
        const nextRadialOffset =
            Math.sin(nextT * 3.0) * 2.8 +
            Math.sin(nextT * 6.0) * 1.1;

        const nextRadius = ORBIT_RADIUS + nextRadialOffset;

        const nextX = Math.cos(nextT) * nextRadius;
        const nextZ = Math.sin(nextT) * nextRadius;

        const tangentAngle = Math.atan2(nextX - x, nextZ - z);

        const outerColor = lavaOuterColors[i % lavaOuterColors.length];

        // --- Big glow halo (stronger glow)
        const lavaGlow = new Mesh(
            new PlaneGeometry(LAVA_GLOW_WIDTH, 5.2),
            new MeshBasicMaterial({
                color: 0xff6a1f,
                transparent: true,
                opacity: 0.42,
            }),
        );
        lavaGlow.rotation.x = -Math.PI / 2;
        lavaGlow.rotation.z = tangentAngle;
        lavaGlow.position.set(x, FLOOR_Y + 0.02, z);
        group.add(lavaGlow);

        // --- Outer lava band
        const lavaOuter = new Mesh(
            new PlaneGeometry(LAVA_OUTER_WIDTH, 4.0),
            new MeshStandardMaterial({
                color: outerColor,
                emissive: new Color(outerColor),
                emissiveIntensity: 2.8,
                roughness: 0.35,
                metalness: 0,
            }),
        );
        lavaOuter.rotation.x = -Math.PI / 2;
        lavaOuter.rotation.z = tangentAngle;
        lavaOuter.position.set(x, FLOOR_Y + 0.04, z);
        group.add(lavaOuter);

        // --- Bright core
        const lavaCore = new Mesh(
            new PlaneGeometry(LAVA_CORE_WIDTH, 2.5),
            new MeshStandardMaterial({
                color: 0xffe08a,
                emissive: new Color(0xffa033),
                emissiveIntensity: 3.6,
                roughness: 0.15,
                metalness: 0,
            }),
        );
        lavaCore.rotation.x = -Math.PI / 2;
        lavaCore.rotation.z = tangentAngle;
        lavaCore.position.set(x, FLOOR_Y + 0.06, z);
        group.add(lavaCore);

        // --- Hotspots
        if (i % 4 === 0) {
            const hotspot = new Mesh(
                new PlaneGeometry(LAVA_CORE_WIDTH * 0.42, 1.2),
                new MeshStandardMaterial({
                    color: 0xffffcc,
                    emissive: new Color(0xffcc55),
                    emissiveIntensity: 4.2,
                    roughness: 0.08,
                    metalness: 0,
                }),
            );
            hotspot.rotation.x = -Math.PI / 2;
            hotspot.rotation.z = tangentAngle;
            hotspot.position.set(x, FLOOR_Y + 0.08, z);
            group.add(hotspot);
        }

        // --- Sparse point lights
        if (i % 6 === 0) {
            const lavaLight = new PointLight(0xff6622, 6.5, 28);
            lavaLight.position.set(x, FLOOR_Y + 2.0, z);
            group.add(lavaLight);
        }
    }

    // ---------- VOLCANO HELPERS ----------
    const volcanoBodyMat = new MeshStandardMaterial({
        color: 0x6a2a1d,
        roughness: 0.95,
        metalness: 0,
    });

    const volcanoRimMat = new MeshStandardMaterial({
        color: 0x7a3420,
        roughness: 0.9,
        metalness: 0,
    });

    const craterLavaMat = new MeshStandardMaterial({
        color: 0xff7a22,
        emissive: new Color(0xff6a22),
        emissiveIntensity: 3.2,
        roughness: 0.2,
        metalness: 0,
    });

    const createVolcano = (x, z, baseRadius, height) => {
        const volcano = new Group();

        // Main volcano stump
        const body = new Mesh(
            new CylinderGeometry(
                baseRadius * 0.58,
                baseRadius,
                height,
                8
            ),
            volcanoBodyMat.clone(),
        );
        body.position.y = FLOOR_Y + height / 2;
        volcano.add(body);

        // Top rim
        const rim = new Mesh(
            new CylinderGeometry(
                baseRadius * 0.76,
                baseRadius * 0.86,
                1.2,
                8
            ),
            volcanoRimMat.clone(),
        );
        rim.position.y = FLOOR_Y + height;
        volcano.add(rim);

        // Crater lava
        const crater = new Mesh(
            new CylinderGeometry(
                baseRadius * 0.42,
                baseRadius * 0.50,
                0.9,
                8
            ),
            craterLavaMat.clone(),
        );
        crater.position.y = FLOOR_Y + height - 0.05;
        volcano.add(crater);

        // Crater glow light
        const craterLight = new PointLight(0xff7a22, 8, 26);
        craterLight.position.set(0, FLOOR_Y + height + 1.8, 0);
        volcano.add(craterLight);

        volcano.position.set(x, 0, z);
        group.add(volcano);
    };

    // ---------- REAL VOLCANOES ----------
    // Place them near the path but not directly blocking it
    createVolcano(-48, -28, 10, 13);
    createVolcano(46, -16, 11, 15);
    createVolcano(52, 34, 9, 12);
    createVolcano(-26, 56, 8, 10);
    createVolcano(0, -62, 14, 18);

    // ---------- CHUNKY LOW-POLY ROCKS ----------
    const rockMat = new MeshStandardMaterial({
        color: 0x4a2016,
        roughness: 0.95,
        metalness: 0,
    });

    for (let i = 0; i < 28; i++) {
        const angle = Math.random() * Math.PI * 2;

        // Keep rocks outside the clean flight band
        const radius =
            ORBIT_RADIUS +
            (Math.random() > 0.5 ? 18 : -18) +
            (Math.random() - 0.5) * 18;

        const size = 2.8 + Math.random() * 5.5;

        const rock = new Mesh(
            new DodecahedronGeometry(size, 0),
            rockMat.clone(),
        );

        rock.position.set(
            Math.cos(angle) * radius,
            FLOOR_Y + size * 0.35,
            Math.sin(angle) * radius,
        );

        rock.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI,
        );

        group.add(rock);
    }

    // ---------- EDGE CLIFF CHUNKS ----------
    for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2;
        const radius = PLATFORM_RADIUS - 8 + Math.random() * 4;
        const h = 8 + Math.random() * 12;
        const r = 4 + Math.random() * 5;

        const cliff = new Mesh(
            new CylinderGeometry(r * 0.82, r, h, 6),
            rockMat.clone(),
        );

        cliff.position.set(
            Math.cos(angle) * radius,
            FLOOR_Y + h / 2 - 2,
            Math.sin(angle) * radius,
        );

        group.add(cliff);
    }

    return group;
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
	scene.fog = new FogExp2(0x1a1030, 0.006);
	scene.background = new Color(0x140c24);

	const fillLight1 = new PointLight(0x7a5cff, 3.5, 120);
	fillLight1.position.set(0, 18, 0);
	group.add(fillLight1);

	const fillLight2 = new PointLight(0x35d0ff, 2.5, 90);
	fillLight2.position.set(0, 8, -20);
	group.add(fillLight2);

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
		color: 0x20163a,
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
	const wallMat = new MeshStandardMaterial({ color: 0x181030, roughness: 0.95 });
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
	const rockMat = new MeshStandardMaterial({ color: 0x2a1848, roughness: 0.9 });
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
			emissiveIntensity: 1.6,
			roughness: 0.08,
			metalness: 0.7,
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
			const light = new PointLight(color, 7, 30);
			light.position.copy(crystal.position);
			group.add(light);
		}
	}

	return group;

}


