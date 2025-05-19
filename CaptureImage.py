import cv2
import os
import datetime
import sys
import time
import logging
import platform
import json
from PIL import Image, ImageDraw, ImageFont
from PIL.ExifTags import TAGS

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(os.path.dirname(__file__), "camera_log.txt")),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("CaptureImage")

# Configuration
BASE_DIR = os.path.dirname(__file__)
CAPTURE_DIR = os.path.join(BASE_DIR, "Captures")
CONFIG = {
    "camera_index": 0,  # Default camera index
    "max_camera_try": 3,  # Maximum number of cameras to try
    "image_quality": 85,  # JPEG quality (0-100)
    "resolution": (1280, 720),  # Preferred resolution
    "buffer_size": 1,  # Camera buffer size
    "warmup_time": 0.5,  # Camera warmup time in seconds
}

def get_camera(camera_index=None):
    """
    Initialize camera with Windows-specific optimizations to avoid permission dialogs.
    Will try multiple cameras if the specified one fails.
    """
    if camera_index is None:
        camera_index = CONFIG["camera_index"]
    
    max_try = CONFIG["max_camera_try"]
    
    # Try cameras in sequence if needed
    for i in range(camera_index, camera_index + max_try):
        try:
            # Use DirectShow backend on Windows to avoid permission dialogs
            if platform.system() == 'Windows':
                cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
            else:
                cap = cv2.VideoCapture(i)
            
            # Configure camera properties to avoid dialogs
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, CONFIG["resolution"][0])
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CONFIG["resolution"][1])
            cap.set(cv2.CAP_PROP_BUFFERSIZE, CONFIG["buffer_size"])
            
            # Check if camera opened successfully
            if cap.isOpened():
                logger.info(f"Successfully opened camera {i}")
                return cap, i
            
            # Release failed camera
            cap.release()
            
        except Exception as e:
            logger.error(f"Error opening camera {i}: {str(e)}")
    
    logger.error(f"Failed to open any camera after trying {max_try} devices")
    return None, -1

def create_capture_directory():
    """Create structured directory for image storage"""
    # Create date-based directories
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    capture_path = os.path.join(CAPTURE_DIR, today)
    os.makedirs(capture_path, exist_ok=True)
    return capture_path

def add_metadata_to_image(image_path, metadata):
    """Add text overlay with metadata to image"""
    try:
        # Open image with PIL
        img = Image.open(image_path)
        draw = ImageDraw.Draw(img)
        
        # Add timestamp and other metadata as text overlay
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        text = f"Timestamp: {timestamp}"
        
        if metadata:
            for key, value in metadata.items():
                text += f"\n{key}: {value}"
        
        # Position text at bottom left with black background
        text_width, text_height = draw.textsize(text)
        text_position = (10, img.height - text_height - 20)
        
        # Draw semi-transparent background
        draw.rectangle(
            [(0, img.height - text_height - 40), (img.width, img.height)],
            fill=(0, 0, 0, 128)
        )
        
        # Draw text
        draw.text(text_position, text, fill=(255, 255, 255))
        
        # Save the modified image
        img.save(image_path, quality=CONFIG["image_quality"])
        
        # Also save metadata as separate JSON file
        json_path = os.path.splitext(image_path)[0] + ".json"
        metadata['timestamp'] = timestamp
        with open(json_path, 'w') as f:
            json.dump(metadata, f, indent=4)
            
        logger.info(f"Added metadata to image: {image_path}")
        return True
    except Exception as e:
        logger.error(f"Error adding metadata to image: {str(e)}")
        return False

def capture_intruder_image(metadata=None):
    """
    Capture an image from the camera with improved error handling,
    Windows-specific optimizations, and better storage.
    
    Args:
        metadata (dict): Optional metadata to add to the image
        
    Returns:
        tuple: (success, image_path, camera_index)
    """
    cap = None
    try:
        # Create directory structure
        capture_path = create_capture_directory()
        
        # Initialize camera with auto-selection
        cap, camera_index = get_camera()
        
        if not cap:
            logger.error("Failed to initialize any camera")
            return False, None, -1
        
        # Allow camera to warm up
        time.sleep(CONFIG["warmup_time"])
        
        # Capture frame
        ret, frame = cap.read()
        
        if not ret or frame is None:
            logger.error("Failed to capture frame")
            return False, None, camera_index
        
        # Generate filename with timestamp
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"intruder_{timestamp}.jpg"
        filepath = os.path.join(capture_path, filename)
        
        # Save image with compression
        cv2.imwrite(filepath, frame, [cv2.IMWRITE_JPEG_QUALITY, CONFIG["image_quality"]])
        logger.info(f"Security image saved: {filepath}")
        
        # Add metadata if provided
        if metadata:
            add_metadata_to_image(filepath, metadata)
        
        return True, filepath, camera_index
        
    except Exception as e:
        logger.error(f"Error capturing image: {str(e)}")
        return False, None, -1
        
    finally:
        if cap:
            cap.release()

def test_all_cameras():
    """Test all available cameras and report which ones work"""
    working_cameras = []
    
    for i in range(5):  # Try 5 possible cameras
        try:
            if platform.system() == 'Windows':
                cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
            else:
                cap = cv2.VideoCapture(i)
                
            if cap.isOpened():
                ret, frame = cap.read()
                if ret:
                    working_cameras.append(i)
                    logger.info(f"Camera {i} is working")
                cap.release()
        except:
            pass
    
    return working_cameras

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        # Test mode to find working cameras
        print("Testing available cameras...")
        cameras = test_all_cameras()
        print(f"Working cameras: {cameras}")
        sys.exit(0)
    else:
        # Normal capture mode
        metadata = {
            "source": "security_system",
            "reason": "login_attempt",
            "camera": str(CONFIG["camera_index"])
        }
        success, filepath, used_camera = capture_intruder_image(metadata)
        sys.exit(0 if success else 1)
