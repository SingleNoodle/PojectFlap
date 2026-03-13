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
} from 'three';

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
		this._sessionHistory = []; // Last 3 sessions

		this._currentScore = createText(0);
		this._recordScore = createText(2);
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
	}

	_cacheScoreboardElements() {
		this._highestScoreElement = document.getElementById('highest-score-value');
		this._latestScoreElement = document.getElementById('latest-score-value');
		this._currentScoreElement = document.getElementById('current-score-value');
		this._updateScoreboardUI();
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

		localforage.getItem(Constants.SESSION_HISTORY_KEY).then((history) => {
			if (Array.isArray(history)) {
				this._sessionHistory = history;
				this._updateSessionDisplay();
			}
		});
	}

	_updateSessionDisplay() {
		// Display last 3 sessions (most recent first)
		for (let i = 0; i < 3; i++) {
			if (i < this._sessionHistory.length) {
				const session = this._sessionHistory[i];
				this._sessionTexts[i].text = `${session.score} - ${session.level}`;
			} else {
				this._sessionTexts[i].text = '--';
			}
			this._sessionTexts[i].sync();
		}
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
			// Match scoreboard image aspect ratio (1080x1920 = 0.5625)
			// Using 2 units wide and 3.56 units tall to maintain aspect ratio
			this._scoreBoard = new Mesh(
				new PlaneGeometry(2, 3.56),
				new MeshBasicMaterial({ map: SCORE_BOARD_TEXTURE, transparent: true }),
			);
			player.space.add(this._scoreBoard);
			this._scoreBoard.position.set(0, 1.5, -2);

			// Position values to match new scoreboard layout
			// Left column: Current Score, Ranking, Level
			this._addTextToScoreBoard(this._currentScore, -0.3, 1.2, 0.07);
			this._addTextToScoreBoard(this._ranking, -0.3, 0.65, 0.07);
			this._addTextToScoreBoard(this._levelName, -0.3, 0.1, 0.06);
			
			// Right column: Record, World Record
			this._addTextToScoreBoard(this._recordScore, 0.5, 1.2, 0.07);
			this._addTextToScoreBoard(this._worldRecord, 0.5, 0.65, 0.07);
			
			// Session history rows (Last 3 sessions displayed below)
			const sessionX = -0.3;
			const sessionStartY = -0.5;
			const sessionRowHeight = 0.5;
			for (let i = 0; i < 3; i++) {
				this._addTextToScoreBoard(
					this._sessionTexts[i],
					sessionX,
					sessionStartY - i * sessionRowHeight,
					0.065
				);
			}
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

		if (this._levelName && this._levelName.text !== this._activeLevel.name) {
			this._levelName.text = this._activeLevel.name;
			this._levelName.sync();
		}

		if (
			this._levelIndicator &&
			this._levelIndicator.text !== `Level: ${this._activeLevel.name}`
		) {
			this._levelIndicator.text = `Level: ${this._activeLevel.name}`;
			this._levelIndicator.sync();
		}

		const isPresenting = global.renderer.xr.isPresenting;
		const rotator = player.space.parent;
		this._scoreBoard.visible = false;

		// Create and position level indicator
		if (!this._levelIndicator) {
			this._levelIndicator = createText(`Level: ${this._activeLevel.name}`, 0.08);
			// Attach to camera so it always stays at the top-center of where the player is looking.
			global.camera.add(this._levelIndicator);
			this._levelIndicator.position.set(0, 0.35, -1.4);
		}
		
		// Create debug display
		if (!this._debugDisplay) {
			this._debugDisplay = createText('Score: 0', 0.06);
			global.camera.add(this._debugDisplay);
			this._debugDisplay.position.set(0, 0.25, -1.4);
		}

		if (!this._ring && global.scene.getObjectByName('ring')) {
			this._initializeRing(player, global, rotator, motionProfile);
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
		this._ringRotator.quaternion.copy(rotator.quaternion);
		this._ringRotator.rotateY(
			motionProfile.angularSpeed * this._activeLevel.ringInterval,
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
		this._ringTimer;
		this._flapData = {
			left: { y: null, distance: 0, flaps: 0 },
			right: { y: null, distance: 0, flaps: 0 },
		};
		this._ringRotator.quaternion.copy(rotator.quaternion);
		this._ringRotator.rotateY(
			motionProfile.angularSpeed * this._activeLevel.ringInterval,
		);
		// Use level-specific starting Y if provided, otherwise default to 4.
		const startingY = this._activeLevel.startingRingY !== undefined ? this._activeLevel.startingRingY : 4;
		this._ring.position.y = startingY;
		this._ring.scale.setScalar(this._activeLevel.startingRingScale);
		this._ringTimer = this._activeLevel.ringInterval;
		this._ringNumber.text = '1';
		this._ringNumber.sync();
	}

	_handleInGameState(player, global, rotator, delta, motionProfile) {
		if (global.gameState !== 'ingame') {
			return;
		}

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
		this._currentRunScore = global.score;
		this._updateScoreboardUI();
		this._ringNumber.text = (global.score + 1).toString();
		this._ringNumber.sync();
		
		// DEBUG: Log score and level info
		console.log(`Score: ${global.score}, Level: ${global.levelId}, Transitioning: ${this._isLevelTransitioning}`);
		
		// Update in-VR debug display
		if (this._debugDisplay) {
			this._debugDisplay.text = `Score: ${global.score} | Level: ${global.levelId} | Active: ${this._activeLevel.name}`;
			this._debugDisplay.sync();
		}
		
		// Advance from level-1 to level-2 once score reaches threshold.
		// Check _activeLevel instead of global.levelId to avoid stale data.
		const currentLevelId = Object.keys(Constants.LEVELS).find(
			key => Constants.LEVELS[key] === this._activeLevel
		);
		
		if (
			!this._isLevelTransitioning &&
			global.score >= 5 &&
			currentLevelId === 'level-1'
		) {
			this._isLevelTransitioning = true;
			console.log('Level complete! Advancing to level-2 in the same map...');
			this._transitionToLevel2(player, global, rotator, motionProfile);
			this._isLevelTransitioning = false;
			return;
		}
		
		this._ringRotator.quaternion.copy(rotator.quaternion);
		this._ringRotator.rotateY(
			motionProfile.angularSpeed * this._activeLevel.ringInterval,
		);
		
		// Generate ring position (reversed for level-2: high Y to low Y).
		const yRange = this._activeLevel.ringMaxY - this._activeLevel.ringMinY;
		let newY = Math.random() * yRange + this._activeLevel.ringMinY;
		if (this._activeLevel.ringReversed) {
			// Invert Y position: map [minY, maxY] -> [maxY, minY]
			newY = this._activeLevel.ringMaxY - (newY - this._activeLevel.ringMinY);
		}
		this._ring.position.y = newY;
		
		this._ring.scale.multiplyScalar(this._activeLevel.ringShrinkMultiplier);
		this._ringTimer = this._activeLevel.ringInterval;
	}

	_transitionToLevel2(player, global, rotator, motionProfile) {
		const nextLevelId = 'level-2';
		const nextLevel = Constants.LEVELS[nextLevelId];

		global.levelId = nextLevelId;
		global.level = nextLevel;
		this._activeLevel = nextLevel;

		// Teleport to a different area in the same map.
		const level2StartY =
			nextLevel.startingRingY !== undefined ? nextLevel.startingRingY : 7;
		player.space.position.set(16, level2StartY, -22);

		// Rotate player to face the correct direction on the opposite side
		rotator.rotateY(Math.PI);

		// Reposition ring system near the new spawn.
		this._ringRotator.quaternion.copy(rotator.quaternion);
		this._ringRotator.rotateY(motionProfile.angularSpeed * nextLevel.ringInterval);
		this._ring.position.set(16, level2StartY, -22);
		this._ring.scale.setScalar(nextLevel.startingRingScale);
		this._ringTimer = nextLevel.ringInterval;
		this._ringNumber.text = (global.score + 1).toString();
		this._ringNumber.sync();
	}

	_endGame(player, global) {
		this._currentRunScore = global.score;
		this._latest = global.score;
		this._currentScore.text = global.score.toString();
		this._currentScore.sync();
		localforage.setItem(Constants.LATEST_SCORE_KEY, this._latest);
		
		// Save to session history (keep last 3)
		const levelName = this._activeLevel.name;
		this._sessionHistory.unshift({ score: global.score, level: levelName });
		if (this._sessionHistory.length > 3) {
			this._sessionHistory.pop();
		}
		localforage.setItem(Constants.SESSION_HISTORY_KEY, this._sessionHistory);
		this._updateSessionDisplay();
		
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
		player.space.position.y = 4;
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
