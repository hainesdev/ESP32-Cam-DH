# ESP32 Cam Distribution Hub (ESP32Cam-DH)

A comprehensive distributed camera surveillance system featuring real-time streaming, motion detection, and remote control capabilities. Built with ESP32-CAM modules and a Python WebSocket server, this hub provides centralized management and monitoring of multiple cameras.

## Features

- Multi-camera support with real-time streaming
- Motion detection with configurable sensitivity
- Web-based control interface
- Camera settings management (resolution, quality, exposure, etc.)
- LED control for each camera
- Motor control capabilities
- Automatic reconnection handling
- Cross-platform web interface
- Centralized camera management
- Persistent camera settings and names

## System Components

### Hardware
- ESP32-CAM modules
- LED indicators
- Motor control system (optional)
- WiFi network

### Software
- ESP32-CAM firmware (Arduino)
- Python WebSocket server
- Web interface (HTML/CSS/JavaScript)

## Prerequisites

### Hardware Requirements
- ESP32-CAM module(s)
- USB-to-TTL converter for programming
- WiFi network
- Optional: LED indicators and motor control system

### Software Requirements
- Python 3.7+
- OpenCV (cv2)
- websockets
- Arduino IDE
- ESP32 board support package for Arduino

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ESP32Cam-DH.git
cd ESP32Cam-DH
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Flash the ESP32-CAM firmware:
   - Open `firmware/ESP32CamWS/ESP32CamWS.ino` in Arduino IDE
   - Select your ESP32-CAM board
   - Update WiFi credentials in the code
   - Upload the firmware

## Configuration

1. Update WiFi credentials in the ESP32 firmware:
```cpp
const char *ssid = "YOUR_WIFI_SSID";
const char *password = "YOUR_WIFI_PASSWORD";
```

2. Configure WebSocket server settings:
```python
host = "0.0.0.0"  # Listen on all interfaces
port = 5000       # WebSocket port
```

## Usage

1. Start the WebSocket server:
```bash
python server.py
```

2. Power on your ESP32-CAM modules

3. Open a web browser and navigate to:
```
http://<server_ip>:5000
```

4. Select a camera from the dropdown menu to view its stream

## Camera Controls

- **LED Control**: Toggle camera LED on/off
- **Motor Control**: Use arrow keys or on-screen controls for movement
- **Camera Settings**: Adjust resolution, quality, and other parameters
- **Motion Detection**: Configure sensitivity and detection area
- **Camera Naming**: Customize camera names for easy identification

## Troubleshooting

1. **Camera Not Connecting**
   - Verify WiFi credentials
   - Check server IP address
   - Ensure ESP32-CAM is powered correctly

2. **Stream Issues**
   - Check network bandwidth
   - Verify camera settings
   - Restart the WebSocket server

3. **Motion Detection Not Working**
   - Adjust sensitivity settings
   - Check lighting conditions
   - Verify camera position

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- ESP32-CAM community
- OpenCV developers
- WebSocket protocol contributors 