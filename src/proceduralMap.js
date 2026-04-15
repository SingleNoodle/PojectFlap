/**
 * Procedural cave environment generator for levels 3 and 4.
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
//const CAVE_HALF_W = 52;
//const CAVE_HALF_D = 75;
const FLOOR_Y = 0;
const CEILING_Y = 30;
//const CAVE_H = CEILING_Y - FLOOR_Y;

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
/**
 * creates the molten rift scene for level 4 procedural generated
 * @param {*} scene 
 * @returns group object
 */
export function createMoltenRift(scene) {
    const group = new Group();
    group.name = 'proceduralMoltenRift';

    const FLOOR_Y = 0;

    // Gameplay orbit
    const ORBIT_RADIUS = 34;

    // Island footprint
    const PLATFORM_RADIUS = 92;
    const PLATFORM_HEIGHT = 8;

    // Raise lava clearly above the top plateau so it is visible
    const LAVA_SURFACE_Y = FLOOR_Y + 2.8;

    // Orbit lava path settings
    const LAVA_SEGMENTS = 72;
    const LAVA_GLOW_WIDTH = 34;
    const LAVA_OUTER_WIDTH = 22;
    const LAVA_CORE_WIDTH = 12;

    // Central lava lake settings
    const LAKE_GLOW_RADIUS = 42;
    const LAKE_OUTER_RADIUS = 34;
    const LAKE_CORE_RADIUS = 26;

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

    const islandBase = new Mesh(
        new CylinderGeometry(
            PLATFORM_RADIUS * 0.94,
            PLATFORM_RADIUS,
            PLATFORM_HEIGHT,
            10
        ),
        baseMat
    );
    islandBase.position.y = FLOOR_Y - PLATFORM_HEIGHT / 2;
    group.add(islandBase);

    const islandTop = new Mesh(
        new CylinderGeometry(
            PLATFORM_RADIUS * 0.98,
            PLATFORM_RADIUS * 0.94,
            2.4,
            10
        ),
        topMat
    );
    islandTop.position.y = FLOOR_Y + 0.6;
    group.add(islandTop);

    // ---------- SHARED LAVA MATERIALS ----------
    // Main lake glow
    const lakeGlowMat = new MeshBasicMaterial({
        color: 0xff6a22,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
    });

    const lakeBodyMat = new MeshStandardMaterial({
        color: 0xfff0a0,
        emissive: new Color(0xffc040),
        emissiveIntensity: 5.8,
        roughness: 0.05,
        metalness: 0,
        depthWrite: false,
    });

    const hotspotMat = new MeshStandardMaterial({
        color: 0xffffcc,
        emissive: new Color(0xffdd77),
        emissiveIntensity: 5.5,
        roughness: 0.04,
        metalness: 0,
        depthWrite: false,
    });

    // Make the lava path match the bright center-core palette
    const pathGlowMat = new MeshBasicMaterial({
        color: 0xffe08a,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
    });

    const pathOuterMat = new MeshStandardMaterial({
        color: 0xfff0a0,
        emissive: new Color(0xffc040),
        emissiveIntensity: 5.8,
        roughness: 0.05,
        metalness: 0,
        depthWrite: false,
    });

    const pathCoreMat = new MeshStandardMaterial({
        color: 0xffffcc,
        emissive: new Color(0xffdd77),
        emissiveIntensity: 6.6,
        roughness: 0.04,
        metalness: 0,
        depthWrite: false,
    });

    // ---------- CENTRAL LAVA LAKE ----------
    const lakeGlow = new Mesh(
        new CylinderGeometry(LAKE_GLOW_RADIUS, LAKE_GLOW_RADIUS, 0.24, 28),
        lakeGlowMat
    );
    lakeGlow.position.y = LAVA_SURFACE_Y + 0.0;
    lakeGlow.renderOrder = 1;
    group.add(lakeGlow);

    const lakeBody = new Mesh(
        new CylinderGeometry(LAKE_OUTER_RADIUS, LAKE_OUTER_RADIUS, 0.32, 28),
        lakeBodyMat
    );
    lakeBody.position.y = LAVA_SURFACE_Y + 0.08;
    lakeBody.renderOrder = 2;
    group.add(lakeBody);

    const lakeHotCenter = new Mesh(
        new CylinderGeometry(
            LAKE_CORE_RADIUS * 0.72,
            LAKE_CORE_RADIUS * 0.72,
            0.38,
            28
        ),
        hotspotMat
    );
    lakeHotCenter.position.y = LAVA_SURFACE_Y + 0.16;
    lakeHotCenter.renderOrder = 3;
    group.add(lakeHotCenter);

    const lakeLight = new PointLight(0xff9a33, 12, 65);
    lakeLight.position.set(0, LAVA_SURFACE_Y + 3.4, 0);
    group.add(lakeLight);

    // ---------- LAVA BED ON ORBIT PATH ----------
    for (let i = 0; i < LAVA_SEGMENTS; i++) {
        const t = (i / LAVA_SEGMENTS) * Math.PI * 2;

        // Slight wobble so the path feels more natural
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

        // Big bright halo
        const lavaGlow = new Mesh(
            new PlaneGeometry(LAVA_GLOW_WIDTH, 6.2),
            pathGlowMat
        );
        lavaGlow.rotation.x = -Math.PI / 2;
        lavaGlow.rotation.z = tangentAngle;
        lavaGlow.position.set(x, LAVA_SURFACE_Y + 0.0, z);
        lavaGlow.renderOrder = 4;
        group.add(lavaGlow);

        // Hot outer band
        const lavaOuter = new Mesh(
            new PlaneGeometry(LAVA_OUTER_WIDTH, 4.8),
            pathOuterMat
        );
        lavaOuter.rotation.x = -Math.PI / 2;
        lavaOuter.rotation.z = tangentAngle;
        lavaOuter.position.set(x, LAVA_SURFACE_Y + 0.08, z);
        lavaOuter.renderOrder = 5;
        group.add(lavaOuter);

        // White-hot core
        const lavaCore = new Mesh(
            new PlaneGeometry(LAVA_CORE_WIDTH, 3.0),
            pathCoreMat
        );
        lavaCore.rotation.x = -Math.PI / 2;
        lavaCore.rotation.z = tangentAngle;
        lavaCore.position.set(x, LAVA_SURFACE_Y + 0.16, z);
        lavaCore.renderOrder = 6;
        group.add(lavaCore);

        // Extra glowing hotspots
        if (i % 6 === 0) {
            const hotspot = new Mesh(
                new PlaneGeometry(LAVA_CORE_WIDTH * 0.52, 1.5),
                hotspotMat
            );
            hotspot.rotation.x = -Math.PI / 2;
            hotspot.rotation.z = tangentAngle;
            hotspot.position.set(x, LAVA_SURFACE_Y + 0.24, z);
            hotspot.renderOrder = 7;
            group.add(hotspot);
        }

        // Sparse lights for glow without too much performance cost
        if (i % 12 === 0) {
            const lavaLight = new PointLight(0xff7a22, 5.5, 24);
            lavaLight.position.set(x, LAVA_SURFACE_Y + 2.0, z);
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

        const body = new Mesh(
            new CylinderGeometry(
                baseRadius * 0.58,
                baseRadius,
                height,
                8
            ),
            volcanoBodyMat.clone()
        );
        body.position.y = FLOOR_Y + height / 2;
        volcano.add(body);

        const rim = new Mesh(
            new CylinderGeometry(
                baseRadius * 0.76,
                baseRadius * 0.86,
                1.2,
                8
            ),
            volcanoRimMat.clone()
        );
        rim.position.y = FLOOR_Y + height;
        volcano.add(rim);

        const crater = new Mesh(
            new CylinderGeometry(
                baseRadius * 0.42,
                baseRadius * 0.50,
                0.9,
                8
            ),
            craterLavaMat.clone()
        );
        crater.position.y = FLOOR_Y + height - 0.05;
        volcano.add(crater);

        const craterLight = new PointLight(0xff7a22, 5, 18);
        craterLight.position.set(0, FLOOR_Y + height + 1.8, 0);
        volcano.add(craterLight);

        volcano.position.set(x, 0, z);
        group.add(volcano);
    };

    // ---------- VOLCANOES ----------
    createVolcano(-48, -28, 10, 13);
    createVolcano(46, -16, 11, 15);
    createVolcano(52, 34, 9, 12);
    createVolcano(-26, 56, 8, 10);
    createVolcano(0, -62, 14, 18);

    // ---------- ROCKS ----------
    const rockMat = new MeshStandardMaterial({
        color: 0x4a2016,
        roughness: 0.95,
        metalness: 0,
    });

    for (let i = 0; i < 16; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius =
            ORBIT_RADIUS +
            (Math.random() > 0.5 ? 18 : -18) +
            (Math.random() - 0.5) * 18;

        const size = 2.8 + Math.random() * 5.5;

        const rock = new Mesh(
            new DodecahedronGeometry(size, 0),
            rockMat.clone()
        );

        rock.position.set(
            Math.cos(angle) * radius,
            FLOOR_Y + size * 0.35,
            Math.sin(angle) * radius
        );

        rock.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );

        group.add(rock);
    }

    // ---------- EDGE CLIFF CHUNKS ----------
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const radius = PLATFORM_RADIUS - 8 + Math.random() * 4;
        const h = 8 + Math.random() * 12;
        const r = 4 + Math.random() * 5;

        const cliff = new Mesh(
            new CylinderGeometry(r * 0.82, r, h, 6),
            rockMat.clone()
        );

        cliff.position.set(
            Math.cos(angle) * radius,
            FLOOR_Y + h / 2 - 2,
            Math.sin(angle) * radius
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

    const rand = (min, max) => Math.random() * (max - min) + min;

    // Keep a clear gameplay lane around the orbit path
    const SAFE_ORBIT_RADIUS = 34;
    const SAFE_ORBIT_THICKNESS = 12;

    const isNearSafeOrbit = (x, z) => {
        const r = Math.hypot(x, z);
        return Math.abs(r - SAFE_ORBIT_RADIUS) < SAFE_ORBIT_THICKNESS;
    };

    const isInSafeCenter = (x, z) => {
        return Math.hypot(x, z) < 18;
    };

    // Brighter cave atmosphere
    scene.fog = new FogExp2(0x222a3a, 0.0055);
    scene.background = new Color(0x202739);


    // ---------- LIGHTING ----------
    // Stronger cool ambient fill
    const coolFill = new PointLight(0x7ca4ff, 3.8, 180);
    coolFill.position.set(-24, 18, -42);
    group.add(coolFill);

    // Stronger warm opening / sunlight feel
    const warmSun = new PointLight(0xffd7a6, 7.2, 120);
    warmSun.position.set(10, 24, 6);
    group.add(warmSun);

    // Crystal bounce light
    const crystalFill = new PointLight(0x8be3ff, 4.2, 110);
    crystalFill.position.set(18, 10, 10);
    group.add(crystalFill);

    // Secondary warm side fill
    const warmFill2 = new PointLight(0xffc98a, 3.2, 90);
    warmFill2.position.set(30, 14, -8);
    group.add(warmFill2);

    // Extra cool fill deeper in cave
    const coolFill2 = new PointLight(0x4dc3ff, 2.8, 95);
    coolFill2.position.set(-12, 10, 36);
    group.add(coolFill2);

    // ---------- MATERIALS ----------
    const rockDarkMat = new MeshStandardMaterial({
        color: 0x2e2019,
        roughness: 1,
        metalness: 0,
    });

    const rockMidMat = new MeshStandardMaterial({
        color: 0x5a3a28,
        roughness: 1,
        metalness: 0,
    });

    const rockWarmMat = new MeshStandardMaterial({
        color: 0x7a5536,
        roughness: 1,
        metalness: 0,
    });

    const waterMat = new MeshStandardMaterial({
        color: 0x2e7090,
        emissive: new Color(0x1f5269),
        emissiveIntensity: 1.5,
        roughness: 0.08,
        metalness: 0,
        transparent: true,
        opacity: 0.95,
    });

    const lightBeamMat = new MeshBasicMaterial({
        color: 0xffefc0,
        transparent: true,
        opacity: 0.24,
        side: DoubleSide,
        depthWrite: false,
    });

    const vineMat = new MeshStandardMaterial({
        color: 0x24321a,
        roughness: 1,
        metalness: 0,
    });

    // ---------- FLOOR ----------
    const floor = new Mesh(
        new PlaneGeometry(140, 180, 1, 1),
        rockDarkMat
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = FLOOR_Y;
    group.add(floor);

    // ---------- WATER POOL ----------
    // Keep it off to one side so it adds atmosphere without interfering
    const waterPool = new Mesh(
        new PlaneGeometry(40, 20, 1, 1),
        waterMat
    );
    waterPool.rotation.x = -Math.PI / 2;
    waterPool.position.set(-22, FLOOR_Y + 0.06, 24);
    group.add(waterPool);

    const waterGlow = new PointLight(0x4fcfff, 2.8, 50);
    waterGlow.position.set(-22, FLOOR_Y + 2.2, 24);
    group.add(waterGlow);

    for (let i = 0; i < 10; i++) {
        const rock = new Mesh(
            new DodecahedronGeometry(rand(1.8, 4.2), 0),
            i % 2 === 0 ? rockMidMat : rockWarmMat
        );
        rock.position.set(
            -22 + rand(-18, 18),
            FLOOR_Y + rand(0.8, 2.2),
            24 + rand(-10, 10)
        );
        rock.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
        rock.scale.set(rand(0.8, 1.3), rand(0.8, 1.6), rand(0.8, 1.3));
        group.add(rock);
    }

    // ---------- PERIMETER ROCK WALLS ----------
    for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2;
        const radiusX = 52 + rand(-4, 8);
        const radiusZ = 74 + rand(-4, 8);

        const x = Math.cos(angle) * radiusX;
        const z = Math.sin(angle) * radiusZ;
        const h = rand(14, 28);
        const r = rand(6, 12);

        const wallChunk = new Mesh(
            new CylinderGeometry(r * 0.72, r, h, 6),
            i % 3 === 0 ? rockWarmMat : rockMidMat
        );
        wallChunk.position.set(x, FLOOR_Y + h / 2 - 2, z);
        wallChunk.rotation.y = rand(0, Math.PI);
        group.add(wallChunk);

        if (i % 2 === 0) {
            const boulder = new Mesh(
                new DodecahedronGeometry(rand(4, 8), 0),
                rockDarkMat
            );
            boulder.position.set(
                x + rand(-4, 4),
                FLOOR_Y + rand(4, 14),
                z + rand(-4, 4)
            );
            boulder.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
            boulder.scale.set(rand(0.8, 1.4), rand(0.8, 1.6), rand(0.8, 1.4));
            group.add(boulder);
        }
    }

    // ---------- CEILING CHUNKS ----------
    for (let i = 0; i < 14; i++) {
        const x = rand(-42, 42);
        const z = rand(-62, 62);

        if (Math.hypot(x - 8, z - 4) < 18 || isInSafeCenter(x, z)) {
            continue;
        }

        const chunk = new Mesh(
            new DodecahedronGeometry(rand(6, 12), 0),
            i % 2 === 0 ? rockMidMat : rockDarkMat
        );
        chunk.position.set(x, rand(24, 30), z);
        chunk.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
        chunk.scale.set(rand(1.1, 1.7), rand(0.6, 1.1), rand(1.1, 1.7));
        group.add(chunk);
    }

    // ---------- PILLARS ----------
    const pillarPositions = [
        [-30, -34],
        [-20, 42],
        [22, -46],
        [34, 36],
        [-44, 8],
        [44, -4],
    ];

    for (const [px, pz] of pillarPositions) {
        const h = rand(15, 24);
        const r = rand(3.2, 5.2);

        const pillar = new Mesh(
            new CylinderGeometry(r * 0.84, r, h, 7),
            Math.random() > 0.5 ? rockWarmMat : rockMidMat
        );
        pillar.position.set(px, FLOOR_Y + h / 2, pz);
        group.add(pillar);

        const topCap = new Mesh(
            new DodecahedronGeometry(rand(4, 6.5), 0),
            rockDarkMat
        );
        topCap.position.set(px + rand(-1, 1), FLOOR_Y + h + 1.5, pz + rand(-1, 1));
        topCap.scale.set(rand(1.1, 1.6), rand(0.8, 1.3), rand(1.1, 1.6));
        group.add(topCap);

        const baseCap = new Mesh(
            new DodecahedronGeometry(rand(3, 5), 0),
            rockMidMat
        );
        baseCap.position.set(px + rand(-1, 1), FLOOR_Y + 1.4, pz + rand(-1, 1));
        baseCap.scale.set(rand(1.1, 1.5), rand(0.7, 1.1), rand(1.1, 1.5));
        group.add(baseCap);
    }

    // ---------- STALACTITES ----------
    for (let i = 0; i < 42; i++) {
        const x = rand(-48, 48);
        const z = rand(-70, 70);

        if (Math.hypot(x - 8, z - 4) < 15 || isNearSafeOrbit(x, z) || isInSafeCenter(x, z)) {
            continue;
        }

        const h = rand(2.5, 7.2);
        const r = rand(0.25, 1.0);

        const stal = new Mesh(
            new ConeGeometry(r, h, 5 + Math.floor(Math.random() * 4)),
            Math.random() > 0.5 ? rockDarkMat : rockMidMat
        );
        stal.position.set(x, CEILING_Y - h / 2 + rand(-2, 1), z);
        stal.rotation.z = Math.PI;
        group.add(stal);
    }

    // ---------- STALAGMITES ----------
    for (let i = 0; i < 18; i++) {
        const x = rand(-46, 46);
        const z = rand(-68, 68);

        if (isNearSafeOrbit(x, z) || isInSafeCenter(x, z)) {
            continue;
        }

        const h = rand(1.0, 4.8);
        const r = rand(0.2, 0.8);

        const stag = new Mesh(
            new ConeGeometry(r, h, 5 + Math.floor(Math.random() * 4)),
            Math.random() > 0.5 ? rockMidMat : rockWarmMat
        );
        stag.position.set(x, FLOOR_Y + h / 2, z);
        group.add(stag);
    }

    // ---------- CRYSTAL CLUSTERS ----------
    for (let i = 0; i < 12; i++) {
        const color = CRYSTAL_COLORS[i % CRYSTAL_COLORS.length];
        const crystalMat = new MeshStandardMaterial({
            color,
            emissive: new Color(color),
            emissiveIntensity: 3.0,
            roughness: 0.06,
            metalness: 0.72,
        });

        let cx = rand(18, 44);
        let cz = rand(-36, 44);

        if (isNearSafeOrbit(cx, cz) || isInSafeCenter(cx, cz)) {
            cx += 16;
            cz += 16;
        }

        const clusterCount = 2 + Math.floor(Math.random() * 3);

        for (let j = 0; j < clusterCount; j++) {
            const size = rand(0.5, 1.15);
            const crystal = new Mesh(
                new IcosahedronGeometry(size, 0),
                crystalMat
            );
            crystal.position.set(
                cx + rand(-2, 2),
                FLOOR_Y + rand(0.8, 3.8),
                cz + rand(-2, 2)
            );
            crystal.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
            group.add(crystal);
        }

        const light = new PointLight(color, 9, 28);
        light.position.set(cx, FLOOR_Y + rand(2, 4), cz);
        group.add(light);
    }

    // ---------- HANGING VINES ----------
    for (let i = 0; i < 6; i++) {
        const len = rand(3, 7);
        const vine = new Mesh(
            new CylinderGeometry(0.04, 0.08, len, 5),
            vineMat
        );
        vine.position.set(
            rand(8, 20),
            CEILING_Y - len / 2 + rand(-2, 0),
            rand(-6, 14)
        );
        vine.rotation.z = rand(-0.22, 0.22);
        group.add(vine);
    }

    // ---------- LIGHT SHAFTS ----------
    for (let i = 0; i < 4; i++) {
        const beam = new Mesh(
            new PlaneGeometry(rand(12, 18), rand(28, 36)),
            lightBeamMat
        );
        beam.position.set(
            rand(2, 14),
            rand(13, 18),
            rand(-2, 10)
        );
        beam.rotation.x = Math.PI / 2.18;
        beam.rotation.z = rand(-0.28, 0.18);
        group.add(beam);
    }

    return group;
}



