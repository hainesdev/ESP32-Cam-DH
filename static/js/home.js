// file
// ./static/js/home.js
console.log("[+] home.js loaded and executing");

// stop long click context popup on android
window.oncontextmenu = function () { return false; }

// global websocket object
let ws = null;
let selectedCameraId = null;
let lastFrameTime = null;  // Add variable for tracking frame timing

// Settings state
let cameraSettings = {};  // Store settings for each camera

// Load settings from localStorage
function loadSettings() {
	const savedSettings = localStorage.getItem('cameraSettings');
	if (savedSettings) {
		try {
			const parsedSettings = JSON.parse(savedSettings);
			cameraSettings = parsedSettings;
			// If no settings exist for the selected camera, create default settings
			if (selectedCameraId && !cameraSettings[selectedCameraId]) {
				createDefaultSettings(selectedCameraId);
			}
			updateSettingsUI();
		} catch (e) {
			console.log("[-] Error loading settings:", e);
			// If there's an error, save the default settings
			if (selectedCameraId) {
				createDefaultSettings(selectedCameraId);
			}
			saveSettings();
		}
	} else {
		// If no settings exist, save the default settings
		if (selectedCameraId) {
			createDefaultSettings(selectedCameraId);
		}
		saveSettings();
	}
}

// Create default settings for a camera
function createDefaultSettings(cameraId) {
	cameraSettings[cameraId] = {
		camera: {
			resolution: 'VGA',
			quality: 63,
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
}

// Save settings to localStorage
function saveSettings() {
	try {
		localStorage.setItem('cameraSettings', JSON.stringify(cameraSettings));
	} catch (e) {
		console.log("[-] Error saving settings:", e);
	}
}

// Update UI with current settings
function updateSettingsUI() {
	try {
		if (!selectedCameraId || !cameraSettings[selectedCameraId]) {
			console.log("[-] No camera selected or no settings for camera");
			return;
		}

		const settings = cameraSettings[selectedCameraId];
		
		// Camera settings
		document.getElementById('resolution').value = settings.camera.resolution;
		document.getElementById('quality').value = settings.camera.quality;
		document.getElementById('quality-value').textContent = settings.camera.quality;
		document.getElementById('brightness').value = settings.camera.brightness;
		document.getElementById('brightness-value').textContent = settings.camera.brightness;
		document.getElementById('contrast').value = settings.camera.contrast;
		document.getElementById('contrast-value').textContent = settings.camera.contrast;
		document.getElementById('saturation').value = settings.camera.saturation;
		document.getElementById('saturation-value').textContent = settings.camera.saturation;
		document.getElementById('special_effect').value = settings.camera.special_effect;
		document.getElementById('whitebal').checked = settings.camera.whitebal === 1;
		document.getElementById('awb_gain').checked = settings.camera.awb_gain === 1;
		document.getElementById('wb_mode').value = settings.camera.wb_mode;
		document.getElementById('exposure_ctrl').checked = settings.camera.exposure_ctrl === 1;
		document.getElementById('aec2').checked = settings.camera.aec2 === 1;
		document.getElementById('ae_level').value = settings.camera.ae_level;
		document.getElementById('ae_level-value').textContent = settings.camera.ae_level;
		document.getElementById('aec_value').value = settings.camera.aec_value;
		document.getElementById('aec_value-value').textContent = settings.camera.aec_value;
		document.getElementById('gain_ctrl').checked = settings.camera.gain_ctrl === 1;
		document.getElementById('agc_gain').value = settings.camera.agc_gain;
		document.getElementById('agc_gain-value').textContent = settings.camera.agc_gain;
		document.getElementById('gainceiling').value = settings.camera.gainceiling;
		document.getElementById('bpc').checked = settings.camera.bpc === 1;
		document.getElementById('wpc').checked = settings.camera.wpc === 1;
		document.getElementById('raw_gma').checked = settings.camera.raw_gma === 1;
		document.getElementById('lenc').checked = settings.camera.lenc === 1;
		document.getElementById('hmirror').checked = settings.camera.hmirror === 1;
		document.getElementById('vflip').checked = settings.camera.vflip === 1;

		// Motion settings
		document.getElementById('min-area').value = settings.motion.minArea;
		document.getElementById('threshold').value = settings.motion.threshold;
		document.getElementById('threshold-value').textContent = settings.motion.threshold;
		document.getElementById('blur-size').value = settings.motion.blurSize;
		document.getElementById('dilation').value = settings.motion.dilation;
		document.getElementById('dilation-value').textContent = settings.motion.dilation;
	} catch (e) {
		console.log("[-] Error updating settings UI:", e);
	}
}

// Send settings to server
function sendSettings() {
	if (!ws || ws.readyState !== WebSocket.OPEN) {
		console.error('WebSocket is not connected');
		return;
	}

	if (!selectedCameraId) {
		console.error('No camera selected');
		return;
	}

	if (!cameraSettings[selectedCameraId]) {
		console.error('No settings found for selected camera');
		return;
	}

	const message = {
		type: 'web',
		action: 'settings',
		data: cameraSettings[selectedCameraId]
	};

	console.log('[+] Sending settings:', message);
	ws.send(JSON.stringify(message));
}

// helper for showing/hiding form and error alert
function showConnectionForm() {
	console.log("[+] Showing connection form");
	const loading = document.getElementById("loading");
	const controls = document.getElementById("controls-container");
	const errorContainer = document.getElementById("error-container");
	
	if (loading) loading.classList.add("hidden");
	if (controls) controls.classList.add("hidden");
	if (errorContainer) {
		errorContainer.classList.remove("hidden");
		errorContainer.classList.add("show");
	}
}

function hideConnectionForm() {
	console.log("[+] Hiding connection form");
	const loading = document.getElementById("loading");
	const controls = document.getElementById("controls-container");
	const errorContainer = document.getElementById("error-container");
	
	if (loading) loading.classList.remove("hidden");
	if (controls) controls.classList.remove("hidden");
	if (errorContainer) {
		errorContainer.classList.remove("show");
		errorContainer.classList.add("hidden");
	}
}

function showError() {
	console.log("[-] Showing error message");
	const errorContainer = document.getElementById("error-container");
	if (errorContainer) {
		errorContainer.classList.remove("hidden");
		errorContainer.classList.add("show");
	}
}

// Update status display
function updateStatus(data) {
	console.log("[+] Updating status with data:", data);
	
	// Check if data is null or undefined
	if (!data) {
		console.log("[-] No data provided to updateStatus");
		return;
	}
	
	// Update connection status indicator
	const connectionStatus = document.getElementById("connection-status");
	if (connectionStatus) {
		if (data.cameras && Object.values(data.cameras).some(cam => cam.connected)) {
			connectionStatus.className = "status-dot connected";
		} else if (ws && ws.readyState === WebSocket.OPEN) {
			connectionStatus.className = "status-dot connecting";
		} else {
			connectionStatus.className = "status-dot";
		}
	}

	if (data.cameras) {
		const cameraSelect = document.getElementById("camera-select");
		if (cameraSelect) {
			// Store current selection
			const currentSelection = cameraSelect.value;
			
			// Clear existing options
			cameraSelect.innerHTML = "";
			
			// Add options for each camera, including disconnected ones
			Object.entries(data.cameras).forEach(([cameraId, cameraData]) => {
				const option = document.createElement("option");
				option.value = cameraId;
				// Use the persisted name from the server
				option.textContent = `${cameraData.name} (${cameraData.connected ? "Connected" : "Disconnected"})`;
				cameraSelect.appendChild(option);
			});
			
			// Restore previous selection if it exists in the new options
			if (currentSelection && Array.from(cameraSelect.options).some(opt => opt.value === currentSelection)) {
				cameraSelect.value = currentSelection;
				selectedCameraId = currentSelection;
			}
			// Only auto-select first connected camera if this is the initial connection
			else if (!selectedCameraId && cameraSelect.options.length > 0 && !ws.hasInitialSelection) {
				const firstConnectedCamera = Array.from(cameraSelect.options).find(opt => 
					opt.textContent.includes("Connected")
				);
				if (firstConnectedCamera) {
					selectedCameraId = firstConnectedCamera.value;
					cameraSelect.value = selectedCameraId;
					selectCamera(selectedCameraId);
					ws.hasInitialSelection = true;
				}
			}

			// Show/hide edit name button based on camera selection
			const editButton = document.getElementById("edit-camera-name");
			if (editButton) {
				editButton.style.display = selectedCameraId ? "block" : "none";
			}

			// Update camera status text
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
					cameraStatus.className = "status-text text-warning";
				} else if (connectedCount === 0) {
					cameraStatus.textContent = "No Cameras Connected";
					cameraStatus.className = "status-text text-danger";
				} else {
					cameraStatus.textContent = `Cameras: ${connectedCount}/${totalCount} Connected`;
					cameraStatus.className = "status-text text-success";
				}
			}

			// Update FPS counter for selected camera
			const fpsCounter = document.getElementById("fps-counter");
			if (fpsCounter && selectedCameraId && data.cameras[selectedCameraId]) {
				const fps = data.cameras[selectedCameraId].fps || 0;
				fpsCounter.textContent = `FPS: ${fps.toFixed(1)}`;
			}

			// Show/hide stream and loading message based on selected camera connection status
			const stream = document.getElementById("stream");
			const loading = document.getElementById("loading");
			const connectingMessage = document.querySelector("#controls-container > div > p");
			
			if (stream && loading && connectingMessage) {
				if (selectedCameraId && data.cameras[selectedCameraId] && data.cameras[selectedCameraId].connected) {
					stream.classList.remove("hidden");
					loading.classList.add("hidden");
					connectingMessage.style.display = "none";
				} else {
					stream.classList.add("hidden");
					loading.classList.remove("hidden");
					connectingMessage.style.display = "block";
				}
			}
		}
	} else {
		// No cameras available
		const cameraStatus = document.getElementById("camera-status");
		if (cameraStatus) {
			cameraStatus.textContent = "No Cameras Available";
			cameraStatus.className = "status-text text-danger";
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
	const webClientCount = document.getElementById("web-clients");
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
	let reconnectAttempts = 0;
	const maxReconnectAttempts = 5;
	const reconnectDelay = 5000; // 5 seconds
	
	function attemptReconnect() {
		if (reconnectAttempts < maxReconnectAttempts) {
			reconnectAttempts++;
			console.log(`[+] Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`);
			setTimeout(() => {
				WSConnection(host, port);
			}, reconnectDelay);
		} else {
			console.log("[-] Max reconnection attempts reached");
			showError();
			showConnectionForm();
		}
	}
	
	try {
		ws = new WebSocket(WS_URL);
		ws.hasInitialSelection = false;  // Initialize the flag
		console.log("[+] WebSocket object created");
		
		// Set up connection timeout
		const connectionTimeout = setTimeout(() => {
			if (ws.readyState !== WebSocket.OPEN) {
				console.log("[-] Connection timeout");
				ws.close();
				attemptReconnect();
			}
		}, 10000); // Increased timeout to 10 seconds
		
		ws.onopen = () => {
			console.log(`[+] Connected to ${WS_URL}`);
			clearTimeout(connectionTimeout);
			reconnectAttempts = 0; // Reset reconnection attempts on successful connection
			
			// Clear any existing stream
			const stream = document.getElementById('stream');
			stream.classList.add('hidden');
			document.getElementById('loading').classList.remove('hidden');
			
			// Send initial message to identify as web client
			const initMessage = packJSON("init");
			console.log("[+] Sending init message:", initMessage);
			try {
				ws.send(initMessage);
				console.log("[+] Init message sent successfully");
				
				// If we have a selected camera, re-send the selection
				if (selectedCameraId) {
					console.log("[+] Re-sending camera selection:", selectedCameraId);
					const selectMessage = {
						type: 'web',
						action: 'select_camera',
						camera_id: selectedCameraId
					};
					ws.send(JSON.stringify(selectMessage));
				}
				
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
			// Clear the stream display
			const stream = document.getElementById('stream');
			stream.classList.add('hidden');
			document.getElementById('loading').classList.remove('hidden');
			// Update status to show disconnected state
			updateStatus({ cameras: {}, web_clients: 0 });
			attemptReconnect();
		}

		ws.onclose = (event) => {
			console.log("[-] WebSocket connection closed:", event.code, event.reason);
			clearTimeout(connectionTimeout);
			// Clear the stream display
			const stream = document.getElementById('stream');
			stream.classList.add('hidden');
			document.getElementById('loading').classList.remove('hidden');
			// Update status to show disconnected state
			updateStatus({ cameras: {}, web_clients: 0 });
			attemptReconnect();
		}

		ws.onmessage = function(event) {
			try {
				// Check if the message is binary (Blob)
				if (event.data instanceof Blob) {
					// Only show the stream if we have a selected camera
					if (selectedCameraId) {
						const stream = document.getElementById('stream');
						const url = URL.createObjectURL(event.data);
						stream.src = url;
						stream.classList.remove('hidden');
						document.getElementById('loading').classList.add('hidden');
					}
					return;
				}

				// Handle JSON messages
				const data = JSON.parse(event.data);
				
				if (data && data.type === 'status') {
					// Check if data.data exists before updating status
					if (data.data) {
						updateStatus(data.data);
						// If we have a selected camera but it's not in the status, clear the selection
						if (selectedCameraId && (!data.data.cameras || !data.data.cameras[selectedCameraId])) {
							selectedCameraId = null;
							const stream = document.getElementById('stream');
							stream.classList.add('hidden');
							document.getElementById('loading').classList.remove('hidden');
						}
					} else {
						console.log("[-] Received status message without data");
					}
				} else if (data && data.type === 'settings') {
					// Handle settings received from server
					if (data.data && selectedCameraId) {
						// Update local settings
						cameraSettings[selectedCameraId] = data.data;
						
						// Update UI with received settings
						updateSettingsUI();
						
						// Save settings to localStorage
						saveSettings();
					} else {
						console.log("[-] Received settings message without data or no camera selected");
					}
				} else if (data && data.type === 'camera' && data.message === 'name_updated') {
					// Handle camera name update
					if (data.camera_id && data.camera_name) {
						// Update camera name in the dropdown
						const cameraSelect = document.getElementById('camera-select');
						const option = Array.from(cameraSelect.options).find(opt => opt.value === data.camera_id);
						if (option) {
							option.text = data.camera_name;
						}
						
						// Update camera name in device status
						if (deviceStatus && deviceStatus.cameras && deviceStatus.cameras[data.camera_id]) {
							deviceStatus.cameras[data.camera_id].name = data.camera_name;
						}
					} else {
						console.log("[-] Received camera name update without required data");
					}
				} else {
					console.log("[-] Received unknown message type:", data ? data.type : 'undefined');
				}
			} catch (error) {
				console.error('Error handling WebSocket message:', error);
			}
		};
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
		message: command,
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
	
	// Set up motion settings event listeners
	document.getElementById('min-area').addEventListener('input', function(e) {
		if (!selectedCameraId || !cameraSettings[selectedCameraId]) {
			console.error('No camera selected or settings not found');
			return;
		}
		cameraSettings[selectedCameraId].motion.minArea = parseInt(e.target.value);
	});
	
	document.getElementById('threshold').addEventListener('input', function(e) {
		if (!selectedCameraId || !cameraSettings[selectedCameraId]) {
			console.error('No camera selected or settings not found');
			return;
		}
		cameraSettings[selectedCameraId].motion.threshold = parseInt(e.target.value);
		document.getElementById('threshold-value').textContent = e.target.value;
	});
	
	document.getElementById('blur-size').addEventListener('change', function(e) {
		if (!selectedCameraId || !cameraSettings[selectedCameraId]) {
			console.error('No camera selected or settings not found');
			return;
		}
		cameraSettings[selectedCameraId].motion.blurSize = parseInt(e.target.value);
	});
	
	document.getElementById('dilation').addEventListener('input', function(e) {
		if (!selectedCameraId || !cameraSettings[selectedCameraId]) {
			console.error('No camera selected or settings not found');
			return;
		}
		cameraSettings[selectedCameraId].motion.dilation = parseInt(e.target.value);
		document.getElementById('dilation-value').textContent = e.target.value;
	});
	
	// Update motion settings apply button handler
	document.getElementById('apply-motion-settings').addEventListener('click', function() {
		console.log("[+] Applying motion settings:", cameraSettings[selectedCameraId].motion);
		saveSettings();
		sendSettings();
	});
	
	// Set up event listeners for camera settings
	const cameraSettingsElements = {
		'resolution': 'select-one',
		'quality': 'range',
		'brightness': 'range',
		'contrast': 'range',
		'saturation': 'range',
		'special_effect': 'select-one',
		'whitebal': 'checkbox',
		'awb_gain': 'checkbox',
		'wb_mode': 'select-one',
		'exposure_ctrl': 'checkbox',
		'aec2': 'checkbox',
		'ae_level': 'range',
		'aec_value': 'range',
		'gain_ctrl': 'checkbox',
		'agc_gain': 'range',
		'gainceiling': 'select-one',
		'bpc': 'checkbox',
		'wpc': 'checkbox',
		'raw_gma': 'checkbox',
		'lenc': 'checkbox',
		'hmirror': 'checkbox',
		'vflip': 'checkbox'
	};

	Object.entries(cameraSettingsElements).forEach(([setting, type]) => {
		const element = document.getElementById(setting);
		if (!element) {
			console.error(`Element not found: ${setting}`);
			return;
		}

		if (type === 'checkbox') {
			element.addEventListener('change', function(e) {
				if (!selectedCameraId) {
					console.error('No camera selected');
					return;
				}
				if (!cameraSettings[selectedCameraId]) {
					createDefaultSettings(selectedCameraId);
				}
				cameraSettings[selectedCameraId].camera[setting] = e.target.checked ? 1 : 0;
			});
		} else if (type === 'range') {
			element.addEventListener('input', function(e) {
				if (!selectedCameraId) {
					console.error('No camera selected');
					return;
				}
				if (!cameraSettings[selectedCameraId]) {
					createDefaultSettings(selectedCameraId);
				}
				cameraSettings[selectedCameraId].camera[setting] = parseInt(e.target.value);
				document.getElementById(`${setting}-value`).textContent = e.target.value;
			});
		} else if (type === 'select-one') {
			element.addEventListener('change', function(e) {
				if (!selectedCameraId) {
					console.error('No camera selected');
					return;
				}
				if (!cameraSettings[selectedCameraId]) {
					createDefaultSettings(selectedCameraId);
				}
				cameraSettings[selectedCameraId].camera[setting] = parseInt(e.target.value);
			});
		}
	});
	
	document.getElementById('apply-camera-settings').addEventListener('click', function() {
		if (!selectedCameraId) {
			console.error('No camera selected');
			return;
		}

		// Get current settings for the selected camera
		const settings = cameraSettings[selectedCameraId];
		if (!settings) {
			console.error('No settings found for selected camera');
			return;
		}

		// Update camera settings
		settings.camera.resolution = document.getElementById('resolution').value;
		settings.camera.quality = parseInt(document.getElementById('quality').value);
		settings.camera.brightness = parseInt(document.getElementById('brightness').value);
		settings.camera.contrast = parseInt(document.getElementById('contrast').value);
		settings.camera.saturation = parseInt(document.getElementById('saturation').value);
		settings.camera.special_effect = parseInt(document.getElementById('special_effect').value);
		settings.camera.whitebal = document.getElementById('whitebal').checked ? 1 : 0;
		settings.camera.awb_gain = document.getElementById('awb_gain').checked ? 1 : 0;
		settings.camera.wb_mode = parseInt(document.getElementById('wb_mode').value);
		settings.camera.exposure_ctrl = document.getElementById('exposure_ctrl').checked ? 1 : 0;
		settings.camera.aec2 = document.getElementById('aec2').checked ? 1 : 0;
		settings.camera.ae_level = parseInt(document.getElementById('ae_level').value);
		settings.camera.aec_value = parseInt(document.getElementById('aec_value').value);
		settings.camera.gain_ctrl = document.getElementById('gain_ctrl').checked ? 1 : 0;
		settings.camera.agc_gain = parseInt(document.getElementById('agc_gain').value);
		settings.camera.gainceiling = parseInt(document.getElementById('gainceiling').value);
		settings.camera.bpc = document.getElementById('bpc').checked ? 1 : 0;
		settings.camera.wpc = document.getElementById('wpc').checked ? 1 : 0;
		settings.camera.raw_gma = document.getElementById('raw_gma').checked ? 1 : 0;
		settings.camera.lenc = document.getElementById('lenc').checked ? 1 : 0;
		settings.camera.hmirror = document.getElementById('hmirror').checked ? 1 : 0;
		settings.camera.vflip = document.getElementById('vflip').checked ? 1 : 0;

		// Save settings and send to server
		saveSettings();
		sendSettings();
	});
	
	// Add event listeners for motion settings
	document.getElementById('apply-motion-settings').addEventListener('click', function() {
		if (!selectedCameraId) {
			console.error('No camera selected');
			return;
		}

		// Get current settings for the selected camera
		const settings = cameraSettings[selectedCameraId];
		if (!settings) {
			console.error('No settings found for selected camera');
			return;
		}

		// Update motion settings
		settings.motion.minArea = parseInt(document.getElementById('min-area').value);
		settings.motion.threshold = parseInt(document.getElementById('threshold').value);
		settings.motion.blurSize = parseInt(document.getElementById('blur-size').value);
		settings.motion.dilation = parseInt(document.getElementById('dilation').value);

		// Save settings and send to server
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
});

// handle camera selection
function selectCamera(cameraId) {
	if (!cameraId) {
		console.error('No camera ID provided');
		return;
	}
	
	selectedCameraId = cameraId;
	
	// Send camera selection to server
	if (ws && ws.readyState === WebSocket.OPEN) {
		const message = {
			type: 'web',
			action: 'select_camera',
			camera_id: cameraId
		};
		ws.send(JSON.stringify(message));
		
		// Request settings from server
		const settingsMessage = {
			type: 'web',
			action: 'get_settings',
			camera_id: cameraId
		};
		ws.send(JSON.stringify(settingsMessage));
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
		type: 'web',
		action: 'command',
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
