/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Constants, GlobalComponent } from './global';
import { Group, Vector3 } from 'three';

import { PlayerComponent } from './player';
import { System } from 'elics';

/**
 * FlapSystem class handles the flapping mechanism and related game logic.
 */
export class FlapSystem extends System {
	init() {
		this._rotator = null;
		this._vertSpeed = 0;
		this._lastFrameY = { left: null, right: null };
		this._wings = { left: null, right: null };
		this._vec3 = new Vector3();
		this._ringTimer = Constants.RING_INTERVAL;
	}

	/**
	 * Sets up the player's space and loads the wing assets.
	 */
	_init(playerSpace, scene, gltfLoader) {
		this._rotator = new Group();
		this._rotator.add(playerSpace);
		playerSpace.scale.setScalar(0.1);
		playerSpace.position.set(0, 4, 34);
		playerSpace.rotateY(-Math.PI / 2);
		scene.add(this._rotator);

		gltfLoader.load(Constants.WING_MODEL_PATH, (gltf) => {
			const rightWing = gltf.scene;
			const leftWing = rightWing.clone(true);
			leftWing.scale.set(-1, 1, 1);
			playerSpace.add(rightWing, leftWing);
			this._wings = { left: leftWing, right: rightWing };
		});
	}

	update(delta) {
		const global = this.getEntities(this.queries.global)[0].getComponent(
			GlobalComponent,
		);
		const motionProfile =
			global.motionProfile || Constants.MOTION_PROFILES.default;

		const player = this.getEntities(this.queries.player)[0]?.getComponent(
			PlayerComponent,
		);

		if (!this._rotator) {
			this._init(player.space, global.scene, global.gltfLoader);
		}

		const angularDirection = global.level?.angularDirection ?? 1;
		const effectiveAngularSpeed = motionProfile.angularSpeed * angularDirection;

		this._rotator.rotateY(effectiveAngularSpeed * delta);
		const isPresenting = global.renderer.xr.isPresenting;

		if (isPresenting) {
			this._handleVRMode(player, global, delta, motionProfile);
		} else {
			this._handleNonVRMode(player);
		}

		this._manageRings(delta);
	}

	_handleVRMode(player, global, delta, motionProfile) {
		let leftFlap = 0;
		let rightFlap = 0;
		let wingAngle = 0;

		Object.entries(player.controllers).forEach(([handedness, controller]) => {
			const thisFrameY = controller.targetRaySpace.position.y;

			if (this._lastFrameY[handedness] != null) {
				if (thisFrameY < this._lastFrameY[handedness]) {
					const flapAmount = (this._lastFrameY[handedness] - thisFrameY) / delta;

					if (handedness === 'left') {
						leftFlap = flapAmount;
					} else if (handedness === 'right') {
						rightFlap = flapAmount;
					}
				}
			}

			this._lastFrameY[handedness] = thisFrameY;

			if (this._wings[handedness]) {
				this._adjustWingPosition(player, handedness, controller);
				wingAngle += this._calculateWingAngle(handedness, controller);
			}
		});

// Reduce lift when both wings flap together
const bothFlapping = leftFlap > 0 && rightFlap > 0;

//diminishing returns formula for flapping both wings together, so that it's more efficient to flap one wing at a time
const flapSpeed = bothFlapping
    ? Math.max(leftFlap, rightFlap) + Math.min(leftFlap, rightFlap) * 0.45
    : leftFlap + rightFlap;


		let gravityAdjusted = this._adjustGravityBasedOnWingAngle(
			wingAngle,
			motionProfile.gravity,
		);

		if (global.gameState === 'ingame') {
			this._vertSpeed +=
				gravityAdjusted * delta + flapSpeed * motionProfile.flapSpeedMultiplier;
			player.space.position.y += this._vertSpeed * delta;

			if (player.space.position.y <= 0) {
				player.space.position.y = 0;
				this._vertSpeed = 0;
			}
		}
	}

	_handleNonVRMode(player) {
		player.space.position.y = 4;
		this._vertSpeed = 0;
	}

	_manageRings(delta) {
		if (this._ring) {
			this._ringTimer -= delta;
			if (this._ringTimer < 0) {
				this._ringRotator.quaternion.copy(this._rotator.quaternion);
				this._ringRotator.rotateY(
					Constants.PLAYER_ANGULAR_SPEED * Constants.RING_INTERVAL,
				);
				this._ring.position.y = Math.random() * 5 + 4;
				this._ring.scale.multiplyScalar(0.98);
				this._ringTimer = Constants.RING_INTERVAL;
			}
		}
	}

	_adjustWingPosition(player, handedness, controller) {
		this._wings[handedness].position.copy(player.head.position);
		this._wings[handedness].position.y -= 0.25;
		this._wings[handedness].lookAt(
			controller.targetRaySpace.getWorldPosition(this._vec3),
		);
	}

	_calculateWingAngle(handedness, controller) {
		this._vec3.subVectors(
			controller.targetRaySpace.position,
			this._wings[handedness].position,
		);
		return Math.atan(Math.abs(this._vec3.y) / Math.abs(this._vec3.x));
	}

	_adjustGravityBasedOnWingAngle(wingAngle) {
        let gravityAdjusted = Constants.GRAVITY;

        // Glide: wings more horizontal / spread out
        if (wingAngle < 0.2) {
            gravityAdjusted *= 0.5;
        }
        // Smooth transition back to normal gravity
        else if (wingAngle < 0.5) {
            gravityAdjusted *= ((wingAngle - 0.2) / 0.3) * 0.5 + 0.5;
        }
        // Dive: wings tucked in / steep angle
        else if (wingAngle > 1.1) {
            gravityAdjusted *= 1.9;
        }

        return gravityAdjusted;
    }
}

FlapSystem.queries = {
	global: { required: [GlobalComponent] },
	player: { required: [PlayerComponent] },
};
