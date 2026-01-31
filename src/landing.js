/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GlobalComponent } from './global';
import { System } from 'elics';
import { VRButton } from 'ratk';

/**
 * The InlineSystem class manages the VR and Web launch buttons on the landing page.
 */
export class InlineSystem extends System {
	init() {
		this.needsSetup = true;
		this.autoStartAttempted = false;
	}

	/**
	 * Checks if we're in a VR browser (Meta Quest browser)
	 */
	_isVRBrowser() {
		return /OculusBrowser|Quest/i.test(navigator.userAgent);
	}

	/**
	 * Sets up the VR and Web launch buttons.
	 * @param {Object} global - The global component containing the renderer.
	 */
	_setupButtons(global) {
		const vrButton = document.getElementById('vr-button');
		const webLaunchButton = document.getElementById('web-launch-button');
		const uiPanel = document.getElementById('ui-panel');

		// Initially hide the web launch button
		webLaunchButton.style.display = 'none';

		// Convert the VR button and handle unsupported VR scenarios
		VRButton.convertToVRButton(vrButton, global.renderer, {
			optionalFeatures: ['local-floor', 'bounded-floor', 'layers'],
			onUnsupported: () => {
				vrButton.style.display = 'none';
				webLaunchButton.style.display = 'block';
			},
			onSessionStarted: () => {
				// Hide UI panel when VR session starts
				if (uiPanel) {
					uiPanel.style.display = 'none';
				}
			},
			onSessionEnded: () => {
				// Show UI panel when VR session ends
				if (uiPanel) {
					uiPanel.style.display = 'block';
				}
			},
		});

		// Set the action for the web launch button
		webLaunchButton.onclick = () => {
			window.open(
				'https://www.oculus.com/open_url/?url=' +
					encodeURIComponent(window.location.href),
			);
		};

		// If in VR browser, try to auto-start VR after a short delay
		if (this._isVRBrowser() && !this.autoStartAttempted) {
			this.autoStartAttempted = true;
			// Add a message for the user
			const helpText = document.createElement('p');
			helpText.textContent = 'Click "ENTER VR" to start the experience';
			helpText.style.fontWeight = 'bold';
			helpText.style.color = '#007bff';
			uiPanel.querySelector('.card-body').insertBefore(helpText, vrButton);
		}
	}

	/**
	 * Executes the system logic. Sets up the buttons if they haven't been set up yet.
	 */
	update() {
		const global = this.getEntities(this.queries.global)[0].getComponent(
			GlobalComponent,
		);

		if (this.needsSetup) {
			this._setupButtons(global);
			this.needsSetup = false;
			return;
		}
	}
}

InlineSystem.queries = {
	global: { required: [GlobalComponent] },
};
