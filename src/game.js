/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Constants, GlobalComponent } from './global';
import {
	Group,
	Mesh,
	MeshBasicMaterial,
	PlaneGeometry,
	SRGBColorSpace,
	TextureLoader,
	Vector3,
	Quaternion,
} from 'three';
import { createNeonRing, createProceduralCave } from './proceduralMap';

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
		this._playerId = null;
		this._record = 0;
		this._latest = 0;
		this._currentRunScore = 0;
		this._highestScoreElement = null;
		this._latestScoreElement = null;
		this._currentScoreElement = null;

		this._currentScore = createText(0);
		this._recordScore = createText(2);
		
		//this._isLevelTransitioning = false;

		this._transitionGraceTimer =0;
		//Timer to help orientate players after level transition by temporarily pausing ring movement and score updates.
		
		this._levelTransition = null; 
		// Will hold data for smooth level transitions when implemented
		this._tmpVec3 = new Vector3();
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
			// Match scoreboard image aspect ratio (1200x600 = 2.0)
			// Using 2 units wide and 1 unit tall to maintain aspect ratio
			this._scoreBoard = new Mesh(
				new PlaneGeometry(2, 1),
				new MeshBasicMaterial({ map: SCORE_BOARD_TEXTURE, transparent: true }),
			);
			player.space.add(this._scoreBoard);
			this._scoreBoard.position.set(0, 1.5, -2);

			// Keep in-world board simple: current and record only.
			this._addTextToScoreBoard(this._currentScore, -0.4, 0.2, 0.08);
			this._addTextToScoreBoard(this._recordScore, 0.4, 0.2, 0.08);
		}
	}

	_addTextToScoreBoard(text, x, y, fontSize = 0.08) {
		this._scoreBoard.add(text);
		text.position.set(x, y, 0.001);
		text.fontSize = fontSize;
		text.sync();
	}

	_manageGameStates(global, player, delta) {
		this._activeLevel =
			global.level || Constants.LEVELS[Constants.DEFAULT_LEVEL_ID];

		const motionProfile =
			global.motionProfile || Constants.MOTION_PROFILES.default;

		const isPresenting = global.renderer.xr.isPresenting;
		const rotator = player.space.parent;

		this._scoreBoard.visible = false;

		// Create and position level indicator
		if (!this._levelIndicator) {
			this._levelIndicator = createText('Level: level-1 | Score: 0', 0.08);
			global.camera.add(this._levelIndicator);
			this._levelIndicator.position.set(0, 0.35, -1.4);
		}

		this._updateGameplayHud(global);

		// Create debug display
		if (!this._debugDisplay) {
			this._debugDisplay = createText('Score: 0', 0.06);
			global.camera.add(this._debugDisplay);
			this._debugDisplay.position.set(0, 0.25, -1.4);
		}

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
		if (isPresenting) {
			this._scoreBoard.visible = true;
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
	}

	_manageFlapData(handedness, thisFrameY, lastFrameY) {
		if (lastFrameY) {
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
		global.gameState = 'ingame';
		this._currentRunScore = 0;
		this._updateScoreboardUI();
		this._currentScore.text = '0';
		this._currentScore.sync();
		this._ringTimer;
		this._flapData = {
			left: { y: null, distance: 0, flaps: 0 },
			right: { y: null, distance: 0, flaps: 0 },
		};
		const effectiveAngularSpeed =
			motionProfile.angularSpeed * this._getAngularDirection();

		this._ringRotator.quaternion.copy(rotator.quaternion);
		this._ringRotator.rotateY(
			effectiveAngularSpeed * this._activeLevel.ringInterval,
		);
		// Use level-specific starting Y if provided, otherwise default to 4.
		const startingY = this._activeLevel.startingRingY !== undefined ? this._activeLevel.startingRingY : 4;
		this._ring.position.y = startingY;
		this._ring.scale.setScalar(this._activeLevel.startingRingScale);
		this._ringTimer = this._activeLevel.ringInterval;
		this._ringNumber.text = '1';
		this._ringNumber.sync();
		this._updateGameplayHud(global);
	}

	_handleInGameState(player, global, rotator, delta, motionProfile) {
		if (global.gameState !== 'ingame') {
			return;
		}

		if(this._transitionGraceTimer > 0) {
			this._transitionGraceTimer -= delta;
			
			if (this._transitionGraceTimer < 0) {
				this._transitionGraceTimer = 0;
			}
			this._vertSpeed =0;
			return; 
		}
		// Skip updating rings and score during grace period after level transition

		if (this._ring) {
			this._ringTimer -= delta;
			if (this._ringTimer < 0) {
				const ringRadius = this._ring.scale.x / 2;
				if (
					Math.abs(player.space.position.y - this._ring.position.y) < ringRadius
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
			key => Constants.LEVELS[key] === this._activeLevel
		);

		// Level 1 -> Level 2
		if (
			!this._levelTransition &&
			global.score >= 1 &&
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
			global.score >= 2
		) {
			this._isLevelTransitioning = true;
			console.log('Level complete! Advancing to level-3: Neon Cavern...');
			this._transitionToLevel3(player, global, rotator, motionProfile);
			this._isLevelTransitioning = false;
			return;
		}

		const effectiveAngularSpeed =
			motionProfile.angularSpeed * this._getAngularDirection();

		this._ringRotator.quaternion.copy(rotator.quaternion);
		this._ringRotator.rotateY(
			effectiveAngularSpeed * this._activeLevel.ringInterval,
		);

		// Generate ring position
		const yRange = this._activeLevel.ringMaxY - this._activeLevel.ringMinY;
		let newY = Math.random() * yRange + this._activeLevel.ringMinY;

		if (this._activeLevel.ringReversed) {
			newY = this._activeLevel.ringMaxY - (newY - this._activeLevel.ringMinY);
		}

		this._ring.position.y = newY;
		this._ring.scale.multiplyScalar(this._activeLevel.ringShrinkMultiplier);
		this._ringTimer = this._activeLevel.ringInterval;
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

		this._ringRotator.quaternion.copy(rotator.quaternion);
		this._ringRotator.rotateY(
			effectiveAngularSpeed * nextLevel.ringInterval * 2
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



	_endGame(player, global) {
		this._playGameOverAudio();
		this._currentRunScore = global.score;
		this._latest = global.score;
		this._currentScore.text = global.score.toString();
		this._currentScore.sync();
		localforage.setItem(Constants.LATEST_SCORE_KEY, this._latest);
		
		if (global.score > this._record) {
			console.log('best score updated:', global.score);
			this._record = global.score;
			this._recordScore.text = global.score.toString();
			this._recordScore.sync();
			localforage.setItem(Constants.RECORD_SCORE_KEY, this._record);
		}
		this._updateScoreboardUI();
		global.gameState = 'lobby';
		global.score = 0;
		this._currentRunScore = 0;
		this._updateScoreboardUI();
		this._currentScore.text = '0';
		this._currentScore.sync();
		this._updateGameplayHud(global);
		player.space.position.y = 4;
	}

	//new transitioning method with smooth lerp and optional transition text
	_beginLevel2Transition(player, global) {
		const nextLevelId = 'level-2';
		const nextLevel = Constants.LEVELS[nextLevelId];

		if (this._ring) {
			this._ring.visible = false;
		}

		if (this._levelIndicator) {
			this._levelIndicator.text = 'Level 2';
			this._levelIndicator.sync();
		}

		global.gameState = 'transition';

		this._levelTransition = {
			nextLevelId,
			nextLevel,
			elapsed: 0,
			duration: 0.2,
		};
	}



	_updateLevelTransition(player, global, rotator, delta, motionProfile) {
		if (!this._levelTransition) {
			return;
		}

		this._levelTransition.elapsed += delta;

		if (this._debugDisplay) {
			this._debugDisplay.text = `Transition...`;
			this._debugDisplay.sync();
		}

		if (this._levelTransition.elapsed >= this._levelTransition.duration) {
			this._finishLevel2Transition(player, global, rotator, motionProfile);
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

	_updateGameplayHud(global) {
		if (!this._levelIndicator) {
			return;
		}

		this._levelIndicator.text = `Level: ${this._activeLevel.name} | Score: ${global.score}`;
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
