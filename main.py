#!/usr/bin/env python3
# file: main.py
import os
import sys
import threading
import time

# Import Websocket and Flask servers
from classes.WSServer import WSServer
import classes.FlaskServer as fs

# Configuration
WSPORT = 5000
FSPORT = 4242

def run_ws():
    """Setup and run Websocket server"""
    ws = WSServer(host='0.0.0.0', port=WSPORT)
    print(f"[+] Starting WebSocket Server on port {WSPORT}")
    ws.run()

def run_fs():
    """Setup and run Flask server"""
    print(f"[+] Starting Flask Server on port {FSPORT}")
    fs.run(host='0.0.0.0', port=FSPORT)

def main():
    """Run both servers in separate threads"""
    # Create the threads
    ws_thread = threading.Thread(target=run_ws, daemon=True)
    fs_thread = threading.Thread(target=run_fs, daemon=True)

    # Start threads
    ws_thread.start()
    fs_thread.start()
    
    print(f"[+] Web interface available at http://localhost:{FSPORT}")
    print("[i] Use CTRL+C to exit")
    
    try:
        # Keep the main thread alive to handle keyboard interrupts
        while threading.active_count() > 0:
            time.sleep(0.1)
    except KeyboardInterrupt:
        print("\n[+] Shutting down servers...")
        sys.exit(0)

if __name__ == "__main__":
    # Make sure the required directories exist
    os.makedirs('classes', exist_ok=True)
    
    # Run the main function
    main()