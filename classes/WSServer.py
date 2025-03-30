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

class WSServer:
    def __init__(self, host='0.0.0.0', port=5000):
        self.host = host
        self.port = port
        self.server = None
        self.clients = set()
        self.camera_clients = {}  # Dictionary to store camera clients with their IDs
        self.web_clients = set()  # Set to store web clients
        self.commands_queue = deque(maxlen=10)  # Store recent commands for new clients
        self.device_status = {
            'cameras': {},  # Dictionary to store camera statuses
            'web_clients': 0
        }
        # Initialize OpenCV variables
        self.prev_frames = {}  # Dictionary to store previous frames for each camera
        self.min_area = 4000  # Increased for UXGA resolution
        self.threshold = 25
        self.blur_size = 31
        self.dilation_iterations = 3
        self.process_every_n_frames = 2
        self.frame_counter = 0
        # Camera settings
        self.camera_settings = {
            'resolution': 'UXGA',
            'quality': 12,
            'brightness': 0,
            'contrast': 0
        }
        # Load saved settings if they exist
        self.load_settings()
        self.selected_camera = None  # Currently selected camera ID
        print(f"[+] WSServer initialized with host={host}, port={port}")
        
    def load_settings(self):
        try:
            with open('camera_settings.json', 'r') as f:
                saved_settings = json.load(f)
                if 'motion' in saved_settings:
                    self.min_area = saved_settings['motion'].get('minArea', self.min_area)
                    self.threshold = saved_settings['motion'].get('threshold', self.threshold)
                    self.blur_size = saved_settings['motion'].get('blurSize', self.blur_size)
                    self.dilation_iterations = saved_settings['motion'].get('dilation', self.dilation_iterations)
                if 'camera' in saved_settings:
                    self.camera_settings = saved_settings['camera']
        except FileNotFoundError:
            pass

    def save_settings(self):
        settings = {
            'motion': {
                'minArea': self.min_area,
                'threshold': self.threshold,
                'blurSize': self.blur_size,
                'dilation': self.dilation_iterations
            },
            'camera': self.camera_settings
        }
        with open('camera_settings.json', 'w') as f:
            json.dump(settings, f)

    def handle_settings(self, settings):
        """Handle settings updates from clients"""
        print(f"[+] Received settings update: {settings}")
        
        if 'motion' in settings:
            motion_settings = settings['motion']
            self.min_area = motion_settings.get('minArea', self.min_area)
            self.threshold = motion_settings.get('threshold', self.threshold)
            self.blur_size = motion_settings.get('blurSize', self.blur_size)
            self.dilation_iterations = motion_settings.get('dilation', self.dilation_iterations)
            print(f"[+] Updated motion settings: min_area={self.min_area}, threshold={self.threshold}, blur_size={self.blur_size}, dilation={self.dilation_iterations}")
        
        if 'camera' in settings:
            self.camera_settings = settings['camera']
            print(f"[+] Updated camera settings: {self.camera_settings}")
            
            # Send camera settings to all camera clients
            camera_settings_message = {
                "type": "settings",
                "data": {"camera": self.camera_settings}
            }
            for client in self.camera_clients:
                try:
                    client.send(json.dumps(camera_settings_message))
                except Exception as e:
                    print(f"[-] Error sending camera settings to client: {e}")
        
        # Save settings to file
        self.save_settings()
        
        # Broadcast updated settings to all web clients
        settings_message = {
            "type": "settings",
            "data": {
                "motion": {
                    "minArea": self.min_area,
                    "threshold": self.threshold,
                    "blurSize": self.blur_size,
                    "dilation": self.dilation_iterations
                },
                "camera": self.camera_settings
            }
        }
        self.broadcast_to_web_clients(json.dumps(settings_message))

    def detect_motion(self, frame, camera_id):
        """Detect motion in the frame"""
        try:
            # Validate input frame
            if frame is None:
                print("[-] Invalid frame: frame is None")
                return None

            # Get frame dimensions
            height, width = frame.shape[:2]
            if width == 0 or height == 0:
                print("[-] Invalid frame dimensions")
                return None

            # Convert frame to grayscale
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # Apply Gaussian blur
            blurred = cv2.GaussianBlur(gray, (self.blur_size, self.blur_size), 0)
            
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
            _, thresh = cv2.threshold(frame_diff, self.threshold, 255, cv2.THRESH_BINARY)
            
            # Dilate the thresholded image
            kernel = np.ones((5,5), np.uint8)
            dilated = cv2.dilate(thresh, kernel, iterations=self.dilation_iterations)
            
            # Find contours
            contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            # Draw bounding boxes around moving objects
            for contour in contours:
                if cv2.contourArea(contour) > self.min_area:
                    x, y, w, h = cv2.boundingRect(contour)
                    cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 3)
            
            return frame
        except Exception as e:
            print(f"[-] Error in motion detection: {e}")
            print(f"[-] Frame type: {type(frame)}")
            if frame is not None:
                print(f"[-] Frame shape: {frame.shape}")
            return frame

    def process_frame(self, frame_data, camera_id):
        """Process the frame with OpenCV and return the processed frame"""
        try:
            # Only process every nth frame
            self.frame_counter += 1
            if self.frame_counter % self.process_every_n_frames != 0:
                return frame_data

            # Validate frame data
            if len(frame_data) < 100:  # Minimum reasonable JPEG size
                print("[-] Invalid frame data - too small")
                return None

            # Convert binary data to numpy array
            nparr = np.frombuffer(frame_data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is None:
                print("[-] Failed to decode frame")
                return None

            # Validate frame dimensions
            height, width = frame.shape[:2]
            if width == 0 or height == 0:
                print("[-] Invalid frame dimensions after decode")
                return None

            # Check for minimum frame size
            if width < 100 or height < 100:
                print("[-] Frame too small")
                return None

            # Detect motion and draw bounding boxes
            processed_frame = self.detect_motion(frame, camera_id)
            
            if processed_frame is None:
                print("[-] Motion detection failed")
                return None
            
            # Encode the processed frame back to JPEG with lower quality for better performance
            _, buffer = cv2.imencode('.jpg', processed_frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            
            # Validate encoded frame
            if len(buffer) < 100:
                print("[-] Encoded frame too small")
                return None
                
            return buffer.tobytes()
        except Exception as e:
            print(f"[-] Error processing frame: {e}")
            return None

    async def broadcast_status(self):
        """Broadcast current device status to all web clients"""
        status_message = json.dumps({
            "type": "status",
            "data": self.device_status
        })
        print(f"[+] Broadcasting status: {status_message}")
        
        # Send to all web clients directly
        for client in self.web_clients:
            try:
                await client.send(status_message)
                print(f"[+] Status sent to web client successfully")
            except Exception as e:
                print(f"[-] Error sending status to client: {e}")
                # If there's an error sending to a client, remove it
                self.web_clients.discard(client)
                self.device_status["web_clients"] = len(self.web_clients)
                # Broadcast updated status after removing failed client
                await self.broadcast_status()

    async def register(self, websocket):
        """Register a new client and identify if it's a camera or web client"""
        try:
            # Wait for the first message to identify the client type
            message = await websocket.recv()
            
            if isinstance(message, str):
                # Try to parse as JSON
                try:
                    data = json.loads(message)
                    if data.get('type') == 'camera':
                        # This is a camera client
                        camera_id = data.get('camera_id')
                        if camera_id:
                            self.camera_clients[camera_id] = websocket
                            self.device_status['cameras'][camera_id] = {
                                'connected': True,
                                'name': data.get('camera_name', f'Camera {camera_id}'),
                                'last_seen': time.time()
                            }
                            print(f"[+] Camera {camera_id} connected")
                            await self.broadcast_status()
                        return
                except json.JSONDecodeError:
                    pass
            else:
                # Binary message - assume it's a camera frame
                camera_id = self._get_camera_id_from_websocket(websocket)
                if camera_id:
                    self.camera_clients[camera_id] = websocket
                    self.device_status['cameras'][camera_id] = {
                        'connected': True,
                        'name': f'Camera {camera_id}',
                        'last_seen': time.time()
                    }
                    print(f"[+] Camera {camera_id} connected")
                    await self.broadcast_status()
                    return
            
            # If we get here, this is a web client
            self.web_clients.add(websocket)
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
            print(f"[-] Camera {camera_id} disconnected")
        elif websocket in self.web_clients:
            self.web_clients.remove(websocket)
            self.device_status['web_clients'] = len(self.web_clients)
            print("[-] Web client disconnected")
        
        await self.broadcast_status()
    
    async def broadcast_to_web_clients(self, message):
        """Broadcast message to all web clients"""
        if not self.web_clients:
            print("[!] No web clients to broadcast to")
            return
            
        # Create a copy of the web clients set to avoid modification during iteration
        web_clients = self.web_clients.copy()
        for client in web_clients:
            try:
                await client.send(message)
                print(f"[+] Frame sent to web client successfully")
            except websockets.exceptions.ConnectionClosed:
                print("[-] Web client connection closed")
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
                        self.device_status['cameras'][camera_id]['last_seen'] = time.time()
                        print(f"[+] Camera {camera_id} sent status update")
                        await self.broadcast_status()
                elif data.get('type') == 'web':
                    # Handle web client messages
                    if data.get('action') == 'select_camera':
                        self.selected_camera = data.get('camera_id')
                        print(f"[+] Web client selected camera: {self.selected_camera}")
                        await self.broadcast_status()
                elif data.get('type') == 'command':
                    # Handle command messages
                    command = data.get('message')
                    camera_id = data.get('camera_id')
                    if command and camera_id and camera_id in self.camera_clients:
                        print(f"[+] Forwarding command {command} to camera {camera_id}")
                        # Forward the command to the specific camera
                        command_message = {
                            "type": "command",
                            "message": command
                        }
                        await self.camera_clients[camera_id].send(json.dumps(command_message))
                elif data.get('type') == 'settings':
                    # Handle settings messages
                    settings = data.get('data')
                    if settings:
                        print(f"[+] Received settings update: {settings}")
                        # Update local settings
                        if 'camera' in settings:
                            self.camera_settings = settings['camera']
                            # Forward camera settings to the selected camera
                            if self.selected_camera and self.selected_camera in self.camera_clients:
                                print(f"[+] Forwarding camera settings to camera {self.selected_camera}")
                                settings_message = {
                                    "type": "command",
                                    "message": "SETTINGS",
                                    "data": {"camera": self.camera_settings}
                                }
                                await self.camera_clients[self.selected_camera].send(json.dumps(settings_message))
                        if 'motion' in settings:
                            motion_settings = settings['motion']
                            self.min_area = motion_settings.get('minArea', self.min_area)
                            self.threshold = motion_settings.get('threshold', self.threshold)
                            self.blur_size = motion_settings.get('blurSize', self.blur_size)
                            self.dilation_iterations = motion_settings.get('dilation', self.dilation_iterations)
                        # Save settings to file
                        self.save_settings()
                        # Broadcast updated settings to all web clients
                        await self.broadcast_to_web_clients(json.dumps({
                            "type": "settings",
                            "data": settings
                        }))
            else:
                # Handle binary messages (camera frames)
                camera_id = self._get_camera_id_from_websocket(websocket)
                if camera_id:
                    print(f"[+] Received frame from camera {camera_id}, size: {len(message)} bytes")
                    self.device_status['cameras'][camera_id]['last_seen'] = time.time()
                    
                    # Only process and send frames from the selected camera
                    if camera_id == self.selected_camera:
                        print(f"[+] Processing frame from selected camera {camera_id}")
                        # Process the frame with motion detection
                        processed_frame = self.process_frame(message, camera_id)
                        if processed_frame:
                            print(f"[+] Frame processed successfully, sending to web clients")
                            await self.broadcast_to_web_clients(processed_frame)
                        else:
                            print("[-] Frame processing failed")
                    else:
                        print(f"[!] Frame from camera {camera_id} ignored (not selected)")
                    
                    await self.broadcast_status()
                else:
                    print("[-] Received frame from unknown camera")
        except Exception as e:
            print(f"[-] Error handling message: {str(e)}")
            import traceback
            traceback.print_exc()
    
    async def start(self):
        """Start the WebSocket server"""
        async with websockets.serve(self._handler, self.host, self.port):
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

    def run(self):
        """Start the WebSocket server"""
        async def main():
            try:
                self.server = await websockets.serve(
                    self._handler,
                    self.host,
                    self.port,
                    ping_interval=None  # Disable ping to avoid potential issues
                )
                print(f"[+] WebSocket server running on ws://{self.host}:{self.port}")
                await self.server.wait_closed()
            except Exception as e:
                print(f"[-] Server error: {e}")

        # Create and set a new event loop for this thread
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Run the server
            loop.run_until_complete(main())
        except KeyboardInterrupt:
            print("[+] Shutting down WebSocket server")
        except Exception as e:
            print(f"[-] Server error: {e}")
        finally:
            loop.close()