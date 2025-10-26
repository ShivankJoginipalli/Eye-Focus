"""
Eye Focus Monitor for Chrome Native Messaging
Tracks eye gaze and sends pause commands to Chrome extension when user looks away
"""

import cv2
import sys
import json
import struct
import time
import threading

# Load Haar Cascade classifiers
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')

class EyeMonitor:
    def __init__(self):
        self.cap = None
        self.looking_away_start = None
        self.away_threshold = 5  # seconds before pausing
        self.is_focused = True
        self.last_pause_sent = 0
        self.running = True
        
        # Log to stderr (Chrome native messaging uses stdout for data)
        self.log("Eye Monitor starting...")
        
    def log(self, message):
        """Log to stderr so it doesn't interfere with native messaging"""
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
                
                # Try DirectShow on Windows for better compatibility
                self.cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
                time.sleep(0.5)
                
                if self.cap.isOpened():
                    ret, frame = self.cap.read()
                    if ret:
                        self.log("✓ Camera initialized successfully")
                        return True
                    else:
                        self.log("Camera opened but can't read frames")
                
                self.cap.release()
                time.sleep(1)
                
            except Exception as e:
                self.log(f"Camera init error: {e}")
                time.sleep(1)
        
        self.log("✗ Failed to initialize camera")
        return False
    
    def detect_eyes(self, frame):
        """Detect if eyes are visible in frame"""
        try:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # Detect faces
            faces = face_cascade.detectMultiScale(gray, 1.3, 5)
            
            if len(faces) == 0:
                return False  # No face detected
            
            # Check for eyes in face regions
            for (x, y, w, h) in faces:
                roi_gray = gray[y:y+h, x:x+w]
                eyes = eye_cascade.detectMultiScale(roi_gray, 1.1, 5)
                
                if len(eyes) >= 1:  # At least one eye visible
                    return True
            
            return False  # Face but no eyes
            
        except Exception as e:
            self.log(f"Detection error: {e}")
            return True  # Assume focused on error to avoid false pauses
    
    def send_message(self, message):
        """Send message to Chrome extension using native messaging protocol"""
        try:
            message_json = json.dumps(message)
            
            # Chrome native messaging: 4-byte length header + JSON message
            sys.stdout.buffer.write(struct.pack('I', len(message_json)))
            sys.stdout.buffer.write(message_json.encode('utf-8'))
            sys.stdout.buffer.flush()
            
            self.log(f"✓ Sent: {message_json}")
            return True
            
        except Exception as e:
            self.log(f"✗ Send error: {e}")
            return False
    
    def send_pause_command(self):
        """Send pause command to Chrome"""
        current_time = time.time()
        
        # Prevent spam (minimum 2 seconds between commands)
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
                
                # Check eye detection
                eyes_detected = self.detect_eyes(frame)
                
                if not eyes_detected:
                    # User looking away
                    if self.looking_away_start is None:
                        self.looking_away_start = time.time()
                        self.log("👀 User looking away...")
                    else:
                        away_duration = time.time() - self.looking_away_start
                        
                        # Log every second
                        if int(away_duration) > int(away_duration - 0.2):
                            self.log(f"Away: {away_duration:.1f}s / {self.away_threshold}s")
                        
                        # Send pause after threshold
                        if away_duration >= self.away_threshold and self.is_focused:
                            self.log(f"🔴 THRESHOLD! Sending pause command")
                            self.send_pause_command()
                            self.is_focused = False
                else:
                    # User looking at screen
                    if self.looking_away_start is not None:
                        away_duration = time.time() - self.looking_away_start
                        self.log(f"👁️ User returned (was away {away_duration:.1f}s)")
                    
                    self.looking_away_start = None
                    self.is_focused = True
                
                # Log status periodically
                frame_count += 1
                if frame_count % 50 == 0:
                    status = "FOCUSED" if eyes_detected else "AWAY"
                    self.log(f"Status: {status}")
                
                time.sleep(0.1)  # 10 FPS
                
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

if __name__ == "__main__":
    monitor = EyeMonitor()
    monitor.run()
