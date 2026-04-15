/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Constants, GlobalComponent } from './global';
import {
    BackSide,
    Group,
    Mesh,
    MeshBasicMaterial,
    PlaneGeometry,
    SRGBColorSpace,
    SphereGeometry,
    TextureLoader,
    Vector3,
    Quaternion,
} from 'three';
import { createNeonRing, createProceduralCave, createMoltenRift } from './proceduralMap';

import { PlayerComponent } from './player';
import { System } from 'elics';
import { Text } from 'troika-three-text';
import { generateUUID } from 'three/src/math/MathUtils';
import localforage from 'localforage';

const SCORE_BOARD_TEXTURE = new TextureLoader().load(
	Constants.SCORE_BOARD_TEXTURE_PATH,
);
SCORE_BOARD_TEXTURE.colorSpace = SRGBColorSpace;

/**
 * GameSystem class handles the main game logic.
 */
export class GameSystem extends System {
	init() {
        this._initializeProperties();
        this._cacheScoreboardElements();
        this._loadStoredData();
        this._initializeTransitionOverlay();
    }


	_initializeProperties() {
		this._activeLevel = Constants.LEVELS[Constants.DEFAULT_LEVEL_ID];
		this._flapData = {
			left: { y: null, distance: 0, flaps: 0 },
			right: { y: null, distance: 0, flaps: 0 },
		};
		
		this._ring = null;
		this._ringNumber = null;
		this._ringTimer = this._activeLevel.ringInterval;
		this._scoreBoard = null;
		this._levelIndicator = null;
		this._transitionScreen = null;
		this._transitionScreenText = null;
		this._playerId = null;
		this._record = 0;
		this._latest = 0;
		this._currentRunScore = 0;
		this._highestScoreElement = null;
		this._latestScoreElement = null;
		this._currentScoreElement = null;

		this._currentScore = createText(0);
		this._recordScore = createText(0);
		
		//this._isLevelTransitioning = false;

		this._transitionGraceTimer =0;
		//Timer to help orientate players after level transition by temporarily pausing ring movement and score updates.
		
		this._levelTransition = null; 
		// Will hold data for smooth level transitions when implemented
		this._tmpVec3 = new Vector3();
		this._tmpVec3B = new Vector3();
		this._tmpQuat = new Quaternion();

	
		this._worldRecord = createText(0);
		this._ranking = createText(0);
		this._levelName = createText(this._activeLevel.name, 0.09);
		
		// Create text elements for last 3 sessions
		this._sessionTexts = [
			createText(''), // Session 1
			createText(''), // Session 2
			createText(''), // Session 3
		];

		this._isLevelTransitioning = false;
        this._isRestarting = false;
        this._pointAudio = null;
        this._gameOverAudio = null;
        this._initializeAudio();

	}

	_initializeAudio() {
		this._pointAudio = new Audio(Constants.SCORE_CUE_AUDIO_PATH);
		this._pointAudio.preload = 'auto';
		this._pointAudio.volume = Constants.SCORE_CUE_AUDIO_VOLUME;
		this._gameOverAudio = new Audio(Constants.GAME_OVER_AUDIO_PATH);
		this._gameOverAudio.preload = 'auto';
		this._gameOverAudio.volume = Constants.GAME_OVER_AUDIO_VOLUME;
	}

	_playPointAudio() {
		if (!this._pointAudio) {
			return;
		}

		this._pointAudio.currentTime = 0;
		this._pointAudio.play().catch(() => {
			// Ignore play interruptions from browser autoplay policies.
		});
	}

	_playGameOverAudio() {
		if (!this._gameOverAudio) {
			return;
		}

		this._gameOverAudio.currentTime = 0;
		this._gameOverAudio.play().catch(() => {
			// Ignore play interruptions from browser autoplay policies.
		});
	}

	_cacheScoreboardElements() {
        this._highestScoreElement = document.getElementById('highest-score-value');
        this._latestScoreElement = document.getElementById('latest-score-value');
        this._currentScoreElement = document.getElementById('current-score-value');

        // Re-show the browser scoreboard fields near the Enter VR button area
        if (this._highestScoreElement && this._highestScoreElement.parentElement) {
            this._highestScoreElement.parentElement.style.display = '';
        }
        if (this._latestScoreElement && this._latestScoreElement.parentElement) {
            this._latestScoreElement.parentElement.style.display = '';
        }
        if (this._currentScoreElement && this._currentScoreElement.parentElement) {
            this._currentScoreElement.parentElement.style.display = '';
        }

        this._updateScoreboardUI();
    }

	_updateScoreboardUI() {
        if (this._highestScoreElement) {
            this._highestScoreElement.textContent = this._record.toString();
        }

        if (this._latestScoreElement) {
            this._latestScoreElement.textContent = this._latest.toString();
        }

        if (this._currentScoreElement) {
            this._currentScoreElement.textContent = this._currentRunScore.toString();
        }
    }


	_loadStoredData() {
		localforage.getItem(Constants.RECORD_SCORE_KEY).then((score) => {
			if (typeof score === 'number') {
				this._recordScore.text = score.toString();
				this._record = score;
				this._recordScore.sync();
				this._updateScoreboardUI();
			}
		});

		localforage.getItem(Constants.LATEST_SCORE_KEY).then((score) => {
            if (typeof score === 'number') {
                this._latest = score;
                this._currentScore.text = score.toString();
                this._currentScore.sync();
                this._updateScoreboardUI();
            }
        });

		localforage.getItem(Constants.PLAYER_ID_KEY).then((playerId) => {
			if (playerId) {
				this._playerId = playerId;
			} else {
				this._playerId = generateUUID();
				localforage.setItem(Constants.PLAYER_ID_KEY, this._playerId);
			}
		});

	}

	update(delta) {
		const global = this.getEntities(this.queries.global)[0].getComponent(
			GlobalComponent,
		);

		const player = this.getEntities(this.queries.player)[0].getComponent(
			PlayerComponent,
		);

		this._setupScoreBoard(player);
		this._manageGameStates(global, player, delta);
	}

	_setupScoreBoard(player) {
		if (!this._scoreBoard) {
			this._scoreBoard = new Mesh(
				new PlaneGeometry(2, 1),
				new MeshBasicMaterial({ map: SCORE_BOARD_TEXTURE, transparent: true }),
			);
			player.space.add(this._scoreBoard);
			this._scoreBoard.position.set(0, 1.5, -2);

			// Add score texts to the scoreboard
			this._addTextToScoreBoard(this._currentScore, -0.15, -0.22);
			this._addTextToScoreBoard(this._recordScore, -0.15, -0.36);
			this._addTextToScoreBoard(this._ranking, 0.8, -0.22);
			this._addTextToScoreBoard(this._worldRecord, 0.8, -0.36);
		}
	}




	_addTextToScoreBoard(text, x, y) {
		this._scoreBoard.add(text);
		text.position.set(x, y, 0.001);
	}


	_manageGameStates(global, player, delta) {
        this._activeLevel =
            global.level || Constants.LEVELS[Constants.DEFAULT_LEVEL_ID];

        const motionProfile =
            global.motionProfile || Constants.MOTION_PROFILES.default;

        const isPresenting = global.renderer.xr.isPresenting;
        const rotator = player.space.parent;

        this._scoreBoard.visible = false;

        // Create and position score HUD (bottom-left in view)
        if (!this._levelIndicator) {
            this._levelIndicator = createText('Score: 0', 0.08);
            global.camera.add(this._levelIndicator);

            // Bottom-left placement
            this._levelIndicator.anchorX = 'left';
            this._levelIndicator.anchorY = 'middle';
            this._levelIndicator.position.set(-0.75, -0.42, -1.4);
            this._levelIndicator.sync();
        }

        // Create debug display
        // Commented out for now so only the score HUD is visible.
        /*
        if (!this._debugDisplay) {
            this._debugDisplay = createText('Score: 0', 0.06);
            global.camera.add(this._debugDisplay);
            this._debugDisplay.position.set(0, 0.25, -1.4);
        }
        */

        this._ensureTransitionScreen(global);
        this._updateGameplayHud(global);

        // Initialize ring once
        if (!this._ring && global.scene.getObjectByName('ring')) {
            this._initializeRing(player, global, rotator, motionProfile);
        }

        if (this._levelTransition) {
            this._updateLevelTransition(player, global, rotator, delta, motionProfile);
            return;
        }

        if (global.gameState === 'lobby') {
            this._handleLobbyState(player, rotator, isPresenting, global, motionProfile);
        } else {
            this._handleInGameState(player, global, rotator, delta, motionProfile);
        }
    }

	_initializeRing(player, global, rotator, motionProfile) {
		this._ring = global.scene.getObjectByName('ring');
		this._ringRotator = new Group();
		this._ringRotator.add(this._ring);
		this._ring.position.set(0, 4, 34);
		//for changing the speed and direction of ring rotation based on level settings and motion profile
		const effectiveAngularSpeed =
			motionProfile.angularSpeed * this._getAngularDirection();

		this._ringRotator.quaternion.copy(rotator.quaternion);
		this._ringRotator.rotateY(
			effectiveAngularSpeed * this._activeLevel.ringInterval,
		);
		
		this._ring.position.y = player.space.position.y;
		this._ring.scale.setScalar(this._activeLevel.startingRingScale);

		const ringNumber = new Text();
		this._ring.add(ringNumber);
		ringNumber.text = '0';
		ringNumber.fontSize = 0.6;
		ringNumber.anchorX = 'center';
		ringNumber.anchorY = 'middle';
		ringNumber.rotateY(Math.PI);
		ringNumber.sync();

		this._ringNumber = ringNumber;
		global.scene.add(this._ringRotator);
	}

	_handleLobbyState(player, rotator, isPresenting, global, motionProfile) {
        if (!isPresenting) {
            return;
        }

        // Show original in-world scoreboard in lobby
        if (this._scoreBoard) {
            this._scoreBoard.visible = true;
        }

        // Hide bottom-left HUD while the scoreboard is visible
        if (this._levelIndicator) {
            this._levelIndicator.visible = false;
        }

        // Do not allow a start until the ring system is fully ready
        if (!this._ring || !this._ringRotator || !this._ringNumber) {
            return;
        }

        for (let entry of Object.entries(player.controllers)) {
            const [handedness, controller] = entry;
            const thisFrameY = controller.targetRaySpace.position.y;
            const lastFrameY = this._flapData[handedness].y;

            this._manageFlapData(handedness, thisFrameY, lastFrameY);

            if (
                this._flapData[handedness].flaps >= Constants.NUM_FLAPS_TO_START_GAME
            ) {
                this._startGame(global, rotator, motionProfile);
                break;
            }
        }
    }


	_manageFlapData(handedness, thisFrameY, lastFrameY) {
		if (lastFrameY != null) {
			if (thisFrameY <= lastFrameY) {
				// flapping
				this._flapData[handedness].distance += lastFrameY - thisFrameY;
			} else {
				// flap has ended
				if (this._flapData[handedness].distance >= 0.5) {
					this._flapData[handedness].flaps += 1;
				} else if (this._flapData[handedness].distance > 0.1) {
					this._flapData[handedness].flaps = 0;
				}
				this._flapData[handedness].y = null;
				this._flapData[handedness].distance = 0;
			}
		}
		this._flapData[handedness].y = thisFrameY;
	}

	_startGame(global, rotator, motionProfile) {
        // Prevent accidental double-starts
        if (global.gameState !== 'lobby') {
            return;
        }

        // Guard against null ring state
        if (!this._ring || !this._ringRotator || !this._ringNumber) {
            console.warn('Start blocked: ring system is not ready yet.');
            return;
        }

        global.gameState = 'ingame';
        this._currentRunScore = 0;
        this._updateScoreboardUI();
        this._currentScore.text = '0';
        this._currentScore.sync();

        // Reset flap tracking immediately so stale flap counts don't carry over
        this._flapData = {
            left: { y: null, distance: 0, flaps: 0 },
            right: { y: null, distance: 0, flaps: 0 },
        };

        const effectiveAngularSpeed =
            motionProfile.angularSpeed * this._getAngularDirection();

        const ringLeadMultiplier = this._activeLevel.ringLeadMultiplier ?? 1.0;

        this._ringRotator.quaternion.copy(rotator.quaternion);
        this._ringRotator.rotateY(
            effectiveAngularSpeed *
                this._activeLevel.ringInterval *
                ringLeadMultiplier
        );

        const startingY =
            this._activeLevel.startingRingY !== undefined
                ? this._activeLevel.startingRingY
                : 4;

        this._ring.position.y = startingY;
        this._ring.scale.setScalar(this._activeLevel.startingRingScale);

        if (this._usesLevel4FloorClamp()) {
            this._ring.position.y = this._clampRingYForFloor(
                this._ring.position.y,
                this._activeLevel
            );
        }

        this._ring.visible = true;
        this._ringTimer = this._usesLevel4FloorClamp()
            ? this._activeLevel.ringInterval * ringLeadMultiplier
            : this._activeLevel.ringInterval;

        this._ringNumber.text = '1';
        this._ringNumber.sync();

        if (this._scoreBoard) {
            this._scoreBoard.visible = false;
        }

        if (this._levelIndicator) {
            this._levelIndicator.visible = true;
        }

        this._updateGameplayHud(global);
    }


	_handleInGameState(player, global, rotator, delta, motionProfile) {
        if (global.gameState !== 'ingame') {
            return;
        }

        // Hide old lobby scoreboard during gameplay
        if (this._scoreBoard) {
            this._scoreBoard.visible = false;
        }

        // Re-show bottom-left HUD during gameplay
        if (this._levelIndicator) {
            this._levelIndicator.visible = true;
        }

        if (this._transitionGraceTimer > 0) {
            this._transitionGraceTimer -= delta;

            if (this._transitionGraceTimer < 0) {
                this._transitionGraceTimer = 0;
            }

            return;
        }

        if (this._ring) {
            this._ringTimer -= delta;

            if (this._ringTimer < 0) {
                const ringRadius = this._usesNeonRingHitbox()
                    ? this._getRingPassRadius(this._activeLevel)
                    : this._ring.scale.x / 2;

                if (
                    Math.abs(player.space.position.y - this._ring.position.y) <= ringRadius
                ) {
                    this._updateScore(player, global, rotator, motionProfile);
                } else {
                    this._endGame(player, global);
                }
            }
        }
    }



	_updateScore(player, global, rotator, motionProfile) {
        global.score += 1;
        this._playPointAudio();
        this._currentRunScore = global.score;
        this._updateScoreboardUI();
        this._currentScore.text = global.score.toString();
        this._currentScore.sync();

        if (this._ringNumber) {
            this._ringNumber.text = (global.score + 1).toString();
            this._ringNumber.sync();
        }

        this._updateGameplayHud(global);

        // Debug display
        if (this._debugDisplay) {
            this._debugDisplay.text = `Score: ${global.score} | Level: ${global.levelId} | Active: ${this._activeLevel.name}`;
            this._debugDisplay.sync();
        }

        const currentLevelId = Object.keys(Constants.LEVELS).find(
            (key) => Constants.LEVELS[key] === this._activeLevel
        );

        // Level 1 -> Level 2
        if (
            !this._levelTransition &&
            global.score >= 10 &&
            currentLevelId === 'level-1'
        ) {
            console.log('Level complete! Transitioning to level-2...');
            this._beginLevel2Transition(player, global);
            return;
        }



        // Level 2 -> Level 3
        if (
            !this._isLevelTransitioning &&
            currentLevelId === 'level-2' &&
            global.score >= 12
        ) {
            this._isLevelTransitioning = true;
            console.log('Level complete! Advancing to level-3: Neon Cavern...');
            this._beginLevelTransition('level-3', global);
            this._isLevelTransitioning = false;
            return;
        }



        // Level 3 -> Level 4
        if (
            !this._isLevelTransitioning &&
            currentLevelId === 'level-3' &&
            global.score >= 14
        ) {
            this._isLevelTransitioning = true;
            console.log('Level complete! Advancing to level-4: Molten Rift...');
            this._beginLevelTransition('level-4', global);
            this._isLevelTransitioning = false;
            return;
        }

        const effectiveAngularSpeed =
            motionProfile.angularSpeed * this._getAngularDirection();

        const ringLeadMultiplier = this._activeLevel.ringLeadMultiplier ?? 1.0;

        this._ringRotator.quaternion.copy(rotator.quaternion);
        this._ringRotator.rotateY(
            effectiveAngularSpeed *
                this._activeLevel.ringInterval *
                ringLeadMultiplier
        );

        if (this._usesLevel4FloorClamp()) {
            // Level 4 only: keep ring above lava/floor
            this._ring.scale.multiplyScalar(this._activeLevel.ringShrinkMultiplier);

            const minY = this._activeLevel.ringMinY;
            const maxY = this._activeLevel.ringMaxY;
            const yRange = Math.max(0, maxY - minY);

            let newY = Math.random() * yRange + minY;

            if (this._activeLevel.ringReversed) {
                newY = maxY - (newY - minY);
            }

            newY = this._clampRingYForFloor(newY, this._activeLevel);

            this._ring.position.y = newY;
        } else {
            // Original behavior for levels 1–3
            const yRange = this._activeLevel.ringMaxY - this._activeLevel.ringMinY;
            let newY = Math.random() * yRange + this._activeLevel.ringMinY;

            if (this._activeLevel.ringReversed) {
                newY =
                    this._activeLevel.ringMaxY -
                    (newY - this._activeLevel.ringMinY);
            }

            this._ring.position.y = newY;
            this._ring.scale.multiplyScalar(this._activeLevel.ringShrinkMultiplier);
        }

        // Level 4 places rings farther ahead, so timer must match that distance
        this._ringTimer = this._usesLevel4FloorClamp()
            ? this._activeLevel.ringInterval * ringLeadMultiplier
            : this._activeLevel.ringInterval;
    }

	//old transitioning method for reference, kept in case we want to revert to instant transition or need it for debugging
	/*
	_transitionToLevel2(player, global, rotator, motionProfile) {
		
	const nextLevelId = 'level-2';
    const nextLevel = Constants.LEVELS[nextLevelId];

    global.levelId = nextLevelId;
    global.level = nextLevel;
    this._activeLevel = nextLevel;

    const level2StartY =
        nextLevel.startingRingY !== undefined ? nextLevel.startingRingY : 7;

    // Teleport player to the new level area
    const playerX = 16;
    const playerZ = -22;
    player.space.position.set(playerX, level2StartY, playerZ);

    // Face the opposite direction
    rotator.rotateY(Math.PI);

    // NEW: short grace period so player has time to react
    this._transitionGraceTimer = 1.25;

    // Reposition ring system
    this._ringRotator.quaternion.copy(rotator.quaternion);
    this._ringRotator.rotateY(motionProfile.angularSpeed * nextLevel.ringInterval);

    // IMPORTANT:
    // Spawn the first ring AHEAD of the player, not at the exact same position.
    const firstRingOffsetZ = 20; // tune this (try 20 to 30)
	//fixes ring spawning since player is rotated
    this._ring.position.set(playerX, level2StartY, playerZ + firstRingOffsetZ);

    this._ring.scale.setScalar(nextLevel.startingRingScale);

    // Give extra time before this first ring is evaluated
    this._ringTimer = nextLevel.ringInterval + this._transitionGraceTimer;

    this._ringNumber.text = (global.score + 1).toString();
    this._ringNumber.sync();
	}*/


	_transitionToLevel3(player, global, rotator, motionProfile) {
		const nextLevelId = 'level-3';
		const nextLevel = Constants.LEVELS[nextLevelId];

		// Update active level state
		global.levelId = nextLevelId;
		global.level = nextLevel;
		this._activeLevel = nextLevel;

		// Remove old GLTF scene
		const oldGltfScene = global.scene.getObjectByName('gltfScene');
		if (oldGltfScene) {
			global.scene.remove(oldGltfScene);
		}

		// Remove old cave if it exists
		const oldCave = global.scene.getObjectByName('proceduralCave');
		if (oldCave) {
			global.scene.remove(oldCave);
		}

		// Remove old ring rotator
		if (this._ringRotator && this._ringRotator.parent) {
			this._ringRotator.parent.remove(this._ringRotator);
		}

		// Remove any leftover ring
		const existingRing = global.scene.getObjectByName('ring');
		if (existingRing && existingRing.parent) {
			existingRing.parent.remove(existingRing);
		}

		// Build procedural cave
		const cave = createProceduralCave(global.scene);
		global.scene.add(cave);

		const startY = nextLevel.startingRingY ?? 5;

		// IMPORTANT:
		// Keep player on the SAME orbit/path system used by the other levels.
		// Use the opposite side of the orbit like level 2 does.
		const playerLocalX = 0;
		const playerLocalZ = -34;

		player.space.position.set(playerLocalX, startY, playerLocalZ);

		// Create new ring
		const ring = createNeonRing();
		ring.position.set(playerLocalX, startY, playerLocalZ);
		ring.scale.setScalar(nextLevel.startingRingScale);
		ring.visible = true;

		// Create new ring rotator
		this._ringRotator = new Group();
		this._ringRotator.add(ring);
		global.scene.add(this._ringRotator);

		this._ring = ring;


		// Recreate / reattach number text to the NEW ring
		if (this._ringNumber && this._ringNumber.parent) {
			this._ringNumber.parent.remove(this._ringNumber);
		}

		const ringNumber = new Text();
		ringNumber.text = (global.score + 1).toString();
		ringNumber.fontSize = 0.6;
		ringNumber.anchorX = 'center';
		ringNumber.anchorY = 'middle';
		ringNumber.rotateY(Math.PI);
		ringNumber.sync();

		this._ring.add(ringNumber);
		this._ringNumber = ringNumber;

		// Match the same forward/orbit behavior as other levels
		const effectiveAngularSpeed =
			motionProfile.angularSpeed * this._getAngularDirection();

		const ringLeadMultiplier = nextLevel.ringLeadMultiplier ?? 1.0;
		this._ringRotator.quaternion.copy(rotator.quaternion);
		this._ringRotator.rotateY(
			effectiveAngularSpeed *
				nextLevel.ringInterval *
				ringLeadMultiplier
		);

		this._ringTimer = nextLevel.ringInterval;

		// Give player time before fail check
		this._transitionGraceTimer = 2.0;

		// Optional debug logs
		console.log('Transitioned to Level 3');
		console.log('Player local pos:', player.space.position);
		console.log('Ring local pos:', this._ring.position);
		console.log('Ring object:', this._ring);
	}

	_transitionToLevel4(player, global, rotator, motionProfile) {
        const nextLevelId = 'level-4';
        const nextLevel = Constants.LEVELS[nextLevelId];

        // Update level state
        global.levelId = nextLevelId;
        global.level = nextLevel;
        this._activeLevel = nextLevel;

        // Remove old level-3 cave
        const oldCave = global.scene.getObjectByName('proceduralCave');
        if (oldCave) {
            global.scene.remove(oldCave);
        }

        // Remove old molten rift if somehow already present
        const oldMolten = global.scene.getObjectByName('proceduralMoltenRift');
        if (oldMolten) {
            global.scene.remove(oldMolten);
        }

        // Remove old ring rotator
        if (this._ringRotator && this._ringRotator.parent) {
            this._ringRotator.parent.remove(this._ringRotator);
        }

        // Build level-4 environment
        const moltenRift = createMoltenRift(global.scene);
        global.scene.add(moltenRift);

        // Spawn player
        const startY =
            nextLevel.startingRingY !== undefined ? nextLevel.startingRingY : 8;
        const playerLocalX = 0;
        const playerLocalZ = -34;

        player.space.position.set(playerLocalX, startY, playerLocalZ);

        // Create ring
        const ring = createNeonRing();
        ring.position.set(playerLocalX, startY, playerLocalZ);
        ring.scale.setScalar(nextLevel.startingRingScale);

        // Create new ring rotator
        this._ringRotator = new Group();
        this._ringRotator.add(ring);
        global.scene.add(this._ringRotator);

        this._ring = ring;

        // Clamp only for level 4 so ring stays above lava/floor
        this._ring.position.y = this._clampRingYForFloor(
            this._ring.position.y,
            nextLevel
        );

        // Rebuild ring number text
        if (this._ringNumber && this._ringNumber.parent) {
            this._ringNumber.parent.remove(this._ringNumber);
        }

        const ringNumber = new Text();
        ringNumber.text = (global.score + 1).toString();
        ringNumber.fontSize = 0.6;
        ringNumber.anchorX = 'center';
        ringNumber.anchorY = 'middle';
        ringNumber.rotateY(Math.PI);
        ringNumber.sync();

        this._ring.add(ringNumber);
        this._ringNumber = ringNumber;

        // Match ring timing and rotation to current level settings
        const effectiveAngularSpeed =
            motionProfile.angularSpeed * this._getAngularDirection();

        const ringLeadMultiplier = nextLevel.ringLeadMultiplier ?? 1.0;

        this._ringRotator.quaternion.copy(rotator.quaternion);
        this._ringRotator.rotateY(
            effectiveAngularSpeed *
                nextLevel.ringInterval *
                ringLeadMultiplier
        );

        this._ringTimer = nextLevel.ringInterval * ringLeadMultiplier;
        this._transitionGraceTimer = 2.0;

        if (this._debugDisplay) {
            this._debugDisplay.text = `Score: ${global.score} | Level: ${global.levelId} | Active: ${this._activeLevel.name}`;
            this._debugDisplay.sync();
        }
    }
	



	_endGame(player, global) {
        // Prevent double-triggering if endGame fires more than once
        if (this._isRestarting) {
            return;
        }
        this._isRestarting = true;

        this._playGameOverAudio();

        // Save latest score
        this._latest = global.score;

        // Update record if needed
        if (global.score > this._record) {
            console.log('best score updated:', global.score);
            this._record = global.score;
            this._recordScore.text = global.score.toString();
            this._recordScore.sync();
            localforage.setItem(Constants.RECORD_SCORE_KEY, this._record);
        }

        // Save latest score to storage
        localforage.setItem(Constants.LATEST_SCORE_KEY, this._latest);

        // Show latest score on the old in-world scoreboard like the original repo
        this._currentScore.text = this._latest.toString();
        this._currentScore.sync();

        // Reset browser "current score" tracker
        this._currentRunScore = 0;
        this._updateScoreboardUI();

        // Reset flap tracking so the next lobby start is clean
        this._flapData = {
            left: { y: null, distance: 0, flaps: 0 },
            right: { y: null, distance: 0, flaps: 0 },
        };

        // Reset gameplay state
        global.gameState = 'lobby';
        global.score = 0;

        // Hide transition screen just in case
        if (this._hideTransitionScreen) {
            this._hideTransitionScreen();
        }

        // Reset everything back to level-1 without reloading the page
        this._resetToLevel1(global, player);

        // Allow future deaths again after reset finishes
        this._isRestarting = false;


    }

	//new transitioning method with smooth lerp and optional transition text
	_beginLevel2Transition(player, global) {
        this._beginLevelTransition('level-2', global);
    }




	_updateLevelTransition(player, global, rotator, delta, motionProfile) {
        if (!this._levelTransition) {
            return;
        }

        this._levelTransition.elapsed += delta;

        const {
            nextLevelId,
            currentLevelName,
            nextLevelName,
            elapsed,
            duration,
        } = this._levelTransition;

        // Keep debug text simple during transition
        if (this._debugDisplay) {
            this._debugDisplay.text = `Transition...`;
            this._debugDisplay.sync();
        }

        // 5-second transition behavior:
        // 0-1 sec: show message only
        // 1-2 sec: show 4
        // 2-3 sec: show 3
        // 3-4 sec: show 2
        // 4-5 sec: show 1
        if (elapsed >= 1 && elapsed < duration) {
            const countdownValue = Math.max(1, 5 - Math.floor(elapsed));
            this._updateTransitionScreenCountdown(
                currentLevelName,
                nextLevelName,
                countdownValue
            );
        }

        if (elapsed >= duration) {
            if (nextLevelId === 'level-2') {
                this._finishLevel2Transition(player, global, rotator, motionProfile);
            } else if (nextLevelId === 'level-3') {
                this._transitionToLevel3(player, global, rotator, motionProfile);
                global.gameState = 'ingame';
                this._levelTransition = null;
            } else if (nextLevelId === 'level-4') {
                this._transitionToLevel4(player, global, rotator, motionProfile);
                global.gameState = 'ingame';
                this._levelTransition = null;
            }

            this._hideTransitionScreen();
        }
    }


	_finishLevel2Transition(player, global, rotator, motionProfile) {
		const { nextLevelId, nextLevel } = this._levelTransition;

		global.levelId = nextLevelId;
		global.level = nextLevel;
		this._activeLevel = nextLevel;

		const level2StartY =
			nextLevel.startingRingY !== undefined ? nextLevel.startingRingY : 7;

		// Use a spawn point that is on the opposite side of the same orbit/path
		const level2LocalX = 0;
		const level2LocalZ = -34;

		// Snap player to the level-2 local spawn point
		player.space.position.set(level2LocalX, level2StartY, level2LocalZ);

		// IMPORTANT: do NOT rotate rotator here
		global.gameState = 'ingame';

		if (this._levelIndicator) {
			this._levelIndicator.text = `Level: ${nextLevel.name}`;
			this._levelIndicator.sync();
		}

		// Put the ring on the same local path as the player,
		// then rotate it ahead by one ring interval
		const effectiveAngularSpeed =
			motionProfile.angularSpeed * (nextLevel.angularDirection ?? 1);

		this._ringRotator.quaternion.copy(rotator.quaternion);
		this._ringRotator.rotateY(
			effectiveAngularSpeed * nextLevel.ringInterval,
		);

		this._ring.position.set(level2LocalX, level2StartY, level2LocalZ);
		this._ring.scale.setScalar(nextLevel.startingRingScale);
		this._ring.visible = true;

		// Give the player time to react after teleport
		this._transitionGraceTimer = 1.0;
		this._ringTimer = nextLevel.ringInterval;

		this._ringNumber.text = (global.score + 1).toString();
		this._ringNumber.sync();

		this._levelTransition = null;

		if (this._debugDisplay) {
			this._debugDisplay.text = `Score: ${global.score} | Level: ${global.levelId} | Active: ${this._activeLevel.name}`;
			this._debugDisplay.sync();
		}
	}
	_initializeTransitionOverlay() {
        if (typeof document === 'undefined') {
            return;
        }

        let overlay = document.getElementById('level-transition-overlay');

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'level-transition-overlay';
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100vw';
            overlay.style.height = '100vh';
            overlay.style.background = 'black';
            overlay.style.color = 'white';
            overlay.style.display = 'none';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.textAlign = 'center';
            overlay.style.padding = '40px';
            overlay.style.zIndex = '99999';
            overlay.style.fontFamily = 'Arial, sans-serif';
            overlay.style.fontSize = '32px';
            overlay.style.fontWeight = 'bold';
            overlay.style.lineHeight = '1.4';
            overlay.style.whiteSpace = 'pre-line';
            document.body.appendChild(overlay);
        }

        this._transitionOverlay = overlay;
    }

    _showTransitionOverlay(currentLevelName, nextLevelName) {
        if (!this._transitionOverlay) {
            return;
        }

        this._transitionOverlay.textContent =
            `Congratulations, you passed ${currentLevelName}.\nLoading next level: ${nextLevelName}.`;

        this._transitionOverlay.style.display = 'flex';
    }

    _hideTransitionOverlay() {
        if (!this._transitionOverlay) {
            return;
        }

        this._transitionOverlay.style.display = 'none';
    }

    _beginLevelTransition(nextLevelId, global) {
        const nextLevel = Constants.LEVELS[nextLevelId];

        if (!nextLevel) {
            return;
        }

        if (this._ring) {
            this._ring.visible = false;
        }

        global.gameState = 'transition';

        this._showTransitionScreen(global, this._activeLevel.name, nextLevel.name);

        this._levelTransition = {
            nextLevelId,
            nextLevel,
            currentLevelName: this._activeLevel.name,
            nextLevelName: nextLevel.name,
            elapsed: 0,
            duration: 5.0,
        };
    }

	_ensureTransitionScreen(global) {
        if (this._transitionScreen) {
            return;
        }

        const screenGroup = new Group();
        screenGroup.visible = false;

        // Big black sphere around the camera so the whole headset view goes dark
        const blackSphere = new Mesh(
            new SphereGeometry(8, 16, 16),
            new MeshBasicMaterial({
                color: 0x000000,
                side: BackSide,
                depthTest: false,
                depthWrite: false,
            })
        );
        blackSphere.renderOrder = 9999;
        screenGroup.add(blackSphere);

        const transitionText = new Text();
        transitionText.text = '';
        transitionText.fontSize = 0.18;
        transitionText.anchorX = 'center';
        transitionText.anchorY = 'middle';
        transitionText.textAlign = 'center';
        transitionText.maxWidth = 3.2;
        transitionText.color = 0xffffff;
        transitionText.position.set(0, 0, -2.5);
        transitionText.renderOrder = 10000;
        transitionText.sync();

        screenGroup.add(transitionText);

        global.camera.add(screenGroup);

        this._transitionScreen = screenGroup;
        this._transitionScreenText = transitionText;
    }

    _showTransitionScreen(global, currentLevelName, nextLevelName) {
        this._ensureTransitionScreen(global);

        if (this._transitionScreenText) {
            this._transitionScreenText.text =
                `Congratulations, you passed ${currentLevelName}.\nNext level: ${nextLevelName}`;

            this._transitionScreenText.sync();
        }

        if (this._transitionScreen) {
            this._transitionScreen.visible = true;
        }

        if (this._levelIndicator) {
            this._levelIndicator.visible = false;
        }

        if (this._debugDisplay) {
            this._debugDisplay.visible = false;
        }

        if (this._scoreBoard) {
            this._scoreBoard.visible = false;
        }
    }
	_updateTransitionScreenCountdown(currentLevelName, nextLevelName, countdownValue) {
        if (!this._transitionScreenText) {
            return;
        }

        this._transitionScreenText.text =
            `Congratulations, you passed ${currentLevelName}.\nNext level: ${nextLevelName}.\n\nLoading in: ${countdownValue}`;
        this._transitionScreenText.sync();
    }



    _hideTransitionScreen() {
        if (this._transitionScreen) {
            this._transitionScreen.visible = false;
        }

        if (this._levelIndicator) {
            this._levelIndicator.visible = true;
        }

        if (this._debugDisplay) {
            this._debugDisplay.visible = true;
        }
    }

    _resetToLevel1(global, player) {
        const level1 = Constants.LEVELS['level-1'];

        // Reset active level state
        global.levelId = 'level-1';
        global.level = level1;
        this._activeLevel = level1;

        // Clear transition flags
        this._levelTransition = null;
        this._transitionGraceTimer = 0;
        this._isLevelTransitioning = false;

        // Reset flap tracking
        this._flapData = {
            left: { y: null, distance: 0, flaps: 0 },
            right: { y: null, distance: 0, flaps: 0 },
        };

        // Remove procedural scenes if present
        const oldCave = global.scene.getObjectByName('proceduralCave');
        if (oldCave) {
            global.scene.remove(oldCave);
        }

        const oldMolten = global.scene.getObjectByName('proceduralMoltenRift');
        if (oldMolten) {
            global.scene.remove(oldMolten);
        }

        // Remove old GLTF scene too so level-1 reloads cleanly with a fresh ring
        const oldGltfScene = global.scene.getObjectByName('gltfScene');
        if (oldGltfScene) {
            global.scene.remove(oldGltfScene);
        }

        // Remove current ring rotator / ring setup
        if (this._ringRotator && this._ringRotator.parent) {
            this._ringRotator.parent.remove(this._ringRotator);
        }

        // Remove any leftover ring object if still attached somewhere
        const strayRing = global.scene.getObjectByName('ring');
        if (strayRing && strayRing.parent) {
            strayRing.parent.remove(strayRing);
        }

        this._ring = null;
        this._ringNumber = null;
        this._ringRotator = null;
        this._ringTimer = level1.ringInterval;

        // Reset player position back to level-1 start
        const startY =
            level1.startingRingY !== undefined ? level1.startingRingY : 4;
        player.space.position.set(0, startY, 34);

        // Show lobby scoreboard again, hide gameplay HUD until the run starts
        if (this._scoreBoard) {
            this._scoreBoard.visible = true;
        }

        if (this._levelIndicator) {
            this._levelIndicator.visible = false;
        }

        // Reload level-1 scene fresh so the original ring exists again
        if (global.gltfLoader) {
            const modelPath = level1.sceneModelPath || Constants.SCENE_MODEL_PATH;

            global.gltfLoader.load(
                modelPath,
                (gltf) => {
                    gltf.scene.name = 'gltfScene';
                    global.scene.add(gltf.scene);
                },
                undefined,
                (error) => {
                    console.error('Error loading level-1 scene model:', error);
                }
            );
        }
    }
    

	_updateGameplayHud(global) {
        if (!this._levelIndicator) {
            return;
        }

        // Show only score in the HUD for now.
        this._levelIndicator.text = `Score: ${global.score}`;
        this._levelIndicator.sync();
    }

	_setPlayerSpaceFromHeadWorld(player, rotator, desiredHeadWorldPos) {
		// Head position is local to player.space
		const headLocalPos = player.head.position.clone();

		// Convert desired world position into rotator local space
		const desiredHeadLocalToRotator = rotator.worldToLocal(desiredHeadWorldPos.clone());

		// Move player.space so that head ends up at desiredHeadWorldPos
		player.space.position.copy(desiredHeadLocalToRotator.sub(headLocalPos));
	}

	_usesNeonRingHitbox(level = this._activeLevel) {
        return (
            level === Constants.LEVELS['level-3'] ||
            level === Constants.LEVELS['level-4']
        );
    }

    _usesLevel4FloorClamp(level = this._activeLevel) {
        return (
            level === Constants.LEVELS['level-4']
        );
    }

	_getRingPassRadius(level = this._activeLevel) {
        if (!this._ring) {
            return 0;
        }

        // Matches createNeonRing() geometry:
        // inner pass-through radius is about 0.94 of the ring scale.
        const baseInnerRadius = 0.94;
        const padding = level?.ringHitPadding ?? 0;

        return Math.max(0.1, this._ring.scale.y * baseInnerRadius - padding);
    }

    _getRingOuterRadius() {
        if (!this._ring) {
            return 0;
        }

        // Matches createNeonRing() geometry:
        // visible outer radius is about 1.06 of the ring scale.
        return this._ring.scale.y * 1.06;
    }

    _clampRingYForFloor(desiredY, level = this._activeLevel) {
        if (!this._ring || !level) {
            return desiredY;
        }

        // Only levels that define ringFloorPadding will be affected.
        const floorPadding = level.ringFloorPadding ?? 0;

        if (floorPadding <= 0) {
            return desiredY;
        }

        const floorY = 0;
        const minSafeY = Math.max(
            level.ringMinY,
            floorY + this._getRingOuterRadius() + floorPadding
        );

        const maxSafeY = Math.max(minSafeY, level.ringMaxY);

        return Math.min(maxSafeY, Math.max(minSafeY, desiredY));
    }

	_getPlayerRingHorizontalDistance(player) {
        if (!this._ring) {
            return Infinity;
        }

        const playerWorld = player.space.getWorldPosition(this._tmpVec3);
        const ringWorld = this._ring.getWorldPosition(this._tmpVec3B);

        const dx = playerWorld.x - ringWorld.x;
        const dz = playerWorld.z - ringWorld.z;

        return Math.hypot(dx, dz);
    }

    _getRingContactDistance() {
        if (!this._ring) {
            return 0;
        }

        // This decides how close the ring center must be in XZ space
        // before we count it as "reaching" the player.
        //
        // Slightly generous on purpose so point timing feels natural
        // and audio isn't delayed.
        return Math.max(1.25, this._ring.scale.x * 0.45);
    }
	_isLevel4(level = this._activeLevel) {
        return level === Constants.LEVELS['level-4'];
    }

	

	_getAngularDirection() {
		return this._activeLevel?.angularDirection ?? 1;
	}


}




GameSystem.queries = {
	global: { required: [GlobalComponent] },
	player: { required: [PlayerComponent] },
};

/**
 * Helper function to create a text mesh with default settings.
 * @param {number} defaultValue - The default value for the text.
 * @returns {Text} - The created text mesh.
 */
const createText = (defaultValue, fontSize = 0.12) => {
	const text = new Text();
	text.text = defaultValue.toString();
	text.fontSize = fontSize;
	text.anchorX = 'center';
	text.anchorY = 'middle';
	text.sync();
	return text;
};
