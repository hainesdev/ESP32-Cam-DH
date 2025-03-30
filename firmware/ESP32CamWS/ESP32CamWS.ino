#include "esp_camera.h"
#include <WiFi.h>
#include <Arduino.h>
#include <ArduinoWebsockets.h>
#include <ArduinoJson.h>
#include "soc/soc.h" //disable brownout problems
#include "soc/rtc_cntl_reg.h"  //disable brownout problems
#include "driver/gpio.h"  // Add GPIO driver header
#include "esp_wifi.h"  // Add WiFi header for MAC address functions

// specific to my board yours might be different if
// not using the board listed in the BOM
#define CAMERA_MODEL_AI_THINKER
#include "camera_pins.h"

// network creds and server info
const char *ssid = "YOUR_WIFI_SSID";         // Replace with your WiFi SSID
const char *password = "YOUR_WIFI_PASSWORD";  // Replace with your WiFi password
const char *websocket_server_host = "YOUR_SERVER_IP";  // Replace with your server IP
const uint16_t websocket_server_port = 5000;

// Camera identification
String camera_id;  // Will be set to MAC address
String camera_name;  // Will be set by the frontend

// create buffer to receive data coming from other ws clients
StaticJsonDocument<1024> jsonBuffer;  // Increased from 255 to 1024

// init the websocket client that connects to the ws server
using namespace websockets;
WebsocketsClient client;

// Motor control pins
#define MOTOR_1A 12  // IN1 Motor A
#define MOTOR_1B 13  // IN2 Motor A
#define MOTOR_2A 15  // IN3 Motor B
#define MOTOR_2B 14  // IN4 Motor B
#define BUTTON_A 2   // Button A pin
#define BUTTON_B 4   // Button B pin

// LED pins
#define STATUS_LED 33  // Status LED
#define FLASH_LED 4    // Flash LED (built-in)

// Camera settings
struct CameraSettings {
    String resolution;
    int quality;
    int brightness;
    int contrast;
    int saturation;
    int special_effect;
    int whitebal;
    int awb_gain;
    int wb_mode;
    int exposure_ctrl;
    int aec2;
    int ae_level;
    int aec_value;
    int gain_ctrl;
    int agc_gain;
    int gainceiling;
    int bpc;
    int wpc;
    int raw_gma;
    int lenc;
    int hmirror;
    int vflip;
} cameraSettings;

// Function to apply camera settings
void applyCameraSettings() {
    // Get the sensor
    sensor_t * s = esp_camera_sensor_get();
    if (!s) {
        Serial.println("Failed to get camera sensor");
        return;
    }

    // Store current frame size
    framesize_t current_framesize = s->status.framesize;

    // Set frame size based on resolution
    framesize_t new_framesize;
    if (cameraSettings.resolution == "UXGA") {
        new_framesize = FRAMESIZE_UXGA;
    } else if (cameraSettings.resolution == "VGA") {
        new_framesize = FRAMESIZE_VGA;
    } else if (cameraSettings.resolution == "SVGA") {
        new_framesize = FRAMESIZE_SVGA;
    } else {
        new_framesize = current_framesize;  // Keep current if unknown
    }

    // Only change frame size if it's different
    if (new_framesize != current_framesize) {
        s->set_framesize(s, new_framesize);
        delay(100);  // Give the camera time to adjust
    }
    
    // Apply all sensor settings
    s->set_quality(s, cameraSettings.quality);
    s->set_brightness(s, cameraSettings.brightness);
    s->set_contrast(s, cameraSettings.contrast);
    s->set_saturation(s, cameraSettings.saturation);
    s->set_special_effect(s, cameraSettings.special_effect);
    s->set_whitebal(s, cameraSettings.whitebal);
    s->set_awb_gain(s, cameraSettings.awb_gain);
    s->set_wb_mode(s, cameraSettings.wb_mode);
    s->set_exposure_ctrl(s, cameraSettings.exposure_ctrl);
    s->set_aec2(s, cameraSettings.aec2);
    s->set_ae_level(s, cameraSettings.ae_level);
    s->set_aec_value(s, cameraSettings.aec_value);
    s->set_gain_ctrl(s, cameraSettings.gain_ctrl);
    s->set_agc_gain(s, cameraSettings.agc_gain);
    s->set_gainceiling(s, (gainceiling_t)cameraSettings.gainceiling);
    s->set_bpc(s, cameraSettings.bpc);
    s->set_wpc(s, cameraSettings.wpc);
    s->set_raw_gma(s, cameraSettings.raw_gma);
    s->set_lenc(s, cameraSettings.lenc);
    s->set_hmirror(s, cameraSettings.hmirror);
    s->set_vflip(s, cameraSettings.vflip);

    // Verify settings were applied
    if (s->status.framesize != new_framesize) {
        Serial.println("Warning: Frame size setting may not have been applied correctly");
    }

    Serial.println("Camera settings applied successfully");
    
    // Send a test frame to verify camera is working
    camera_fb_t *fb = esp_camera_fb_get();
    if (fb) {
        bool sent = client.sendBinary((const char *)fb->buf, fb->len);
        if (sent) {
            Serial.println("Sent test frame after settings application");
        } else {
            Serial.println("Failed to send test frame after settings application");
        }
        esp_camera_fb_return(fb);
    } else {
        Serial.println("Failed to capture test frame after settings application");
    }
}

// Function to handle settings message
void handleSettingsMessage(const char* message) {
    StaticJsonDocument<2048> doc;  // Increased buffer size for more settings
    DeserializationError error = deserializeJson(doc, message);
    
    if (error) {
        Serial.print("Failed to parse settings JSON: ");
        Serial.println(error.c_str());
        return;
    }
    
    if (doc.containsKey("data") && doc["data"].containsKey("camera")) {
        JsonObject camera = doc["data"]["camera"];
        
        // Update all camera settings
        if (camera.containsKey("resolution")) {
            cameraSettings.resolution = camera["resolution"].as<String>();
        }
        if (camera.containsKey("quality")) {
            cameraSettings.quality = camera["quality"].as<int>();
        }
        if (camera.containsKey("brightness")) {
            cameraSettings.brightness = camera["brightness"].as<int>();
        }
        if (camera.containsKey("contrast")) {
            cameraSettings.contrast = camera["contrast"].as<int>();
        }
        if (camera.containsKey("saturation")) {
            cameraSettings.saturation = camera["saturation"].as<int>();
        }
        if (camera.containsKey("special_effect")) {
            cameraSettings.special_effect = camera["special_effect"].as<int>();
        }
        if (camera.containsKey("whitebal")) {
            cameraSettings.whitebal = camera["whitebal"].as<int>();
        }
        if (camera.containsKey("awb_gain")) {
            cameraSettings.awb_gain = camera["awb_gain"].as<int>();
        }
        if (camera.containsKey("wb_mode")) {
            cameraSettings.wb_mode = camera["wb_mode"].as<int>();
        }
        if (camera.containsKey("exposure_ctrl")) {
            cameraSettings.exposure_ctrl = camera["exposure_ctrl"].as<int>();
        }
        if (camera.containsKey("aec2")) {
            cameraSettings.aec2 = camera["aec2"].as<int>();
        }
        if (camera.containsKey("ae_level")) {
            cameraSettings.ae_level = camera["ae_level"].as<int>();
        }
        if (camera.containsKey("aec_value")) {
            cameraSettings.aec_value = camera["aec_value"].as<int>();
        }
        if (camera.containsKey("gain_ctrl")) {
            cameraSettings.gain_ctrl = camera["gain_ctrl"].as<int>();
        }
        if (camera.containsKey("agc_gain")) {
            cameraSettings.agc_gain = camera["agc_gain"].as<int>();
        }
        if (camera.containsKey("gainceiling")) {
            cameraSettings.gainceiling = camera["gainceiling"].as<int>();
        }
        if (camera.containsKey("bpc")) {
            cameraSettings.bpc = camera["bpc"].as<int>();
        }
        if (camera.containsKey("wpc")) {
            cameraSettings.wpc = camera["wpc"].as<int>();
        }
        if (camera.containsKey("raw_gma")) {
            cameraSettings.raw_gma = camera["raw_gma"].as<int>();
        }
        if (camera.containsKey("lenc")) {
            cameraSettings.lenc = camera["lenc"].as<int>();
        }
        if (camera.containsKey("hmirror")) {
            cameraSettings.hmirror = camera["hmirror"].as<int>();
        }
        if (camera.containsKey("vflip")) {
            cameraSettings.vflip = camera["vflip"].as<int>();
        }
        
        // Apply the new settings
        applyCameraSettings();
        
        // Send confirmation
        String response = "{\"type\":\"settings\",\"data\":{\"camera\":{\"resolution\":\"" + 
                         cameraSettings.resolution + "\",\"quality\":" + String(cameraSettings.quality) + 
                         ",\"brightness\":" + String(cameraSettings.brightness) + 
                         ",\"contrast\":" + String(cameraSettings.contrast) + 
                         ",\"saturation\":" + String(cameraSettings.saturation) + 
                         ",\"special_effect\":" + String(cameraSettings.special_effect) + 
                         ",\"whitebal\":" + String(cameraSettings.whitebal) + 
                         ",\"awb_gain\":" + String(cameraSettings.awb_gain) + 
                         ",\"wb_mode\":" + String(cameraSettings.wb_mode) + 
                         ",\"exposure_ctrl\":" + String(cameraSettings.exposure_ctrl) + 
                         ",\"aec2\":" + String(cameraSettings.aec2) + 
                         ",\"ae_level\":" + String(cameraSettings.ae_level) + 
                         ",\"aec_value\":" + String(cameraSettings.aec_value) + 
                         ",\"gain_ctrl\":" + String(cameraSettings.gain_ctrl) + 
                         ",\"agc_gain\":" + String(cameraSettings.agc_gain) + 
                         ",\"gainceiling\":" + String(cameraSettings.gainceiling) + 
                         ",\"bpc\":" + String(cameraSettings.bpc) + 
                         ",\"wpc\":" + String(cameraSettings.wpc) + 
                         ",\"raw_gma\":" + String(cameraSettings.raw_gma) + 
                         ",\"lenc\":" + String(cameraSettings.lenc) + 
                         ",\"hmirror\":" + String(cameraSettings.hmirror) + 
                         ",\"vflip\":" + String(cameraSettings.vflip) + "}}}";
        client.send(response);
    } else {
        Serial.println("Invalid settings message format");
    }
}

// Movement functions with improved comments
void forward() {
  digitalWrite(MOTOR_1A, HIGH);
  digitalWrite(MOTOR_1B, LOW);
  digitalWrite(MOTOR_2A, HIGH);
  digitalWrite(MOTOR_2B, LOW);
}

void reverse() {
  digitalWrite(MOTOR_1A, LOW);
  digitalWrite(MOTOR_1B, HIGH);
  digitalWrite(MOTOR_2A, LOW);
  digitalWrite(MOTOR_2B, HIGH);
}

void hault() {
  digitalWrite(MOTOR_1A, LOW);
  digitalWrite(MOTOR_1B, LOW);
  digitalWrite(MOTOR_2A, LOW);
  digitalWrite(MOTOR_2B, LOW);
}

void left() {
  digitalWrite(MOTOR_1A, LOW);
  digitalWrite(MOTOR_1B, HIGH);
  digitalWrite(MOTOR_2A, HIGH);
  digitalWrite(MOTOR_2B, LOW);
}

void right() {
  digitalWrite(MOTOR_1A, HIGH);
  digitalWrite(MOTOR_1B, LOW);
  digitalWrite(MOTOR_2A, LOW);
  digitalWrite(MOTOR_2B, HIGH);
}

void a_button_on() {
  digitalWrite(BUTTON_A, HIGH);
}

void a_button_off() {
  digitalWrite(BUTTON_A, LOW);
}

void b_button_on() {
  digitalWrite(BUTTON_B, HIGH);
}

void b_button_off() {
  digitalWrite(BUTTON_B, LOW);
}

// LED control functions
void setStatusLED(bool state) {
    if (STATUS_LED != -1) {  // Check if pin is valid
        digitalWrite(STATUS_LED, state);
    }
}

void setFlashLED(bool state) {
    if (FLASH_LED != -1) {  // Check if pin is valid
        digitalWrite(FLASH_LED, state);
    }
}

void toggleFlashLED() {
    static bool flashState = false;
    flashState = !flashState;
    setFlashLED(flashState);
}

// Handle websocket connection status
void blinkLED(int times) {
    for (int i = 0; i < times; i++) {
        setStatusLED(HIGH);
        delay(100);
        setStatusLED(LOW);
        delay(100);
    }
}

void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); //disable brownout detector
  Serial.begin(115200);
  Serial.setDebugOutput(false);

  // Initialize WiFi in station mode
  WiFi.mode(WIFI_STA);
  
  // Get ESP32's unique ID for camera ID
  uint64_t chipid = ESP.getEfuseMac(); // Get unique ID from eFuse
  char uniqueId[17];
  snprintf(uniqueId, sizeof(uniqueId), "%016llX", chipid);
  camera_id = String(uniqueId);
  camera_name = "Camera " + camera_id.substring(0, 6);  // Default name using first 6 chars of ID
  Serial.printf("Camera ID set to: %s\n", camera_id.c_str());

  // Initialize GPIO ISR service first
  esp_err_t err = gpio_install_isr_service(0);
  if (err != ESP_OK && err != ESP_ERR_INVALID_STATE) {
    Serial.printf("GPIO ISR service installation failed: %d\n", err);
    blinkLED(5);
    ESP.restart();
    return;
  }

  // Initialize the LEDs with proper pin validation
  if (STATUS_LED != -1) {
    pinMode(STATUS_LED, OUTPUT);
    setStatusLED(LOW);
  }
  if (FLASH_LED != -1) {
    pinMode(FLASH_LED, OUTPUT);
    setFlashLED(LOW);
  }

  // set camera pins and settings
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;  // 20MHz XCLK
  config.pixel_format = PIXFORMAT_JPEG;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.grab_mode = CAMERA_GRAB_LATEST;

  // Start with conservative settings for reliable initialization
  config.frame_size = FRAMESIZE_VGA;
  config.jpeg_quality = 63;  // Highest compression (lowest quality)
  config.fb_count = 1;  // Start with single buffer

  // Power up the camera with proper sequence
  if (PWDN_GPIO_NUM != -1) {
    pinMode(PWDN_GPIO_NUM, OUTPUT);
  }
  if (RESET_GPIO_NUM != -1) {
    pinMode(RESET_GPIO_NUM, OUTPUT);
  }
  
  // Power down sequence
  if (PWDN_GPIO_NUM != -1) {
    digitalWrite(PWDN_GPIO_NUM, HIGH);
  }
  if (RESET_GPIO_NUM != -1) {
    digitalWrite(RESET_GPIO_NUM, LOW);
  }
  delay(100);
  
  // Power up sequence
  if (PWDN_GPIO_NUM != -1) {
    digitalWrite(PWDN_GPIO_NUM, LOW);
  }
  delay(100);
  if (RESET_GPIO_NUM != -1) {
    digitalWrite(RESET_GPIO_NUM, HIGH);
  }
  delay(100);

  // camera init with retries and power cycling
  int initAttempts = 0;
  const int maxAttempts = 5;  // Increased from 3 to 5
  
  while (initAttempts < maxAttempts) {
    Serial.printf("Camera init attempt %d/%d\n", initAttempts + 1, maxAttempts);
    
    // Try to initialize the camera
    err = esp_camera_init(&config);
    
    if (err == ESP_OK) {
      Serial.println("Camera initialized successfully");
      
      // Get a reference to the sensor
      sensor_t * s = esp_camera_sensor_get();
      if (s) {
        // Dump camera module info
        int sensorPID = s->id.PID;
        switch (sensorPID) {
          case OV9650_PID: Serial.println("WARNING: OV9650 camera module is not properly supported, will fallback to OV2640 operation"); break;
          case OV7725_PID: Serial.println("WARNING: OV7725 camera module is not properly supported, will fallback to OV2640 operation"); break;
          case OV2640_PID: Serial.println("OV2640 camera module detected"); break;
          case OV3660_PID: Serial.println("OV3660 camera module detected"); break;
          default: Serial.println("WARNING: Camera module is unknown and not properly supported, will fallback to OV2640 operation");
        }

        // OV3660 initial sensors are flipped vertically and colors are a bit saturated
        if (sensorPID == OV3660_PID) {
          s->set_vflip(s, 1);  //flip it back
          s->set_brightness(s, 1);  //up the blightness just a bit
          s->set_saturation(s, -2);  //lower the saturation
        }

        // Verify camera is working by attempting to capture a frame
        camera_fb_t *fb = esp_camera_fb_get();
        if (fb) {
          Serial.println("Camera capture verified");
          esp_camera_fb_return(fb);
          break;  // Success with current settings
        } else {
          Serial.println("Camera capture failed, will retry");
          esp_camera_deinit();  // Clean up before retry
        }
      } else {
        Serial.println("Failed to get camera sensor");
        esp_camera_deinit();
      }
    } else {
      Serial.printf("Camera init failed with error 0x%x\n", err);
    }
    
    initAttempts++;
    
    if (initAttempts < maxAttempts) {
      // Power cycle the camera
      Serial.println("Power cycling camera...");
      
      // First, deinit the camera to clean up GPIO ISR service
      esp_camera_deinit();
      delay(100);
      
      // Power down sequence
      if (PWDN_GPIO_NUM != -1) {
        digitalWrite(PWDN_GPIO_NUM, HIGH);
      }
      delay(100);
      if (RESET_GPIO_NUM != -1) {
        digitalWrite(RESET_GPIO_NUM, LOW);
      }
      delay(100);
      
      // Power up sequence
      if (PWDN_GPIO_NUM != -1) {
        digitalWrite(PWDN_GPIO_NUM, LOW);
      }
      delay(100);
      if (RESET_GPIO_NUM != -1) {
        digitalWrite(RESET_GPIO_NUM, HIGH);
      }
      delay(100);
    }
  }

  if (err != ESP_OK || initAttempts >= maxAttempts) {
    Serial.println("Camera initialization failed after all attempts");
    // Clean up GPIO ISR service before restart
    gpio_uninstall_isr_service();
    blinkLED(5);
    ESP.restart();
    return;
  }

  // Set up sensor with optimized settings for streaming
  sensor_t *s = esp_camera_sensor_get();
  if (s) {
    // Apply sensor parameters
    s->set_brightness(s, 0);
    s->set_contrast(s, 0);
    s->set_saturation(s, 0);
    s->set_special_effect(s, 0);
    s->set_whitebal(s, 1);
    s->set_awb_gain(s, 1);
    s->set_wb_mode(s, 0);
    s->set_exposure_ctrl(s, 1);
    s->set_aec2(s, 0);
    s->set_ae_level(s, 0);
    s->set_aec_value(s, 300);
    s->set_exposure_ctrl(s, 1);
    s->set_gain_ctrl(s, 1);
    s->set_agc_gain(s, 0);
    s->set_gainceiling(s, (gainceiling_t)0);
    s->set_bpc(s, 0);
    s->set_wpc(s, 1);
    s->set_raw_gma(s, 1);
    s->set_lenc(s, 1);
    s->set_hmirror(s, 0);
    s->set_vflip(s, 0);
    
    // Set initial frame size and quality
    s->set_framesize(s, FRAMESIZE_VGA);
    s->set_quality(s, 63);  // Highest compression
    
    Serial.println("Camera sensor settings applied");
  } else {
    Serial.println("Failed to get camera sensor");
    blinkLED(5);
    ESP.restart();
    return;
  }

  // Initialize motor control pins
  pinMode(MOTOR_1A, OUTPUT);
  pinMode(MOTOR_1B, OUTPUT);
  pinMode(MOTOR_2A, OUTPUT);
  pinMode(MOTOR_2B, OUTPUT);
  pinMode(BUTTON_A, OUTPUT);
  pinMode(BUTTON_B, OUTPUT);

  // Set everything low initially
  hault();
  a_button_off();
  b_button_off();

  // connect to wifi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < 20) {
    delay(500);
    Serial.print(".");
    setStatusLED(!digitalRead(STATUS_LED)); // Toggle LED
    wifiAttempts++;
  }
  
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\nWiFi connection failed");
    // Indicate WiFi failure with 3 blinks
    blinkLED(3);
    ESP.restart(); // Restart the ESP32
    return;
  }
  
  Serial.println("");
  Serial.println("WiFi connected");
  
  // Display IP address
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
  // Indicate successful connection with 2 blinks
  blinkLED(2);

  // Websocket connection handler
  client.onMessage([](WebsocketsMessage msg) {
    String raw_data = msg.data();
    handle_json(raw_data);
  });

  // Websocket error handler
  client.onEvent([](WebsocketsEvent event, String data) {
    if (event == WebsocketsEvent::ConnectionClosed) {
      Serial.println("Connection closed");
      setStatusLED(LOW);  // Turn off status LED when disconnected
      // Try to reconnect
      ESP.restart();
    }
  });

  // Connect to websocket server
  Serial.println("Attempting WebSocket Connection");
  bool connected = false;
  int wsAttempts = 0;
  
  while (!connected && wsAttempts < 10) {
    connected = client.connect(websocket_server_host, websocket_server_port, "/");
    if (!connected) {
      delay(500);
      Serial.print(".");
      setStatusLED(!digitalRead(STATUS_LED)); // Toggle LED
      wsAttempts++;
    }
  }
  
  if (!connected) {
    Serial.println("\nWebSocket connection failed");
    // Indicate WebSocket failure with 4 blinks
    blinkLED(4);
    ESP.restart(); // Restart the ESP32
    return;
  }
  
  Serial.println("Websocket Connected!");
  // Indicate successful connection with 1 long blink
  setStatusLED(HIGH);
  delay(1000);
  setStatusLED(LOW);

  // Send initial message to identify as camera client
  StaticJsonDocument<200> doc;
  doc["type"] = "camera";
  doc["message"] = "init";
  doc["camera_id"] = camera_id;
  doc["camera_name"] = camera_name;
  String jsonString;
  serializeJson(doc, jsonString);
  client.send(jsonString);
  Serial.println("Sent initial camera message");

  // Send a test frame to verify camera is working
  camera_fb_t *fb = esp_camera_fb_get();
  if (fb) {
    bool sent = client.sendBinary((const char *)fb->buf, fb->len);
    if (sent) {
      Serial.println("Sent initial test frame");
    } else {
      Serial.println("Failed to send initial test frame");
    }
    esp_camera_fb_return(fb);
  } else {
    Serial.println("Failed to capture initial test frame");
  }
}

// handle incoming websocket messages
void handle_json(const String& raw_data) {
    // Parse JSON
    DeserializationError error = deserializeJson(jsonBuffer, raw_data);
    if (error) {
        Serial.print("JSON parsing failed: ");
        Serial.println(error.c_str());
        return;
    }

    // Check for settings message first
    if (jsonBuffer.containsKey("type") && jsonBuffer["type"] == "settings") {
        Serial.println("Received settings command");
        // Get the data field containing camera settings
        if (jsonBuffer.containsKey("data") && jsonBuffer["data"].containsKey("camera")) {
            JsonObject camera = jsonBuffer["data"]["camera"];
            
            // Update camera settings
            if (camera.containsKey("resolution")) {
                cameraSettings.resolution = camera["resolution"].as<String>();
            }
            if (camera.containsKey("quality")) {
                cameraSettings.quality = camera["quality"].as<int>();
            }
            if (camera.containsKey("brightness")) {
                cameraSettings.brightness = camera["brightness"].as<int>();
            }
            if (camera.containsKey("contrast")) {
                cameraSettings.contrast = camera["contrast"].as<int>();
            }
            if (camera.containsKey("saturation")) {
                cameraSettings.saturation = camera["saturation"].as<int>();
            }
            if (camera.containsKey("special_effect")) {
                cameraSettings.special_effect = camera["special_effect"].as<int>();
            }
            if (camera.containsKey("whitebal")) {
                cameraSettings.whitebal = camera["whitebal"].as<int>();
            }
            if (camera.containsKey("awb_gain")) {
                cameraSettings.awb_gain = camera["awb_gain"].as<int>();
            }
            if (camera.containsKey("wb_mode")) {
                cameraSettings.wb_mode = camera["wb_mode"].as<int>();
            }
            if (camera.containsKey("exposure_ctrl")) {
                cameraSettings.exposure_ctrl = camera["exposure_ctrl"].as<int>();
            }
            if (camera.containsKey("aec2")) {
                cameraSettings.aec2 = camera["aec2"].as<int>();
            }
            if (camera.containsKey("ae_level")) {
                cameraSettings.ae_level = camera["ae_level"].as<int>();
            }
            if (camera.containsKey("aec_value")) {
                cameraSettings.aec_value = camera["aec_value"].as<int>();
            }
            if (camera.containsKey("gain_ctrl")) {
                cameraSettings.gain_ctrl = camera["gain_ctrl"].as<int>();
            }
            if (camera.containsKey("agc_gain")) {
                cameraSettings.agc_gain = camera["agc_gain"].as<int>();
            }
            if (camera.containsKey("gainceiling")) {
                cameraSettings.gainceiling = camera["gainceiling"].as<int>();
            }
            if (camera.containsKey("bpc")) {
                cameraSettings.bpc = camera["bpc"].as<int>();
            }
            if (camera.containsKey("wpc")) {
                cameraSettings.wpc = camera["wpc"].as<int>();
            }
            if (camera.containsKey("raw_gma")) {
                cameraSettings.raw_gma = camera["raw_gma"].as<int>();
            }
            if (camera.containsKey("lenc")) {
                cameraSettings.lenc = camera["lenc"].as<int>();
            }
            if (camera.containsKey("hmirror")) {
                cameraSettings.hmirror = camera["hmirror"].as<int>();
            }
            if (camera.containsKey("vflip")) {
                cameraSettings.vflip = camera["vflip"].as<int>();
            }
            
            // Apply the new settings
            applyCameraSettings();
            Serial.println("Camera settings applied successfully");
        } else {
            Serial.println("Invalid settings format");
        }
        return;
    }

    // Handle camera name update
    if (jsonBuffer.containsKey("type") && jsonBuffer["type"] == "camera" && 
        jsonBuffer.containsKey("action") && strcmp(jsonBuffer["action"], "update_name") == 0) {
        if (jsonBuffer.containsKey("camera_name")) {
            camera_name = jsonBuffer["camera_name"].as<String>();
            Serial.printf("Camera name updated to: %s\n", camera_name.c_str());
        }
        return;
    }

    // Handle command messages
    if (!jsonBuffer.containsKey("message")) {
        Serial.println("No message field in JSON");
        return;
    }

    const char* message = jsonBuffer["message"];
    Serial.print("Received command: ");
    Serial.println(message);

    // Execute the appropriate command
    if (strcmp(message, "forward") == 0) {
        forward();
    } else if (strcmp(message, "reverse") == 0) {
        reverse();
    } else if (strcmp(message, "hault") == 0) {
        hault();
    } else if (strcmp(message, "left") == 0) {
        left();
    } else if (strcmp(message, "right") == 0) {
        right();
    } else if (strcmp(message, "AON") == 0) {
        a_button_on();
    } else if (strcmp(message, "AOFF") == 0) {
        a_button_off();
    } else if (strcmp(message, "BON") == 0) {
        b_button_on();
    } else if (strcmp(message, "BOFF") == 0) {
        b_button_off();
    } else if (strcmp(message, "LED_ON") == 0) {
        Serial.println("Turning FLASH LED ON");
        setFlashLED(HIGH);
        Serial.println("Flash LED command executed");
    } else if (strcmp(message, "LED_OFF") == 0) {
        Serial.println("Turning FLASH LED OFF");
        setFlashLED(LOW);
        Serial.println("Flash LED command executed");
    } else if (strcmp(message, "LED_TOGGLE") == 0) {
        Serial.println("Toggling FLASH LED");
        toggleFlashLED();
        Serial.println("Flash LED command executed");
    } else {
        Serial.print("Unknown command: ");
        Serial.println(message);
    }
}

unsigned long lastFrame = 0;
const unsigned long frameInterval = 50; // 20 fps target
size_t lastFrameSize = 0;
unsigned long lastFrameTime = 0;
const unsigned long frameTimeout = 1000; // 1 second timeout for frame transmission

void loop() {
    // Check if we're still connected to WiFi and WebSocket
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi connection lost. Restarting...");
        setStatusLED(LOW);
        ESP.restart();
        return;
    }

    if (!client.available()) {
        Serial.println("WebSocket connection lost. Restarting...");
        setStatusLED(LOW);
        ESP.restart();
        return;
    }

    // Keep the websocket connection alive
    client.poll();

    // Limit frame rate to avoid overwhelming the network
    unsigned long currentTime = millis();
    if (currentTime - lastFrame < frameInterval) {
        return;
    }
    lastFrame = currentTime;

    // Get frame from camera with retry
    camera_fb_t *fb = NULL;
    int captureAttempts = 0;
    const int maxCaptureAttempts = 3;
    
    while (captureAttempts < maxCaptureAttempts) {
        fb = esp_camera_fb_get();
        if (fb) {
            break;
        }
        captureAttempts++;
        if (captureAttempts < maxCaptureAttempts) {
            delay(50);  // Short delay between attempts
        }
    }

    if (!fb) {
        Serial.println("Failed to capture frame");
        setStatusLED(LOW);
        return;
    }

    // Ensure it's in JPEG format
    if (fb->format != PIXFORMAT_JPEG) {
        Serial.println("Frame not in JPEG format");
        esp_camera_fb_return(fb);
        setStatusLED(LOW);
        return;
    }

    // Validate frame size
    if (fb->len < 100) {
        Serial.println("Frame too small");
        esp_camera_fb_return(fb);
        setStatusLED(LOW);
        return;
    }

    // Send the image data over WebSocket
    bool sent = client.sendBinary((const char *)fb->buf, fb->len);
    
    if (sent) {
        lastFrameTime = currentTime;
        setStatusLED(HIGH);  // Visual feedback for successful transmission
        Serial.println("Frame sent successfully");
    } else {
        Serial.println("Failed to send frame");
        if (currentTime - lastFrameTime > frameTimeout) {
            Serial.println("Frame timeout, restarting...");
            ESP.restart();
        }
    }
    
    // Return the frame buffer to be reused
    esp_camera_fb_return(fb);
    
    // Turn off status LED
    setStatusLED(LOW);
}