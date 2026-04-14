/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from 'elics';

// Importing necessary types from becsy

/**
 * The GlobalComponent class represents a component that contains
 * global properties and settings used throughout the game.
 */
export class GlobalComponent extends Component {}

export const Constants = {
	// game constants
	NUM_FLAPS_TO_START_GAME: 3,
	PLAYER_ANGULAR_SPEED: Math.PI / 25,
	GRAVITY: -9.81,
	FLAP_SPEED_MULTIPLIER: 0.1,
	MOTION_PARAM_KEY: 'comfort',
	COMFORT_MODE_KEY: 'comfort-mode',
	MOTION_PROFILES: {
		default: {
			angularSpeed: Math.PI / 25,
			gravity: -9.81,
			flapSpeedMultiplier: 0.1,
		},
		comfort: {
			angularSpeed: Math.PI / 35,
			gravity: -7.2,
			flapSpeedMultiplier: 0.075,
		},
	},
	DEFAULT_LEVEL_ID: 'level-1',
	LEVEL_PARAM_KEY: 'level',
	LEVELS: {
		'level-1': {
			name: 'Classic Skies',
			ringInterval: 3,
			startingRingScale: 5,
			ringShrinkMultiplier: 0.98,
			ringMinY: 4,
			ringMaxY: 9,
			sceneModelPath: 'assets/gltf/scene.gltf',
			startingRingY: 4,
			angularDirection: 1,
		},
		'level-2': {
			name: 'Narrow Canyon',
			ringInterval: 2.25,
			startingRingScale: 4,
			ringShrinkMultiplier: 0.96,
			ringMinY: 3,
			ringMaxY: 10,
			sceneModelPath: 'assets/gltf/scene.gltf',
			ringReversed: true,
			startingRingY: 9,
			angularDirection: -1,
		},
		'level-3': {
			name: 'Neon Cavern',
			ringInterval: 1.75,
			startingRingScale: 3.5,
			ringShrinkMultiplier: 0.94,
			ringMinY: 1,
			ringMaxY: 8,
			startingRingY: 5,
			proceduralScene: true,
			angularDirection: -1,
		},
		'level-4': {
			name: 'Molten Rift',
			ringInterval: 1.75,
			startingRingScale: 3.5,
			ringShrinkMultiplier: 0.94,
			ringMinY: 1,
			ringMaxY: 8,
			startingRingY: 5,
			proceduralScene: true,
			angularDirection: -1,
			ringLeadMultiplier: 1.0,
			ringFloorPadding: 0.5,
			ringHitPadding: 0.05,
		},

	},

	// asset paths
	SCORE_BOARD_TEXTURE_PATH: 'assets/scoreboard.png',
	ENV_TEXTURE_PATH: 'assets/envmap.exr',
	SCENE_MODEL_PATH: 'assets/gltf/scene.gltf',
	WING_MODEL_PATH: 'assets/gltf/wing.gltf',
	SCORE_CUE_AUDIO_PATH:
		'audio/u_vdwj1c20kz-coin-collision-sound-342335.mp3',
	SCORE_CUE_AUDIO_VOLUME: 0.35,
	GAME_OVER_AUDIO_PATH: 'audio/game over.mp3',
	GAME_OVER_AUDIO_VOLUME: 0.5,

	// local storage keys
	RECORD_SCORE_KEY: 'record-score',
	LATEST_SCORE_KEY: 'latest-score',
	PLAYER_ID_KEY: 'player-id',
	SELECTED_LEVEL_KEY: 'selected-level',
	SESSION_HISTORY_KEY: 'session-history',
};
