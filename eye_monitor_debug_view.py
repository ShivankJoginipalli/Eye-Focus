"""
Eye Monitor with Debug View
Shows camera feed in Chrome for testing
Sends both video frames AND pause commands to Chrome
"""

import cv2
import sys
import json
import struct
import time
import base64
import numpy as np
import os

# Load Haar Cascade classifiers
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')

# Lock file to prevent multiple instances
LOCK_FILE = os.path.join(os.path.dirname(__file__), '.eye_monitor.lock')

def acquire_lock():
    """Try to acquire lock file"""
    if os.path.exists(LOCK_FILE):
        try:
            # Check if process is still running
            with open(LOCK_FILE, 'r') as f:
                old_pid = int(f.read().strip())
            
            # Try to check if old process is still running
            try:
                os.kill(old_pid, 0)  # Signal 0 just checks if process exists
                sys.stderr.write(f"[EyeMonitor] Another instance is already running (PID {old_pid})\n")
                sys.stderr.flush()
                return False
            except OSError:
                # Process doesn't exist, remove stale lock
                os.remove(LOCK_FILE)
        except:
            # Couldn't read lock file, remove it
            try:
                os.remove(LOCK_FILE)
            except:
                pass
    
    # Create lock file with our PID
    try:
        with open(LOCK_FILE, 'w') as f:
            f.write(str(os.getpid()))
        return True
    except:
        return True  # Proceed anyway if we can't create lock

def release_lock():
    """Release lock file"""
    try:
        if os.path.exists(LOCK_FILE):
            os.remove(LOCK_FILE)
    except:
        pass

class EyeMonitorDebug:
    def __init__(self):
        self.cap = None
        self.looking_away_start = None
        self.away_threshold = 5
        self.is_focused = True
        self.last_pause_sent = 0
        self.last_frame_sent = 0
        self.frame_send_interval = 0.5  # Send frame every 0.5 seconds
        self.running = True
        
        self.log("Eye Monitor Debug starting...")
        
    def log(self, message):
        sys.stderr.write(f"[EyeMonitor] {message}\n")
        sys.stderr.flush()
        
    def init_camera(self):
        """Initialize camera with retry logic"""
        for attempt in range(3):
            try:
                self.log(f"Opening camera (attempt {attempt + 1}/3)...")
                
                if self.cap is not None:
                    self.cap.release()
                    time.sleep(0.5)
                
                # Try different backends
                backends = [cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY]
                
                for backend_idx, backend in enumerate(backends):
                    self.log(f"  Trying backend {backend_idx + 1}/3...")
                    self.cap = cv2.VideoCapture(0, backend)
                    time.sleep(0.3)
                    
                    if self.cap.isOpened():
                        # Set properties for better compatibility
                        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                        
                        ret, frame = self.cap.read()
                        if ret and frame is not None:
                            self.log(f"✓ Camera initialized with backend {backend_idx + 1}")
                            return True
                        else:
                            self.log(f"  Backend {backend_idx + 1}: Can't read frames")
                            self.cap.release()
                    else:
                        self.log(f"  Backend {backend_idx + 1}: Can't open camera")
                
                time.sleep(1)
                
            except Exception as e:
                self.log(f"Camera init error: {e}")
                import traceback
                self.log(traceback.format_exc())
                time.sleep(1)
        
        self.log("✗ Failed to initialize camera - may be in use by another application")
        return False
    
    def detect_eyes(self, frame):
        """Detect if eyes are visible in frame"""
        try:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.3, 5)
            
            if len(faces) == 0:
                return False, 0
            
            eyes_count = 0
            for (x, y, w, h) in faces:
                roi_gray = gray[y:y+h, x:x+w]
                eyes = eye_cascade.detectMultiScale(roi_gray, 1.1, 5)
                eyes_count += len(eyes)
                
                if len(eyes) >= 1:
                    return True, eyes_count
            
            return False, eyes_count
            
        except Exception as e:
            self.log(f"Detection error: {e}")
            return True, 0
    
    def create_debug_frame(self, frame, eyes_detected, eyes_count, away_duration):
        """Create annotated frame with detection info"""
        debug_frame = frame.copy()
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Detect and draw faces
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
        for (x, y, w, h) in faces:
            cv2.rectangle(debug_frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
            
            # Detect and draw eyes
            roi_gray = gray[y:y+h, x:x+w]
            roi_color = debug_frame[y:y+h, x:x+w]
            eyes = eye_cascade.detectMultiScale(roi_gray, 1.1, 5)
            
            for (ex, ey, ew, eh) in eyes:
                cv2.rectangle(roi_color, (ex, ey), (ex+ew, ey+eh), (255, 0, 0), 2)
        
        # Add status overlay
        overlay = debug_frame.copy()
        cv2.rectangle(overlay, (0, 0), (debug_frame.shape[1], 80), (0, 0, 0), -1)
        debug_frame = cv2.addWeighted(overlay, 0.6, debug_frame, 0.4, 0)
        
        # Status text
        status = "FOCUSED" if eyes_detected else "LOOKING AWAY"
        color = (0, 255, 0) if eyes_detected else (0, 0, 255)
        
        cv2.putText(debug_frame, f"Status: {status}", (10, 25), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
        cv2.putText(debug_frame, f"Faces: {len(faces)} | Eyes: {eyes_count}", (10, 50), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        
        if away_duration > 0:
            cv2.putText(debug_frame, f"Away: {away_duration:.1f}s / {self.away_threshold}s", 
                        (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)
        
        return debug_frame
    
    def send_message(self, message):
        """Send message to Chrome extension"""
        try:
            message_json = json.dumps(message)
            
            sys.stdout.buffer.write(struct.pack('I', len(message_json)))
            sys.stdout.buffer.write(message_json.encode('utf-8'))
            sys.stdout.buffer.flush()
            
            self.log(f"✓ Sent: {message.get('action', 'frame')}")
            return True
            
        except Exception as e:
            self.log(f"✗ Send error: {e}")
            return False
    
    def send_frame(self, frame, eyes_detected, away_duration):
        """Send annotated frame to Chrome for display"""
        current_time = time.time()
        
        # Don't send frames too frequently
        if current_time - self.last_frame_sent < self.frame_send_interval:
            return
        
        try:
            # Resize frame for transmission (smaller = faster)
            small_frame = cv2.resize(frame, (320, 240))
            
            # Encode as JPEG
            _, buffer = cv2.imencode('.jpg', small_frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            
            # Convert to base64
            frame_base64 = base64.b64encode(buffer).decode('utf-8')
            
            message = {
                "action": "debug_frame",
                "frame": frame_base64,
                "focused": eyes_detected,
                "away_duration": away_duration
            }
            
            self.send_message(message)
            self.last_frame_sent = current_time
            
        except Exception as e:
            self.log(f"Frame send error: {e}")
    
    def send_pause_command(self):
        """Send pause command to Chrome"""
        current_time = time.time()
        
        if current_time - self.last_pause_sent < 2:
            return
        
        message = {
            "action": "pause_video",
            "reason": "eyes_away"
        }
        
        if self.send_message(message):
            self.last_pause_sent = current_time
    
    def monitor_loop(self):
        """Main monitoring loop"""
        self.log("Starting eye tracking loop...")
        
        if not self.init_camera():
            self.log("✗ Cannot start - camera initialization failed")
            # Send error message to Chrome
            self.send_message({
                "action": "camera_error",
                "error": "Camera busy or not available. Close other apps using camera (Teams, Zoom, etc.)"
            })
            return
        
        try:
            frame_count = 0
            
            while self.running:
                ret, frame = self.cap.read()
                
                if not ret:
                    self.log("Cannot read frame, reinitializing camera...")
                    if not self.init_camera():
                        break
                    continue
                
                # Detect eyes
                eyes_detected, eyes_count = self.detect_eyes(frame)
                
                # Calculate away duration
                away_duration = 0
                if not eyes_detected:
                    if self.looking_away_start is None:
                        self.looking_away_start = time.time()
                        self.log("👀 User looking away...")
                    else:
                        away_duration = time.time() - self.looking_away_start
                        
                        # Send pause after threshold
                        if away_duration >= self.away_threshold and self.is_focused:
                            self.log(f"🔴 THRESHOLD! Sending pause command")
                            self.send_pause_command()
                            self.is_focused = False
                else:
                    # User looking at screen
                    if self.looking_away_start is not None:
                        duration = time.time() - self.looking_away_start
                        self.log(f"👁️ User returned (was away {duration:.1f}s)")
                    
                    self.looking_away_start = None
                    self.is_focused = True
                    away_duration = 0
                
                # Create and send debug frame
                debug_frame = self.create_debug_frame(frame, eyes_detected, eyes_count, away_duration)
                self.send_frame(debug_frame, eyes_detected, away_duration)
                
                frame_count += 1
                time.sleep(0.1)
                
        except KeyboardInterrupt:
            self.log("Stopped by user")
        except Exception as e:
            self.log(f"Error in monitor loop: {e}")
        finally:
            if self.cap is not None:
                self.cap.release()
                self.log("Camera released")
    
    def run(self):
        """Start the monitor"""
        try:
            self.monitor_loop()
        except Exception as e:
            self.log(f"Fatal error: {e}")
            sys.exit(1)
        finally:
            release_lock()

if __name__ == "__main__":
    # Check for existing instance
    if not acquire_lock():
        sys.stderr.write("[EyeMonitor] Exiting - another instance already running\n")
        sys.stderr.flush()
        sys.exit(1)
    
    try:
        monitor = EyeMonitorDebug()
        monitor.run()
    finally:
        release_lock()
