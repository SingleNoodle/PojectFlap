/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Importing main stylesheet
import './styles/index.css';

// Importing game systems and components
import { PlayerComponent, PlayerSystem } from './player';

import { Clock } from 'three';
import { FlapSystem } from './flap';
import { GameSystem } from './game';
import { Constants, GlobalComponent } from './global';
import { InlineSystem } from './landing';
import { World } from 'elics';
// Importing scene setup function
import { setupScene } from './scene';

const getSelectedLevelId = () => {
	const queryValue = new URLSearchParams(window.location.search).get(
		Constants.LEVEL_PARAM_KEY,
	);
	if (queryValue && Constants.LEVELS[queryValue]) {
		localStorage.setItem(Constants.SELECTED_LEVEL_KEY, queryValue);
		return queryValue;
	}

	const savedLevel = localStorage.getItem(Constants.SELECTED_LEVEL_KEY);
	if (savedLevel && Constants.LEVELS[savedLevel]) {
		return savedLevel;
	}

	return Constants.DEFAULT_LEVEL_ID;
};

const getMotionProfile = () => {
	const queryValue = new URLSearchParams(window.location.search).get(
		Constants.MOTION_PARAM_KEY,
	);

	if (queryValue !== null) {
		const isComfort = queryValue === '1' || queryValue.toLowerCase() === 'true';
		localStorage.setItem(Constants.COMFORT_MODE_KEY, isComfort ? '1' : '0');
		return isComfort
			? Constants.MOTION_PROFILES.comfort
			: Constants.MOTION_PROFILES.default;
	}

	const savedPreference = localStorage.getItem(Constants.COMFORT_MODE_KEY);
	if (savedPreference === '1' || savedPreference === '0') {
		return savedPreference === '1'
			? Constants.MOTION_PROFILES.comfort
			: Constants.MOTION_PROFILES.default;
	}

	const reducedMotionPreferred =
		typeof window.matchMedia === 'function' &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	if (reducedMotionPreferred) {
		localStorage.setItem(Constants.COMFORT_MODE_KEY, '1');
		return Constants.MOTION_PROFILES.comfort;
	}

	return Constants.MOTION_PROFILES.default;
};

// Create the world with the defined systems and components
const world = new World();
world
	.registerComponent(GlobalComponent)
	.registerComponent(PlayerComponent)
	.registerSystem(PlayerSystem)
	.registerSystem(FlapSystem)
	.registerSystem(GameSystem)
	.registerSystem(InlineSystem);
const clock = new Clock();

// Determine selected level and motion profile before scene setup
const selectedLevelId = getSelectedLevelId();
const motionProfile = getMotionProfile();

// Set up the main scene, camera, and renderer (pass selected level for per-level models)
const { scene, camera, renderer, gltfLoader } = setupScene(selectedLevelId);

// Create a global entity to store references to the renderer, camera, and scene
world.createEntity().addComponent(GlobalComponent, {
	renderer,
	camera,
	scene,
	gltfLoader,
	score: 0,
	gameState: 'lobby',
	levelId: selectedLevelId,
	level: Constants.LEVELS[selectedLevelId],
	motionProfile,
});

// Set the animation loop for rendering and game logic
renderer.setAnimationLoop(function () {
	const delta = clock.getDelta();
	const time = clock.elapsedTime;
	// Execute the ECS world logic
	world.update(delta, time);

	// Render the scene
	renderer.render(scene, camera);
});
