// file
// ./static/js/home.js
console.log("[+] home.js loaded and executing");

// stop long click context popup on android
window.oncontextmenu = function () { return false; }

// global websocket object
let ws = null;
let selectedCameraId = null;

// Settings state
let currentSettings = {
	camera: {
		resolution: 'UXGA',
		quality: 12,
		brightness: 0,
		contrast: 0,
		saturation: 0,
		special_effect: 0,
		whitebal: 1,
		awb_gain: 1,
		wb_mode: 0,
		exposure_ctrl: 1,
		aec2: 0,
		ae_level: 0,
		aec_value: 300,
		gain_ctrl: 1,
		agc_gain: 0,
		gainceiling: 0,
		bpc: 0,
		wpc: 1,
		raw_gma: 1,
		lenc: 1,
		hmirror: 0,
		vflip: 0
	},
	motion: {
		minArea: 4000,
		threshold: 25,
		blurSize: 31,
		dilation: 3
	}
};

// Load settings from localStorage
function loadSettings() {
	const savedSettings = localStorage.getItem('cameraSettings');
	if (savedSettings) {
		try {
			const parsedSettings = JSON.parse(savedSettings);
			// Ensure the structure is complete
			if (parsedSettings.camera) {
				currentSettings.camera = {
					resolution: parsedSettings.camera.resolution || currentSettings.camera.resolution,
					quality: parsedSettings.camera.quality || currentSettings.camera.quality,
					brightness: parsedSettings.camera.brightness || currentSettings.camera.brightness,
					contrast: parsedSettings.camera.contrast || currentSettings.camera.contrast,
					saturation: parsedSettings.camera.saturation || currentSettings.camera.saturation,
					special_effect: parsedSettings.camera.special_effect || currentSettings.camera.special_effect,
					whitebal: parsedSettings.camera.whitebal || currentSettings.camera.whitebal,
					awb_gain: parsedSettings.camera.awb_gain || currentSettings.camera.awb_gain,
					wb_mode: parsedSettings.camera.wb_mode || currentSettings.camera.wb_mode,
					exposure_ctrl: parsedSettings.camera.exposure_ctrl || currentSettings.camera.exposure_ctrl,
					aec2: parsedSettings.camera.aec2 || currentSettings.camera.aec2,
					ae_level: parsedSettings.camera.ae_level || currentSettings.camera.ae_level,
					aec_value: parsedSettings.camera.aec_value || currentSettings.camera.aec_value,
					gain_ctrl: parsedSettings.camera.gain_ctrl || currentSettings.camera.gain_ctrl,
					agc_gain: parsedSettings.camera.agc_gain || currentSettings.camera.agc_gain,
					gainceiling: parsedSettings.camera.gainceiling || currentSettings.camera.gainceiling,
					bpc: parsedSettings.camera.bpc || currentSettings.camera.bpc,
					wpc: parsedSettings.camera.wpc || currentSettings.camera.wpc,
					raw_gma: parsedSettings.camera.raw_gma || currentSettings.camera.raw_gma,
					lenc: parsedSettings.camera.lenc || currentSettings.camera.lenc,
					hmirror: parsedSettings.camera.hmirror || currentSettings.camera.hmirror,
					vflip: parsedSettings.camera.vflip || currentSettings.camera.vflip
				};
			}
			if (parsedSettings.motion) {
				currentSettings.motion = {
					minArea: parsedSettings.motion.minArea || currentSettings.motion.minArea,
					threshold: parsedSettings.motion.threshold || currentSettings.motion.threshold,
					blurSize: parsedSettings.motion.blurSize || currentSettings.motion.blurSize,
					dilation: parsedSettings.motion.dilation || currentSettings.motion.dilation
				};
			}
			updateSettingsUI();
		} catch (e) {
			console.log("[-] Error loading settings:", e);
			// If there's an error, save the default settings
			saveSettings();
		}
	} else {
		// If no settings exist, save the default settings
		saveSettings();
	}
}

// Save settings to localStorage
function saveSettings() {
	try {
		localStorage.setItem('cameraSettings', JSON.stringify(currentSettings));
	} catch (e) {
		console.log("[-] Error saving settings:", e);
	}
}

// Update UI with current settings
function updateSettingsUI() {
	try {
		// Camera settings
		document.getElementById('resolution').value = currentSettings.camera.resolution;
		document.getElementById('quality').value = currentSettings.camera.quality;
		document.getElementById('quality-value').textContent = currentSettings.camera.quality;
		document.getElementById('brightness').value = currentSettings.camera.brightness;
		document.getElementById('brightness-value').textContent = currentSettings.camera.brightness;
		document.getElementById('contrast').value = currentSettings.camera.contrast;
		document.getElementById('contrast-value').textContent = currentSettings.camera.contrast;
		document.getElementById('saturation').value = currentSettings.camera.saturation;
		document.getElementById('saturation-value').textContent = currentSettings.camera.saturation;
		document.getElementById('special_effect').value = currentSettings.camera.special_effect;
		document.getElementById('whitebal').checked = currentSettings.camera.whitebal === 1;
		document.getElementById('awb_gain').checked = currentSettings.camera.awb_gain === 1;
		document.getElementById('wb_mode').value = currentSettings.camera.wb_mode;
		document.getElementById('exposure_ctrl').checked = currentSettings.camera.exposure_ctrl === 1;
		document.getElementById('aec2').checked = currentSettings.camera.aec2 === 1;
		document.getElementById('ae_level').value = currentSettings.camera.ae_level;
		document.getElementById('ae_level-value').textContent = currentSettings.camera.ae_level;
		document.getElementById('aec_value').value = currentSettings.camera.aec_value;
		document.getElementById('aec_value-value').textContent = currentSettings.camera.aec_value;
		document.getElementById('gain_ctrl').checked = currentSettings.camera.gain_ctrl === 1;
		document.getElementById('agc_gain').value = currentSettings.camera.agc_gain;
		document.getElementById('agc_gain-value').textContent = currentSettings.camera.agc_gain;
		document.getElementById('gainceiling').value = currentSettings.camera.gainceiling;
		document.getElementById('bpc').checked = currentSettings.camera.bpc === 1;
		document.getElementById('wpc').checked = currentSettings.camera.wpc === 1;
		document.getElementById('raw_gma').checked = currentSettings.camera.raw_gma === 1;
		document.getElementById('lenc').checked = currentSettings.camera.lenc === 1;
		document.getElementById('hmirror').checked = currentSettings.camera.hmirror === 1;
		document.getElementById('vflip').checked = currentSettings.camera.vflip === 1;

		// Motion settings
		document.getElementById('min-area').value = currentSettings.motion.minArea;
		document.getElementById('threshold').value = currentSettings.motion.threshold;
		document.getElementById('threshold-value').textContent = currentSettings.motion.threshold;
		document.getElementById('blur-size').value = currentSettings.motion.blurSize;
		document.getElementById('dilation').value = currentSettings.motion.dilation;
		document.getElementById('dilation-value').textContent = currentSettings.motion.dilation;
	} catch (e) {
		console.log("[-] Error updating settings UI:", e);
		// If there's an error, reset to default settings
		currentSettings = {
			camera: {
				resolution: 'UXGA',
				quality: 12,
				brightness: 0,
				contrast: 0,
				saturation: 0,
				special_effect: 0,
				whitebal: 1,
				awb_gain: 1,
				wb_mode: 0,
				exposure_ctrl: 1,
				aec2: 0,
				ae_level: 0,
				aec_value: 300,
				gain_ctrl: 1,
				agc_gain: 0,
				gainceiling: 0,
				bpc: 0,
				wpc: 1,
				raw_gma: 1,
				lenc: 1,
				hmirror: 0,
				vflip: 0
			},
			motion: {
				minArea: 4000,
				threshold: 25,
				blurSize: 31,
				dilation: 3
			}
		};
		saveSettings();
		updateSettingsUI();
	}
}

// Send settings to server
function sendSettings() {
	if (!ws || ws.readyState !== WebSocket.OPEN) {
		console.log("[-] WebSocket not connected");
		showError();
		return;
	}

	const settingsMessage = {
		type: "settings",
		data: currentSettings
	};
	console.log("[+] Sending settings:", settingsMessage);
	ws.send(JSON.stringify(settingsMessage));
}

// helper for showing/hiding form and error alert
function showConnectionForm() {
	console.log("[+] Showing connection form");
	document.getElementById("loading").classList.add("hidden");
	document.getElementById("controls-container").classList.add("hidden");
	document.getElementById("connection-container").classList.remove("hidden");
}
function hideConnectionForm() {
	console.log("[+] Hiding connection form");
	document.getElementById("loading").classList.remove("hidden");
	document.getElementById("controls-container").classList.remove("hidden");
	document.getElementById("connection-container").classList.add("hidden");
}
function showError() {
	console.log("[-] Showing error message");
	document.getElementById("error-container").classList.remove("hidden");
	document.getElementById("error-container").classList.add("show");
}

// Update status display
function updateStatus(data) {
	console.log("[+] Updating status with data:", data);
	if (data.cameras) {
		const cameraSelect = document.getElementById("camera-select");
		if (cameraSelect) {
			// Store current selection
			const currentSelection = cameraSelect.value;
			
			// Clear existing options
			cameraSelect.innerHTML = "";
			
			// Add options for each camera
			Object.entries(data.cameras).forEach(([cameraId, cameraData]) => {
				const option = document.createElement("option");
				option.value = cameraId;
				option.textContent = `${cameraData.name} (${cameraData.connected ? "Connected" : "Disconnected"})`;
				cameraSelect.appendChild(option);
			});
			
			// Restore previous selection if it exists in the new options
			if (currentSelection && Array.from(cameraSelect.options).some(opt => opt.value === currentSelection)) {
				cameraSelect.value = currentSelection;
				selectedCameraId = currentSelection;
			}
			// Only auto-select first camera if this is the initial connection
			else if (!selectedCameraId && cameraSelect.options.length > 0 && !ws.hasInitialSelection) {
				selectedCameraId = cameraSelect.options[0].value;
				cameraSelect.value = selectedCameraId;
				selectCamera(selectedCameraId);
				ws.hasInitialSelection = true;
			}

			// Update camera status badge
			const cameraStatus = document.getElementById("camera-status");
			if (cameraStatus) {
				const connectedCount = Object.values(data.cameras).filter(cam => cam.connected).length;
				const totalCount = Object.keys(data.cameras).length;
				
				// Check if the selected camera has disconnected
				const selectedCameraDisconnected = selectedCameraId && 
					data.cameras[selectedCameraId] && 
					!data.cameras[selectedCameraId].connected;
				
				if (selectedCameraDisconnected) {
					cameraStatus.textContent = `Camera Disconnected - Attempting to reconnect...`;
					cameraStatus.className = "badge bg-warning";
				} else if (connectedCount === 0) {
					cameraStatus.textContent = "No Cameras Connected";
					cameraStatus.className = "badge bg-danger";
				} else {
					cameraStatus.textContent = `Cameras: ${connectedCount}/${totalCount} Connected`;
					cameraStatus.className = `badge ${connectedCount === totalCount ? 'bg-success' : 'bg-warning'}`;
				}
			}

			// Handle camera disconnection
			if (selectedCameraId && data.cameras[selectedCameraId] && !data.cameras[selectedCameraId].connected) {
				console.log(`[-] Selected camera ${selectedCameraId} disconnected`);
				
				// Update the stream container to show disconnection message
				const streamContainer = document.getElementById("controls-container");
				if (streamContainer) {
					const existingMessage = streamContainer.querySelector(".disconnect-message");
					if (!existingMessage) {
						const disconnectMessage = document.createElement("div");
						disconnectMessage.className = "disconnect-message alert alert-warning";
						disconnectMessage.innerHTML = `
							<strong>Camera Disconnected</strong><br>
							The selected camera has lost connection. The system will attempt to reconnect automatically.
						`;
						streamContainer.insertBefore(disconnectMessage, streamContainer.firstChild);
					}
				}
				
				// Hide the stream and show loading
				const stream = document.getElementById("stream");
				const loading = document.getElementById("loading");
				if (stream) stream.classList.add("hidden");
				if (loading) loading.classList.remove("hidden");
				
				// Clear selection after a delay to allow for reconnection
				setTimeout(() => {
					if (data.cameras[selectedCameraId] && !data.cameras[selectedCameraId].connected) {
						selectedCameraId = null;
						cameraSelect.value = "";
						
						// Remove the disconnect message
						const disconnectMessage = streamContainer.querySelector(".disconnect-message");
						if (disconnectMessage) {
							disconnectMessage.remove();
						}
					}
				}, 5000); // Wait 5 seconds before clearing selection
			} else {
				// Remove disconnect message if it exists and camera is connected
				const disconnectMessage = document.querySelector(".disconnect-message");
				if (disconnectMessage) {
					disconnectMessage.remove();
				}
			}
		}
	} else {
		// No cameras available
		const cameraStatus = document.getElementById("camera-status");
		if (cameraStatus) {
			cameraStatus.textContent = "No Cameras Available";
			cameraStatus.className = "badge bg-danger";
		}
		
		// Clear selection and hide stream
		selectedCameraId = null;
		const cameraSelect = document.getElementById("camera-select");
		if (cameraSelect) {
			cameraSelect.innerHTML = '<option value="">No cameras available</option>';
			cameraSelect.value = "";
		}
		
		// Hide the stream and show loading
		const stream = document.getElementById("stream");
		const loading = document.getElementById("loading");
		if (stream) stream.classList.add("hidden");
		if (loading) loading.classList.remove("hidden");
		
		// Remove any existing disconnect message
		const disconnectMessage = document.querySelector(".disconnect-message");
		if (disconnectMessage) {
			disconnectMessage.remove();
		}
	}
	
	// Update web client count
	const webClientCount = document.getElementById("web-client-count");
	if (webClientCount) {
		webClientCount.textContent = `Web Clients: ${data.web_clients || 0}`;
	}
}

// Add camera name editing functionality
function editCameraName(cameraId, currentName) {
	const newName = prompt("Enter new camera name:", currentName);
	if (newName && newName !== currentName) {
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			console.log("[-] WebSocket not connected");
			return;
		}
		
		const message = {
			type: "camera",
			action: "update_name",
			camera_id: cameraId,
			camera_name: newName
		};
		
		console.log("[+] Sending camera name update:", message);
		ws.send(JSON.stringify(message));
	}
}

// pack websocket message json
function packJSON(msg) {
	const json = { "message": msg };
	console.log("[+] Packing message:", json);
	return JSON.stringify(json);
}

// handle websocket connection
function WSConnection(host, port) {
	// check if connection form fields were empty
	if (!host || !port) {
		console.log("[-] Host or port is empty");
		showError();
		return;
	}
	console.log("[+] Starting connection to", host, ":", port);
	hideConnectionForm();

	// Close existing connection if any
	if (ws) {
		console.log("[+] Closing existing connection");
		ws.close();
	}

	// setup websockets and start receiving images
	const img = document.getElementById('stream');
	if (!img) {
		console.log("[-] Stream element not found!");
		showError();
		return;
	}
	
	const WS_URL = 'ws://' + host + ':' + port;
	console.log("[+] Attempting connection to:", WS_URL);
	
	// Variables for stream handling
	let stream_started = false;
	let urlObject = null;
	
	try {
		ws = new WebSocket(WS_URL);
		ws.hasInitialSelection = false;  // Initialize the flag
		console.log("[+] WebSocket object created");
		
		// Set up connection timeout
		const connectionTimeout = setTimeout(() => {
			if (ws.readyState !== WebSocket.OPEN) {
				console.log("[-] Connection timeout");
				ws.close();
				showError();
			}
		}, 5000);
		
		ws.onopen = () => {
			console.log(`[+] Connected to ${WS_URL}`);
			clearTimeout(connectionTimeout);
			// Send initial message to identify as web client
			const initMessage = packJSON("init");
			console.log("[+] Sending init message:", initMessage);
			try {
				ws.send(initMessage);
				console.log("[+] Init message sent successfully");
				// Send current settings after connection
				sendSettings();
			} catch (error) {
				console.log("[-] Error sending init message:", error);
			}
			console.log("[+] Waiting for initial status update...");
		}

		ws.onerror = (error) => {
			console.log("[-] WebSocket error:", error);
			clearTimeout(connectionTimeout);
			// Update status to show disconnected state
			updateStatus({ camera: false, web_clients: 0 });
			showConnectionForm();
			showError();
			ws = null;
		}

		ws.onclose = (event) => {
			console.log("[-] WebSocket connection closed:", event.code, event.reason);
			clearTimeout(connectionTimeout);
			// Update status to show disconnected state
			updateStatus({ camera: false, web_clients: 0 });
			showConnectionForm();
			ws = null;
		}

		ws.onmessage = (message) => {
			if (message.data instanceof Blob) {
				// Handle binary image data
				if (!stream_started) {
					console.log("[+] Stream started");
					document.getElementById("stream").classList.remove("hidden");
					document.getElementById("loading").classList.add("hidden");
					stream_started = true;
				}
				
				console.log(`[+] Received frame of size: ${message.data.size} bytes`);
				const arrayBuffer = message.data;
				
				if (urlObject) {
					URL.revokeObjectURL(urlObject);
					console.log("[+] Revoked previous frame URL");
				}
				
				urlObject = URL.createObjectURL(new Blob([arrayBuffer]));
				console.log("[+] Created new frame URL");
				
				const img = document.getElementById("stream");
				img.onload = () => console.log("[+] Frame loaded successfully");
				img.onerror = (e) => console.log("[-] Error loading frame:", e);
				img.src = urlObject;
				console.log("[+] Set frame source");
			} else {
				// Handle JSON messages (status updates)
				console.log("[+] Received message type:", typeof message.data);
				try {
					const data = JSON.parse(message.data);
					console.log("[+] Received message:", data);
					if (data.type === "status") {
						console.log("[+] Updating status with:", data.data);
						updateStatus(data.data);
					} else if (data.type === "settings") {
						console.log("[+] Received settings update:", data.data);
						// Merge received settings with current settings
						if (data.data.camera) {
							currentSettings.camera = {
								...currentSettings.camera,
								...data.data.camera
							};
						}
						if (data.data.motion) {
							currentSettings.motion = {
								...currentSettings.motion,
								...data.data.motion
							};
						}
						updateSettingsUI();
						saveSettings();
					} else if (data.type === "camera" && data.message === "name_updated") {
						console.log("[+] Camera name updated:", data);
						// Update the camera name in the dropdown
						const cameraSelect = document.getElementById("camera-select");
						if (cameraSelect) {
							const option = Array.from(cameraSelect.options).find(opt => opt.value === data.camera_id);
							if (option) {
								option.textContent = `${data.camera_name} (Connected)`;
							}
						}
					}
				} catch (e) {
					console.log("[-] Error parsing message:", e);
					console.log("[-] Raw message:", message.data);
				}
			}
		}
	} catch (error) {
		console.log("[-] Error creating WebSocket:", error);
		showError();
		return;
	}

	// handle html button controls
	const buttons = document.querySelectorAll('.button');
	for (let i = 0; i < buttons.length; i++) {
		buttons[i].addEventListener('mousedown', function (e) {
			whichButton(e, true);
			e.preventDefault();
		});
		buttons[i].addEventListener('mouseup', function (e) {
			whichButton(e, false);
			e.preventDefault();
		});
	}

	// gamepad support
	if (gpLib.supportsGamepads()) {
		console.log('[+] Gamepad supported');
		// listen for new controller connected
		window.addEventListener("gamepadconnected", () => {
			console.log("[+] Gamepad connected");
		});

		function gamepadLoop() {
			requestAnimationFrame(gamepadLoop);
			let current_buttons = gpLib.getButtons();
			if (current_buttons) {
				Object.keys(current_buttons).forEach(key => {
					if (current_buttons[key]) {
						ws.send(packJSON(key));
					}
				});
			}
		}
		gamepadLoop();
	}

	return ws;
}

// Motor control functions
function sendMotorCommand(command) {
	if (!ws || ws.readyState !== WebSocket.OPEN) {
		console.error('WebSocket is not connected');
		return;
	}

	if (!selectedCameraId) {
		console.error('No camera selected');
		return;
	}

	const message = {
		type: 'command',
		command: command,
		camera_id: selectedCameraId
	};

	console.log('Sending motor command:', message);
	ws.send(JSON.stringify(message));
}

function whichButton(e, onoff) {
	if (!ws) {
		console.log("[-] WebSocket not connected");
		return;
	}

	if (onoff) {
		if (e.target.classList.contains("forward")) {
			console.log("[+] Forward button pressed");
			sendMotorCommand("forward");
		}
		if (e.target.classList.contains("reverse")) {
			console.log("[+] Reverse button pressed");
			sendMotorCommand("reverse");
		}
		if (e.target.classList.contains("left")) {
			console.log("[+] Left button pressed");
			sendMotorCommand("left");
		}
		if (e.target.classList.contains("right")) {
			console.log("[+] Right button pressed");
			sendMotorCommand("right");
		}
		if (e.target.classList.contains("A")) {
			console.log("[+] Button A pressed");
			sendMotorCommand("AON");
		}
		if (e.target.classList.contains("B")) {
			console.log("[+] Button B pressed");
			sendMotorCommand("BON");
		}
	} else {
		// get button map objects keys
		// turn classList into array
		const directions = Object.keys(gpLib.buttonMap);
		const classes = [].slice.apply(e.target.classList);
		// check if directions are in button map
		// A,B buttons won't match since they are AOFF, BOFF in map
		const hault = classes.some(r => directions.indexOf(r) >= 0);
		if (hault) {
			console.log("[+] Stop command sent");
			sendMotorCommand("hault");
		}
		if (e.target.classList.contains("A")) {
			console.log("[+] Button A released");
			sendMotorCommand("AOFF");
		}
		if (e.target.classList.contains("B")) {
			console.log("[+] Button B released");
			sendMotorCommand("BOFF");
		}
	}
}

// Add keyboard controls for motor
document.addEventListener('keydown', function(e) {
	if (!ws || ws.readyState !== WebSocket.OPEN) {
		return;
	}

	switch(e.key) {
		case 'ArrowUp':
			console.log("[+] Forward key pressed");
			sendMotorCommand("forward");
			break;
		case 'ArrowDown':
			console.log("[+] Reverse key pressed");
			sendMotorCommand("reverse");
			break;
		case 'ArrowLeft':
			console.log("[+] Left key pressed");
			sendMotorCommand("left");
			break;
		case 'ArrowRight':
			console.log("[+] Right key pressed");
			sendMotorCommand("right");
			break;
		case 'a':
		case 'A':
			console.log("[+] A key pressed");
			sendMotorCommand("AON");
			break;
		case 'b':
		case 'B':
			console.log("[+] B key pressed");
			sendMotorCommand("BON");
			break;
	}
});

document.addEventListener('keyup', function(e) {
	if (!ws || ws.readyState !== WebSocket.OPEN) {
		return;
	}

	switch(e.key) {
		case 'ArrowUp':
		case 'ArrowDown':
		case 'ArrowLeft':
		case 'ArrowRight':
			console.log("[+] Stop command sent");
			sendMotorCommand("hault");
			break;
		case 'a':
		case 'A':
			console.log("[+] A key released");
			sendMotorCommand("AOFF");
			break;
		case 'b':
		case 'B':
			console.log("[+] B key released");
			sendMotorCommand("BOFF");
			break;
	}
});

// get values from host and ip fields and start WS connection
document.addEventListener('DOMContentLoaded', function() {
	console.log("[+] DOM loaded, initializing connection");
	
	// Load saved settings
	loadSettings();
	
	// Add camera selection dropdown to the status container
	const statusContainer = document.querySelector('.status-container .card-body');
	if (statusContainer) {
		const cameraSelectDiv = document.createElement('div');
		cameraSelectDiv.className = 'mt-2';
		cameraSelectDiv.innerHTML = `
			<div class="d-flex justify-content-between align-items-center mb-2">
				<label for="camera-select" class="form-label mb-0">Select Camera</label>
				<button type="button" class="btn btn-sm btn-outline-primary" id="edit-camera-name" style="display: none;">
					Edit Name
				</button>
			</div>
			<select class="form-select" id="camera-select" onchange="selectCamera(this.value)">
				<option value="">Loading cameras...</option>
			</select>
		`;
		statusContainer.appendChild(cameraSelectDiv);
		
		// Add event listener for edit name button
		const editButton = document.getElementById("edit-camera-name");
		if (editButton) {
			editButton.addEventListener('click', function() {
				const cameraSelect = document.getElementById("camera-select");
				const selectedOption = cameraSelect.options[cameraSelect.selectedIndex];
				if (selectedOption && selectedOption.value) {
					editCameraName(selectedOption.value, selectedOption.textContent.split(' (')[0]);
				}
			});
		}
	}
	
	// Set up motion settings event listeners
	document.getElementById('min-area').addEventListener('input', function(e) {
		currentSettings.motion.minArea = parseInt(e.target.value);
	});
	
	document.getElementById('threshold').addEventListener('input', function(e) {
		currentSettings.motion.threshold = parseInt(e.target.value);
		document.getElementById('threshold-value').textContent = e.target.value;
	});
	
	document.getElementById('blur-size').addEventListener('change', function(e) {
		currentSettings.motion.blurSize = parseInt(e.target.value);
	});
	
	document.getElementById('dilation').addEventListener('input', function(e) {
		currentSettings.motion.dilation = parseInt(e.target.value);
		document.getElementById('dilation-value').textContent = e.target.value;
	});
	
	// Update motion settings apply button handler
	document.getElementById('apply-motion-settings').addEventListener('click', function() {
		console.log("[+] Applying motion settings:", currentSettings.motion);
		saveSettings();
		sendSettings();
	});
	
	// Set up settings event listeners
	document.getElementById('quality').addEventListener('input', function(e) {
		const quality = parseInt(e.target.value);
		currentSettings.camera.quality = quality;
		document.getElementById('quality-value').textContent = quality;
		
		// Add visual feedback based on quality range
		const qualityValue = document.getElementById('quality-value');
		if (quality <= 15) {
			qualityValue.className = 'text-success';
			qualityValue.title = 'High quality - Good for still images';
		} else if (quality <= 25) {
			qualityValue.className = 'text-primary';
			qualityValue.title = 'Good quality - Recommended for streaming';
		} else if (quality <= 35) {
			qualityValue.className = 'text-warning';
			qualityValue.title = 'Acceptable quality - Smaller file size';
		} else {
			qualityValue.className = 'text-danger';
			qualityValue.title = 'Low quality - Not recommended';
		}
	});
	
	// Add event listeners for all camera settings
	const cameraSettings = [
		'brightness', 'contrast', 'saturation', 'special_effect', 'whitebal',
		'awb_gain', 'wb_mode', 'exposure_ctrl', 'aec2', 'ae_level', 'aec_value',
		'gain_ctrl', 'agc_gain', 'gainceiling', 'bpc', 'wpc', 'raw_gma', 'lenc',
		'hmirror', 'vflip'
	];

	cameraSettings.forEach(setting => {
		const element = document.getElementById(setting);
		if (element) {
			if (element.type === 'checkbox') {
				element.addEventListener('change', function(e) {
					currentSettings.camera[setting] = e.target.checked ? 1 : 0;
				});
			} else if (element.type === 'range') {
				element.addEventListener('input', function(e) {
					currentSettings.camera[setting] = parseInt(e.target.value);
					document.getElementById(`${setting}-value`).textContent = e.target.value;
				});
			} else if (element.type === 'select-one') {
				element.addEventListener('change', function(e) {
					currentSettings.camera[setting] = parseInt(e.target.value);
				});
			}
		}
	});
	
	document.getElementById('apply-camera-settings').addEventListener('click', function() {
		currentSettings.camera.resolution = document.getElementById('resolution').value;
		saveSettings();
		sendSettings();
	});
	
	// Set up LED control buttons
	const ledOnBtn = document.getElementById('led-on');
	const ledOffBtn = document.getElementById('led-off');
	const ledToggleBtn = document.getElementById('led-toggle');
	
	if (ledOnBtn && ledOffBtn && ledToggleBtn) {
		ledOnBtn.addEventListener('click', () => {
			console.log('LED ON button clicked');
			sendLEDCommand('LED_ON');
		});

		ledOffBtn.addEventListener('click', () => {
			console.log('LED OFF button clicked');
			sendLEDCommand('LED_OFF');
		});

		ledToggleBtn.addEventListener('click', () => {
			console.log('LED TOGGLE button clicked');
			sendLEDCommand('LED_TOGGLE');
		});
	} else {
		console.log("[-] LED control buttons not found!");
	}
	
	// Auto-connect to the server
	const host = "192.168.0.156";
	const port = "5000";
	console.log("[+] Auto-connecting to server:", host, ":", port);
	ws = WSConnection(host, port);
	
	// Keep the manual connection form as a fallback
	const connection_button = document.getElementById("connection-submit");
	const host_input = document.getElementById("host-ip");
	const port_input = document.getElementById("host-port");
	
	if (!connection_button || !host_input || !port_input) {
		console.log("[-] Connection form elements not found!");
		return;
	}
	
	// Pre-fill the connection form with default values
	host_input.value = host;
	port_input.value = port;
	
	console.log("[+] Connection form elements found, setting up event listener");
	connection_button.addEventListener('click', function (e) {
		e.preventDefault();
		const host = host_input.value;
		const port = port_input.value;
		console.log("[+] Connection button clicked, host:", host, "port:", port);
		ws = WSConnection(host, port);
	});
});

function selectCamera(cameraId) {
	console.log("[+] Selecting camera:", cameraId);
	if (!cameraId) {
		console.log("[-] No camera ID provided");
		return;
	}
	
	selectedCameraId = cameraId;  // Store the selected camera ID
	
	// Update the select element to match
	const cameraSelect = document.getElementById("camera-select");
	if (cameraSelect) {
		cameraSelect.value = cameraId;
	}
	
	if (ws && ws.readyState === WebSocket.OPEN) {
		const message = {
			type: "web",
			action: "select_camera",
			camera_id: cameraId
		};
		ws.send(JSON.stringify(message));
		console.log("[+] Sent camera selection message:", message);
	} else {
		console.log("[-] WebSocket not connected, cannot select camera");
	}
}

// LED control functions
function sendLEDCommand(command) {
	if (!ws || ws.readyState !== WebSocket.OPEN) {
		console.error('WebSocket is not connected');
		return;
	}

	if (!selectedCameraId) {
		console.error('No camera selected');
		return;
	}

	const message = {
		type: 'command',
		message: command,
		camera_id: selectedCameraId
	};

	console.log('[+] Sending LED command:', message);
	ws.send(JSON.stringify(message));
}

// Add event listener for camera selection
document.getElementById("camera-select").addEventListener("change", function(e) {
	console.log("[+] Camera selection changed:", e.target.value);
	selectCamera(e.target.value);
});
