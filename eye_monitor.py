"""
Eye Focus Monitor for YouTube
Tracks eye gaze and pauses video when user looks away for 5+ seconds
Uses the existing eye_focus_tracker.py for eye detection
"""

import cv2
import numpy as np
import time
import json
import sys
import struct
import threading

# Load pre-trained Haar Cascade classifiers
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')

class EyeFocusMonitor:
    def __init__(self):
        sys.stderr.write("[EyeFocus] Initializing eye tracker...\n")
        sys.stderr.flush()
        
        try:
            self.cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)  # Use DirectShow for Windows
            
            # Give camera time to initialize
            time.sleep(1)
            
            if not self.cap.isOpened():
                sys.stderr.write("[EyeFocus] ERROR: Camera failed to open\n")
                sys.stderr.flush()
                raise Exception("Camera not available")
            
            # Try to read a test frame
            ret, frame = self.cap.read()
            if not ret:
                sys.stderr.write("[EyeFocus] ERROR: Cannot read from camera\n")
                sys.stderr.flush()
                self.cap.release()
                raise Exception("Cannot read camera frames")
            
            sys.stderr.write("[EyeFocus] Camera initialized successfully\n")
            sys.stderr.flush()
            
        except Exception as e:
            sys.stderr.write(f"[EyeFocus] FATAL: Camera initialization failed: {e}\n")
            sys.stderr.flush()
            raise
        
        self.looking_away_start = None
        self.away_threshold = 5  # seconds
        self.is_focused = True
        self.last_pause_sent = 0  # Prevent spam
        
    def detect_eyes(self, frame):
        """Detect if eyes are visible in frame"""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Apply histogram equalization to improve contrast
        gray = cv2.equalizeHist(gray)
        
        # Detect faces - stricter parameters
        faces = face_cascade.detectMultiScale(
            gray, 
            scaleFactor=1.1,   # Stricter
            minNeighbors=5,    # Stricter (need more confirming neighbors)
            minSize=(50, 50),  # Minimum face size
            flags=cv2.CASCADE_SCALE_IMAGE
        )
        
        if len(faces) == 0:
            # No face detected - definitely looking away
            return False
        
        # Check for eyes in each face region
        for (x, y, w, h) in faces:
            # Only look for eyes in upper 60% of face (where eyes actually are)
            roi_gray = gray[y:y+int(h*0.6), x:x+w]
            
            # Stricter eye detection - need both eyes
            eyes = eye_cascade.detectMultiScale(
                roi_gray, 
                scaleFactor=1.1,   # Stricter
                minNeighbors=6,    # Even stricter - was 5
                minSize=(25, 25),  # Larger minimum - was (20, 20)
                maxSize=(80, 80)   # Maximum size to filter out large false positives
            )
            
            # Filter eyes: they should be roughly at the same height (y-coordinate)
            # and in the middle portion of the face (not at edges)
            valid_eyes = []
            face_width = w
            
            for (ex, ey, ew, eh) in eyes:
                # Eye should be in middle 80% of face width (not at edges where ears are)
                if 0.1 * face_width < ex < 0.9 * face_width:
                    # Eye aspect ratio should be reasonable (not too elongated)
                    aspect_ratio = ew / float(eh)
                    if 0.7 < aspect_ratio < 1.5:  # Eyes are roughly square/circular
                        valid_eyes.append((ex, ey, ew, eh))
            
            # Need at least 2 valid eyes at roughly the same height
            if len(valid_eyes) >= 2:
                # Check if eyes are at similar height (within 20 pixels)
                eyes_sorted = sorted(valid_eyes, key=lambda e: e[1])  # Sort by y
                if abs(eyes_sorted[0][1] - eyes_sorted[1][1]) < 20:
                    return True
        
        # Face detected but not enough valid eyes - looking away
        return False
    
    def send_pause_command(self):
        """Send message to Chrome extension to pause video"""
        current_time = time.time()
        
        # Prevent sending multiple pause commands too quickly (reduced to 1 second)
        if current_time - self.last_pause_sent < 1:
            sys.stderr.write("[EyeFocus] ⏳ Cooldown active, skipping duplicate pause\n")
            sys.stderr.flush()
            return
        
        try:
            message = {"action": "pause_video", "reason": "eyes_away"}
            message_json = json.dumps(message)
            
            # Chrome native messaging format
            sys.stdout.buffer.write(struct.pack('I', len(message_json)))
            sys.stdout.buffer.write(message_json.encode('utf-8'))
            sys.stdout.buffer.flush()
            
            self.last_pause_sent = current_time
            sys.stderr.write(f"[EyeFocus] Sent pause command - user looked away\n")
            sys.stderr.flush()
        except Exception as e:
            sys.stderr.write(f"[EyeFocus] Error sending pause command: {e}\n")
            sys.stderr.flush()
    
    def run(self):
        """Main monitoring loop"""
        try:
            sys.stderr.write("[EyeFocus] Eye tracking started. Monitoring gaze...\n")
            sys.stderr.flush()
            
            if not self.cap.isOpened():
                sys.stderr.write("[EyeFocus] ERROR: Cannot open webcam\n")
                sys.stderr.flush()
                sys.exit(1)
            
            sys.stderr.write("[EyeFocus] Webcam successfully opened\n")
            sys.stderr.flush()
            
            frame_count = 0
            
            while True:
                ret, frame = self.cap.read()
                
                if not ret:
                    sys.stderr.write("[EyeFocus] ERROR: Cannot read frame\n")
                    sys.stderr.flush()
                    time.sleep(0.5)
                    continue
                
                frame_count += 1
                
                # Log every 100 frames to show it's working
                if frame_count % 100 == 0:
                    sys.stderr.write(f"[EyeFocus] Processed {frame_count} frames\n")
                    sys.stderr.flush()
                
                # Check if user is looking at screen
                is_currently_focused = self.detect_eyes(frame)
                
                if not is_currently_focused:
                    # User is looking away or eyes not visible
                    if self.looking_away_start is None:
                        self.looking_away_start = time.time()
                        sys.stderr.write("[EyeFocus] ⚠️ User looking away - timer started\n")
                        sys.stderr.flush()
                    else:
                        # Check how long they've been looking away
                        away_duration = time.time() - self.looking_away_start
                        
                        if away_duration >= self.away_threshold:
                            # Been away for 5+ seconds
                            if self.is_focused:
                                # First time crossing threshold - send pause command
                                sys.stderr.write(f"[EyeFocus] 🚨 User away for {away_duration:.1f}s - Sending pause command\n")
                                sys.stderr.flush()
                                self.send_pause_command()
                                self.is_focused = False
                            # else: already sent pause, still looking away - do nothing
                else:
                    # User is looking at screen
                    if self.looking_away_start is not None:
                        away_duration = time.time() - self.looking_away_start
                        sys.stderr.write(f"[EyeFocus] ✅ User back! (was away {away_duration:.1f}s)\n")
                        sys.stderr.flush()
                        self.looking_away_start = None
                    
                    # Always reset focused flag when looking at screen
                    if not self.is_focused:
                        sys.stderr.write("[EyeFocus] 🔄 Reset - ready to detect next look-away\n")
                        sys.stderr.flush()
                    self.is_focused = True
                    self.is_focused = True
                
                # Small delay to reduce CPU usage
                time.sleep(0.2)
        
        except Exception as e:
            sys.stderr.write(f"[EyeFocus] FATAL ERROR in run loop: {e}\n")
            sys.stderr.flush()
            import traceback
            traceback.print_exc(file=sys.stderr)
            sys.stderr.flush()
        finally:
            self.cap.release()
            sys.stderr.write("[EyeFocus] Webcam released\n")
            sys.stderr.flush()

if __name__ == "__main__":
    # Start a thread to read from stdin (Chrome native messaging requirement)
    # This prevents Chrome from thinking the host has hung
    def read_stdin():
        """Read and discard messages from Chrome (we don't need them)"""
        try:
            while True:
                text_length_bytes = sys.stdin.buffer.read(4)
                if len(text_length_bytes) == 0:
                    # Chrome disconnected
                    sys.stderr.write("[EyeFocus] Chrome disconnected\n")
                    sys.stderr.flush()
                    break
                
                text_length = struct.unpack('I', text_length_bytes)[0]
                text = sys.stdin.buffer.read(text_length).decode('utf-8')
                sys.stderr.write(f"[EyeFocus] Received from Chrome: {text}\n")
                sys.stderr.flush()
        except Exception as e:
            sys.stderr.write(f"[EyeFocus] stdin reader error: {e}\n")
            sys.stderr.flush()
    
    # Start stdin reader in background thread
    stdin_thread = threading.Thread(target=read_stdin, daemon=True)
    stdin_thread.start()
    
    try:
        sys.stderr.write("[EyeFocus] Starting eye monitor...\n")
        sys.stderr.flush()
        
        monitor = EyeFocusMonitor()
        
        sys.stderr.write("[EyeFocus] Monitor initialized successfully\n")
        sys.stderr.flush()
        
        monitor.run()
        
    except KeyboardInterrupt:
        sys.stderr.write("\n[EyeFocus] Stopped by user\n")
        sys.stderr.flush()
    except Exception as e:
        sys.stderr.write(f"[EyeFocus] FATAL ERROR: {str(e)}\n")
        sys.stderr.flush()
        
        # Print full traceback
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.stderr.flush()
        
        # Don't exit immediately - wait a bit so Chrome can read the error
        time.sleep(2)
        sys.exit(1)
