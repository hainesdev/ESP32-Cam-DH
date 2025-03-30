# file: classes/WSServer.py
import asyncio
import websockets
import json
import time
import cv2
import numpy as np
from collections import deque
from io import BytesIO
import base64
from concurrent.futures import ThreadPoolExecutor
from queue import Queue, Empty
import threading
import cProfile
import pstats
from functools import wraps
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)  # Change to INFO for less verbose logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

def profile_function(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        profiler = cProfile.Profile()
        try:
            return profiler.runcall(func, *args, **kwargs)
        finally:
            stats = pstats.Stats(profiler)
            stats.sort_stats('cumulative')
            # Only print top 5 time-consuming operations
            stats.print_stats(5)
    return wrapper

class WSServer:
    def __init__(self, host='0.0.0.0', port=5000):
        self.host = host
        self.port = port
        self.server = None
        self.clients = set()
        self.camera_clients = {}  # Dictionary to store camera clients with their IDs
        self.web_clients = {}  # Dictionary to store web clients with their selected cameras
        self.commands_queue = deque(maxlen=10)  # Store recent commands for new clients
        self.device_status = {
            'cameras': {},  # Dictionary to store camera statuses
            'web_clients': 0
        }
        # Initialize OpenCV variables with per-camera settings
        self.prev_frames = {}  # Dictionary to store previous frames for each camera
        self.frame_queues = {}  # Dictionary to store frame queues for each camera
        self.processing_threads = {}  # Dictionary to store processing threads for each camera
        self.stop_processing = {}  # Dictionary to store stop flags for each camera
        self.thread_locks = {}  # Dictionary to store thread locks for each camera
        self.frame_counts = {}  # Dictionary to store frame counts for each camera
        self.last_fps_update = {}  # Dictionary to store last FPS update time for each camera
        self.fps = {}  # Dictionary to store FPS for each camera
        self.frame_times = {}  # Dictionary to store frame processing times for each camera
        self.last_frame_time = {}  # Dictionary to store last frame time for each camera
        self.thread_pool = ThreadPoolExecutor(max_workers=4)  # Thread pool for processing frames
        self.loop = asyncio.new_event_loop()  # Create a new event loop
        asyncio.set_event_loop(self.loop)  # Set it as the current event loop
        
        # Set up logging
        logging.basicConfig(level=logging.INFO)  # Change to INFO for less verbose logging
        self.logger = logging.getLogger(__name__)
        self.logger.setLevel(logging.INFO)
        
        # Initialize camera settings
        self.camera_settings = {}
        self.camera_motion_settings = {}
        self.default_camera_settings = {
            'resolution': 'VGA',
            'quality': 12,
            'brightness': 0,
            'contrast': 0,
            'saturation': 0,
            'special_effect': 0,
            'whitebal': 1,
            'awb_gain': 1,
            'wb_mode': 0,
            'exposure_ctrl': 1,
            'aec2': 0,
            'ae_level': 0,
            'aec_value': 300,
            'gain_ctrl': 1,
            'agc_gain': 0,
            'gainceiling': 0,
            'bpc': 0,
            'wpc': 1,
            'raw_gma': 1,
            'lenc': 1,
            'hmirror': 0,
            'vflip': 0
        }
        self.default_motion_settings = {
            'min_area': 4000,
            'threshold': 25,
            'blur_size': 31,
            'dilation': 3,
            'max_fps': 30  # Add max_fps setting
        }
        # Load saved settings if they exist
        self.load_settings()
        print(f"[+] WSServer initialized with host={host}, port={port}")
        
        # Add performance monitoring
        self.frame_times = {}
        self.frame_counts = {}
        self.last_fps_update = {}
        self.fps = {}
        self.last_frame_time = {}

    def load_settings(self):
        """Load settings from file"""
        try:
            with open('camera_settings.json', 'r') as f:
                saved_settings = json.load(f)
                if 'motion' in saved_settings:
                    self.default_motion_settings.update(saved_settings['motion'])
                if 'cameras' in saved_settings:
                    self.camera_settings = saved_settings['cameras']
                if 'camera_names' in saved_settings:
                    # Update camera names in device status
                    for camera_id, name in saved_settings['camera_names'].items():
                        if camera_id in self.device_status['cameras']:
                            self.device_status['cameras'][camera_id]['name'] = name
                        else:
                            # Create entry for disconnected camera
                            self.device_status['cameras'][camera_id] = {
                                'connected': False,
                                'name': name,
                                'last_seen': time.time(),
                                'fps': 0
                            }
            print("[+] Settings loaded successfully")
        except FileNotFoundError:
            print("[+] No settings file found, using defaults")
        except Exception as e:
            print(f"[-] Error loading settings: {e}")

    def save_settings(self):
        """Save settings to file"""
        # Create camera names dictionary, preserving existing names
        camera_names = {}
        for camera_id, info in self.device_status['cameras'].items():
            # Only save names for cameras that have been renamed
            if info.get('name') and info['name'] != f'Camera {camera_id}':
                camera_names[camera_id] = info['name']

        settings = {
            'motion': self.default_motion_settings,
            'cameras': self.camera_settings,
            'camera_names': camera_names
        }
        try:
            with open('camera_settings.json', 'w') as f:
                json.dump(settings, f)
            print("[+] Settings saved successfully")
        except Exception as e:
            print(f"[-] Error saving settings: {e}")

    def get_camera_settings(self, camera_id):
        """Get settings for a specific camera, creating default if not exists"""
        if camera_id not in self.camera_settings:
            self.camera_settings[camera_id] = self.default_camera_settings.copy()
        return self.camera_settings[camera_id]

    async def apply_camera_settings(self, camera_id):
        """Apply saved settings to a camera"""
        if camera_id in self.camera_clients:
            settings = self.get_camera_settings(camera_id)
            camera_settings_message = {
                "type": "settings",
                "data": {"camera": settings}
            }
            try:
                await self.camera_clients[camera_id].send(json.dumps(camera_settings_message))
                print(f"[+] Applied settings to camera {camera_id}")
            except Exception as e:
                print(f"[-] Error applying settings to camera {camera_id}: {e}")
                import traceback
                traceback.print_exc()

    def get_camera_motion_settings(self, camera_id):
        """Get motion settings for a specific camera, creating default if not exists"""
        if camera_id not in self.camera_motion_settings:
            self.camera_motion_settings[camera_id] = self.default_motion_settings.copy()
        return self.camera_motion_settings[camera_id]

    def detect_motion(self, frame, camera_id):
        """Detect motion in the frame using camera-specific settings"""
        try:
            start_time = time.time()
            
            # Validate input frame
            if frame is None:
                return None

            # Get frame dimensions
            height, width = frame.shape[:2]
            if width == 0 or height == 0:
                return None

            # Get camera-specific motion settings
            settings = self.get_camera_motion_settings(camera_id)

            # Optimize frame size for motion detection
            scale_factor = 0.5  # Reduce frame size for faster processing
            small_frame = cv2.resize(frame, (int(width * scale_factor), int(height * scale_factor)))

            # Convert frame to grayscale
            gray = cv2.cvtColor(small_frame, cv2.COLOR_BGR2GRAY)
            
            # Apply Gaussian blur with optimized kernel size
            blurred = cv2.GaussianBlur(gray, (settings['blur_size'], settings['blur_size']), 0)
            
            # Calculate frame difference
            if camera_id not in self.prev_frames or self.prev_frames[camera_id] is None:
                self.prev_frames[camera_id] = blurred
                return frame
            
            # Ensure both frames have the same size before comparison
            if self.prev_frames[camera_id].shape != blurred.shape:
                self.prev_frames[camera_id] = cv2.resize(self.prev_frames[camera_id], (blurred.shape[1], blurred.shape[0]))
            
            frame_diff = cv2.absdiff(self.prev_frames[camera_id], blurred)
            self.prev_frames[camera_id] = blurred
            
            # Threshold the difference
            _, thresh = cv2.threshold(frame_diff, settings['threshold'], 255, cv2.THRESH_BINARY)
            
            # Dilate the thresholded image with optimized kernel
            kernel = np.ones((3,3), np.uint8)  # Reduced kernel size
            dilated = cv2.dilate(thresh, kernel, iterations=settings['dilation'])
            
            # Find contours
            contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            # Draw bounding boxes around moving objects
            for contour in contours:
                if cv2.contourArea(contour) > settings['min_area']:
                    x, y, w, h = cv2.boundingRect(contour)
                    # Scale coordinates back to original frame size
                    x = int(x / scale_factor)
                    y = int(y / scale_factor)
                    w = int(w / scale_factor)
                    h = int(h / scale_factor)
                    cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
            
            # Update performance metrics
            processing_time = time.time() - start_time
            self.frame_times[camera_id] = self.frame_times.get(camera_id, [])
            self.frame_times[camera_id].append(processing_time)
            
            # Keep only last 30 frames for FPS calculation
            if len(self.frame_times[camera_id]) > 30:
                self.frame_times[camera_id].pop(0)
            
            return frame
            
        except Exception as e:
            return frame

    def process_frames(self, camera_id):
        """Process frames for a specific camera in a separate thread"""
        print(f"[+] Starting frame processing for camera {camera_id}")
        settings = self.get_camera_motion_settings(camera_id)
        
        # Initialize frame timing
        last_frame_time = time.time()
        frame_interval = 1.0 / settings.get('max_fps', 30)  # Default to 30 FPS if not set
        frame_count = 0
        fps_update_interval = 1.0  # Update FPS every second
        last_fps_update = time.time()
        
        while not self.stop_processing.get(camera_id, False):
            try:
                # Get frame from queue with timeout
                frame_data = self.frame_queues[camera_id].get(timeout=1.0)
                if frame_data is None:  # Poison pill to stop processing
                    print(f"[+] Stopping frame processing for camera {camera_id}")
                    break

                # Track frame arrival time for FPS calculation
                current_time = time.time()
                frame_count += 1
                
                # Calculate and update FPS every second
                if current_time - last_fps_update >= fps_update_interval:
                    fps = frame_count / (current_time - last_fps_update)
                    self.fps[camera_id] = fps
                    frame_count = 0
                    last_fps_update = current_time
                    
                    # Update device status with current FPS
                    if camera_id in self.device_status['cameras']:
                        self.device_status['cameras'][camera_id]['fps'] = fps
                        self.device_status['cameras'][camera_id]['last_seen'] = current_time

                # Control frame rate
                if current_time - last_frame_time < frame_interval:
                    continue
                last_frame_time = current_time

                # Validate frame data
                if len(frame_data) < 100:
                    continue

                # Convert binary data to numpy array
                nparr = np.frombuffer(frame_data, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if frame is None:
                    continue

                # Validate frame dimensions
                height, width = frame.shape[:2]
                if width == 0 or height == 0:
                    continue

                # Check for minimum frame size
                if width < 100 or height < 100:
                    continue

                # Detect motion and draw bounding boxes
                processed_frame = self.detect_motion(frame, camera_id)
                
                if processed_frame is None:
                    continue
                
                # Encode the processed frame back to JPEG with optimized quality
                _, buffer = cv2.imencode('.jpg', processed_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                
                # Validate encoded frame
                if len(buffer) < 100:
                    continue
                    
                # Broadcast processed frame to clients that have selected this camera
                try:
                    # Create a new event loop for this thread if needed
                    try:
                        loop = asyncio.get_event_loop()
                    except RuntimeError:
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                    
                    # Run the broadcast coroutine in the event loop
                    loop.run_until_complete(self.broadcast_to_web_clients(buffer.tobytes(), camera_id))
                except Exception as e:
                    print(f"[-] Error broadcasting frame for camera {camera_id}: {e}")
                    import traceback
                    traceback.print_exc()
                    
            except Empty:
                continue
            except Exception as e:
                print(f"[-] Error processing frames for camera {camera_id}: {e}")
                import traceback
                traceback.print_exc()
                continue

    def start_processing_thread(self, camera_id):
        """Start a new processing thread for a camera"""
        print(f"[+] Starting processing thread for camera {camera_id}")
        with self.thread_locks.get(camera_id, threading.Lock()):
            if camera_id not in self.processing_threads or not self.processing_threads[camera_id].is_alive():
                # Initialize frame queue if not exists
                if camera_id not in self.frame_queues:
                    self.frame_queues[camera_id] = Queue()
                    print(f"[+] Created frame queue for camera {camera_id}")
                
                # Initialize stop flag if not exists
                if camera_id not in self.stop_processing:
                    self.stop_processing[camera_id] = False
                    print(f"[+] Initialized stop flag for camera {camera_id}")
                
                # Initialize thread lock if not exists
                if camera_id not in self.thread_locks:
                    self.thread_locks[camera_id] = threading.Lock()
                    print(f"[+] Created thread lock for camera {camera_id}")
                
                # Create and start the processing thread
                self.processing_threads[camera_id] = threading.Thread(
                    target=self.process_frames,
                    args=(camera_id,),
                    daemon=True
                )
                self.processing_threads[camera_id].start()
                print(f"[+] Started processing thread for camera {camera_id}")
            else:
                print(f"[!] Processing thread already running for camera {camera_id}")

    def stop_processing_thread(self, camera_id):
        """Stop the processing thread for a camera"""
        with self.thread_locks.get(camera_id, threading.Lock()):
            if camera_id in self.stop_processing:
                self.stop_processing[camera_id] = True
                if camera_id in self.frame_queues:
                    # Clear the queue and add poison pill
                    while not self.frame_queues[camera_id].empty():
                        try:
                            self.frame_queues[camera_id].get_nowait()
                        except Empty:
                            break
                    self.frame_queues[camera_id].put(None)  # Poison pill
                if camera_id in self.processing_threads:
                    self.processing_threads[camera_id].join(timeout=1.0)
                    print(f"[-] Stopped processing thread for camera {camera_id}")
                    # Remove the thread from the dictionary
                    self.processing_threads.pop(camera_id, None)

    async def handle_settings(self, settings, websocket):
        """Handle settings updates from clients"""
        print(f"[+] Received settings update: {settings}")
        
        # Extract settings from web client format if needed
        if isinstance(settings, dict) and 'data' in settings:
            settings = settings['data']
        
        # Get the selected camera ID for this web client
        selected_camera_id = self.web_clients.get(websocket)
        if not selected_camera_id:
            print("[-] No camera selected for settings update")
            return
        
        settings_updated = False
        
        if 'motion' in settings:
            motion_settings = settings['motion']
            # Update motion settings only for the selected camera
            if selected_camera_id not in self.camera_motion_settings:
                self.camera_motion_settings[selected_camera_id] = self.default_motion_settings.copy()
            self.camera_motion_settings[selected_camera_id].update(motion_settings)
            print(f"[+] Updated motion settings for camera {selected_camera_id}: {motion_settings}")
            settings_updated = True
        
        if 'camera' in settings:
            camera_settings = settings['camera']
            # Update settings only for the selected camera
            if selected_camera_id not in self.camera_settings:
                self.camera_settings[selected_camera_id] = self.default_camera_settings.copy()
            self.camera_settings[selected_camera_id].update(camera_settings)
            print(f"[+] Updated camera settings for camera {selected_camera_id}: {camera_settings}")
            
            # Send camera settings to the specific camera
            camera_settings_message = {
                "type": "settings",
                "data": {"camera": camera_settings}
            }
            if selected_camera_id in self.camera_clients:
                try:
                    await self.camera_clients[selected_camera_id].send(json.dumps(camera_settings_message))
                    print(f"[+] Applied settings to camera {selected_camera_id}")
                except Exception as e:
                    print(f"[-] Error sending camera settings to client: {e}")
                    import traceback
                    traceback.print_exc()
            settings_updated = True
        
        if settings_updated:
            # Save settings to file
            self.save_settings()
            
            # Broadcast updated settings to all web clients that have selected this camera
            settings_message = {
                "type": "settings",
                "data": {
                    "motion": self.camera_motion_settings.get(selected_camera_id, self.default_motion_settings),
                    "camera": self.camera_settings.get(selected_camera_id, self.default_camera_settings)
                }
            }
            
            # Send to all web clients that have selected this camera
            for client, selected_cam in self.web_clients.items():
                if selected_cam == selected_camera_id:
                    try:
                        await client.send(json.dumps(settings_message))
                        print(f"[+] Sent settings update to web client for camera {selected_camera_id}")
                    except Exception as e:
                        print(f"[-] Error sending settings update to web client: {e}")
                        import traceback
                        traceback.print_exc()

    async def broadcast_status(self):
        """Broadcast current device status to all web clients"""
        status_message = json.dumps({
            "type": "status",
            "data": self.device_status
        })
        print(f"[+] Broadcasting status: {status_message}")
        
        # Send to all web clients directly
        for client, selected_cam in self.web_clients.items():
            try:
                # Only send status to clients that have selected a camera
                if selected_cam is not None:
                    await client.send(status_message)
                    print(f"[+] Status sent to web client for camera {selected_cam}")
                else:
                    # For clients without a selected camera, send status to all clients
                    await client.send(status_message)
                    print(f"[+] Status sent to web client")
            except websockets.exceptions.ConnectionClosed:
                print("[-] Web client connection closed")
                await self.unregister(client)
            except Exception as e:
                print(f"[-] Error sending status to client: {e}")
                import traceback
                traceback.print_exc()

    async def register(self, websocket):
        """Register a new client and identify if it's a camera or web client"""
        try:
            message = await websocket.recv()
            
            if isinstance(message, str):
                try:
                    data = json.loads(message)
                    if data.get('type') == 'camera':
                        camera_id = data.get('camera_id')
                        if camera_id:
                            # Store the camera client with its unique ID
                            self.camera_clients[camera_id] = websocket
                            
                            # Initialize or update camera info in device status
                            if camera_id not in self.device_status['cameras']:
                                self.device_status['cameras'][camera_id] = {
                                    'connected': True,
                                    'name': data.get('camera_name', f'Camera {camera_id}'),
                                    'last_seen': time.time(),
                                    'fps': 0
                                }
                            else:
                                # Update existing camera info while preserving the name
                                self.device_status['cameras'][camera_id].update({
                                    'connected': True,
                                    'last_seen': time.time(),
                                    'fps': 0
                                })
                            
                            print(f"[+] Camera {camera_id} connected")
                            
                            # Reset processing thread state for this camera
                            if camera_id in self.stop_processing:
                                self.stop_processing[camera_id] = False
                            if camera_id in self.frame_queues:
                                # Clear the queue
                                while not self.frame_queues[camera_id].empty():
                                    try:
                                        self.frame_queues[camera_id].get_nowait()
                                    except Empty:
                                        break
                            
                            # Apply saved settings to the camera
                            await self.apply_camera_settings(camera_id)
                            await self.broadcast_status()
                            return
                except json.JSONDecodeError:
                    pass
            else:
                camera_id = self._get_camera_id_from_websocket(websocket)
                if camera_id:
                    self.camera_clients[camera_id] = websocket
                    
                    # Initialize or update camera info in device status
                    if camera_id not in self.device_status['cameras']:
                        self.device_status['cameras'][camera_id] = {
                            'connected': True,
                            'name': f'Camera {camera_id}',
                            'last_seen': time.time(),
                            'fps': 0
                        }
                    else:
                        # Update existing camera info while preserving the name
                        self.device_status['cameras'][camera_id].update({
                            'connected': True,
                            'last_seen': time.time(),
                            'fps': 0
                        })
                    
                    print(f"[+] Camera {camera_id} connected")
                    
                    # Reset processing thread state for this camera
                    if camera_id in self.stop_processing:
                        self.stop_processing[camera_id] = False
                    if camera_id in self.frame_queues:
                        # Clear the queue
                        while not self.frame_queues[camera_id].empty():
                            try:
                                self.frame_queues[camera_id].get_nowait()
                            except Empty:
                                break
                    
                    # Apply saved settings to the camera
                    await self.apply_camera_settings(camera_id)
                    await self.broadcast_status()
                    return
            
            # If we get here, this is a web client
            self.web_clients[websocket] = None
            self.device_status['web_clients'] = len(self.web_clients)
            print("[+] Web client connected")
            await self.broadcast_status()
            
        except websockets.exceptions.ConnectionClosed:
            print("[-] Connection closed during registration")
        except Exception as e:
            print(f"[-] Error during registration: {str(e)}")
    
    def _get_camera_id_from_websocket(self, websocket):
        """Get camera ID from websocket connection"""
        for camera_id, client in self.camera_clients.items():
            if client == websocket:
                return camera_id
        return None
    
    async def unregister(self, websocket):
        """Unregister a client"""
        camera_id = self._get_camera_id_from_websocket(websocket)
        if camera_id:
            self.camera_clients.pop(camera_id, None)
            if camera_id in self.device_status['cameras']:
                self.device_status['cameras'][camera_id]['connected'] = False
                self.device_status['cameras'][camera_id]['last_seen'] = time.time()
            # Stop the processing thread for this camera
            self.stop_processing_thread(camera_id)
            print(f"[-] Camera {camera_id} disconnected")
        elif websocket in self.web_clients:
            self.web_clients.pop(websocket, None)
            self.device_status['web_clients'] = len(self.web_clients)
            print("[-] Web client disconnected")
        
        await self.broadcast_status()

    async def broadcast_to_web_clients(self, message, camera_id=None):
        """Broadcast message to all web clients"""
        if not self.web_clients:
            return
        
        # Create a copy of the web clients dictionary to avoid modification during iteration
        web_clients = self.web_clients.copy()
        for client, selected_cam in web_clients.items():
            try:
                # Only send frame to clients that have selected this camera
                if isinstance(message, bytes) and camera_id is not None:
                    # If client hasn't selected a camera yet, send the frame
                    if selected_cam is None:
                        await client.send(message)
                    # If client has selected a camera, only send if it matches
                    elif selected_cam == camera_id:
                        await client.send(message)
                else:
                    # For non-frame messages (like status updates), send to all clients
                    await client.send(message)
            except websockets.exceptions.ConnectionClosed:
                await self.unregister(client)
            except Exception as e:
                print(f"[-] Error broadcasting to web client: {str(e)}")
                import traceback
                traceback.print_exc()
    
    async def handle_message(self, websocket, message):
        """Handle incoming messages"""
        try:
            if isinstance(message, str):
                # Handle JSON messages
                data = json.loads(message)
                if data.get('type') == 'camera':
                    # Handle camera messages
                    camera_id = data.get('camera_id')
                    if camera_id and camera_id in self.camera_clients:
                        if data.get('action') == 'update_name':
                            # Handle camera name update
                            new_name = data.get('camera_name')
                            if new_name:
                                # Update the camera name in device status
                                self.device_status['cameras'][camera_id]['name'] = new_name
                                # Save settings to persist the name
                                self.save_settings()
                                # Send confirmation to web clients
                                name_update_message = {
                                    "type": "camera",
                                    "message": "name_updated",
                                    "camera_id": camera_id,
                                    "camera_name": new_name
                                }
                                await self.broadcast_to_web_clients(json.dumps(name_update_message))
                                # Broadcast updated status to all clients
                                await self.broadcast_status()
                        else:
                            self.device_status['cameras'][camera_id]['last_seen'] = time.time()
                            await self.broadcast_status()
                elif data.get('type') == 'web':
                    # Handle web client messages
                    if data.get('action') == 'select_camera':
                        camera_id = data.get('camera_id')
                        if camera_id in self.device_status['cameras']:
                            self.web_clients[websocket] = camera_id
                            # Send confirmation to the web client
                            await websocket.send(json.dumps({
                                "type": "status",
                                "message": "camera_selected",
                                "camera_id": camera_id
                            }))
                            await self.broadcast_status()
                    elif data.get('action') == 'get_settings':
                        camera_id = data.get('camera_id')
                        if camera_id:
                            # Get current settings for the camera
                            camera_settings = self.get_camera_settings(camera_id)
                            motion_settings = self.get_camera_motion_settings(camera_id)
                            
                            # Send settings to the web client
                            settings_message = {
                                "type": "settings",
                                "data": {
                                    "camera": camera_settings,
                                    "motion": motion_settings
                                }
                            }
                            await websocket.send(json.dumps(settings_message))
                    elif data.get('action') == 'command':
                        # Handle command messages
                        command = data.get('message')
                        camera_id = data.get('camera_id')
                        if command and camera_id and camera_id in self.camera_clients:
                            # Forward the command to the specific camera
                            command_message = {
                                "type": "command",
                                "message": command
                            }
                            await self.camera_clients[camera_id].send(json.dumps(command_message))
                    elif data.get('action') == 'settings':
                        # Handle settings messages
                        settings = data.get('data')
                        if settings:
                            await self.handle_settings(settings, websocket)
            else:
                # Handle binary messages (camera frames)
                camera_id = self._get_camera_id_from_websocket(websocket)
                if camera_id:
                    self.device_status['cameras'][camera_id]['last_seen'] = time.time()
                    
                    # Start processing thread if not already running
                    self.start_processing_thread(camera_id)
                    
                    # Add frame to processing queue
                    if camera_id in self.frame_queues:
                        self.frame_queues[camera_id].put(message)
                    else:
                        print(f"[-] No frame queue found for camera {camera_id}")
                    
                    await self.broadcast_status()
                else:
                    print("[-] Received frame from unknown camera")
        except Exception as e:
            print(f"[-] Error handling message: {str(e)}")
            import traceback
            traceback.print_exc()
    
    async def start(self):
        """Start the WebSocket server"""
        async with websockets.serve(
            self._handler,
            self.host,
            self.port,
            ping_interval=30,  # Increased from 20 to 30 seconds
            ping_timeout=20,   # Increased from 10 to 20 seconds
            close_timeout=20,  # Increased from 10 to 20 seconds
            max_size=10_000_000,  # 10MB max message size
            compression=None,  # Disable compression for better performance
            max_queue=32,      # Maximum queue size for pending connections
            read_limit=2**16,  # 64KB read buffer
            write_limit=2**16  # 64KB write buffer
        ):
            print(f"[+] WebSocket server started on ws://{self.host}:{self.port}")
            await asyncio.Future()  # run forever
    
    async def _handler(self, websocket, path):
        """Handle new WebSocket connections"""
        await self.register(websocket)
        try:
            async for message in websocket:
                await self.handle_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            await self.unregister(websocket)
    
    def cleanup(self):
        """Clean up resources before server shutdown"""
        print("[+] Cleaning up server resources...")
        
        # Stop all processing threads
        for camera_id in list(self.processing_threads.keys()):
            self.stop_processing_thread(camera_id)
        
        # Clear all queues
        for camera_id in list(self.frame_queues.keys()):
            while not self.frame_queues[camera_id].empty():
                try:
                    self.frame_queues[camera_id].get_nowait()
                except Empty:
                    break
            self.frame_queues[camera_id].put(None)  # Poison pill
        
        # Clear all dictionaries
        self.prev_frames.clear()
        self.frame_queues.clear()
        self.processing_threads.clear()
        self.stop_processing.clear()
        self.thread_locks.clear()
        self.frame_counts.clear()
        self.last_fps_update.clear()
        self.fps.clear()
        self.frame_times.clear()
        self.last_frame_time.clear()
        
        # Shutdown thread pool
        self.thread_pool.shutdown(wait=True)
        
        # Close event loop if it's still running
        if not self.loop.is_closed():
            self.loop.close()
        
        print("[+] Server cleanup completed")

    def __del__(self):
        """Cleanup when the server is destroyed"""
        self.cleanup()

    def run(self):
        """Start the WebSocket server"""
        async def main():
            try:
                self.server = await websockets.serve(
                    self._handler,
                    self.host,
                    self.port,
                    ping_interval=30,  # Increased from 20 to 30 seconds
                    ping_timeout=20,   # Increased from 10 to 20 seconds
                    close_timeout=20,  # Increased from 10 to 20 seconds
                    max_size=10_000_000,  # 10MB max message size
                    compression=None,  # Disable compression for better performance
                    max_queue=32,      # Maximum queue size for pending connections
                    read_limit=2**16,  # 64KB read buffer
                    write_limit=2**16  # 64KB write buffer
                )
                print(f"[+] WebSocket server running on ws://{self.host}:{self.port}")
                await self.server.wait_closed()
            except Exception as e:
                print(f"[-] Server error: {e}")
                self.cleanup()  # Ensure cleanup on error
        
        try:
            # Run the server in the event loop
            self.loop.run_until_complete(main())
        except KeyboardInterrupt:
            print("[+] Shutting down WebSocket server")
            self.cleanup()  # Ensure cleanup on interrupt
        except Exception as e:
            print(f"[-] Server error: {e}")
            self.cleanup()  # Ensure cleanup on error
        finally:
            self.cleanup()  # Ensure cleanup in all cases 