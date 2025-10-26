"""
Simple Eye Tracking Test
Shows visual feedback of face and eye detection
Press 'q' to quit
"""

import cv2
import sys
import time

print("=" * 60)
print("EYE TRACKING TEST")
print("=" * 60)
print()

# Load Haar Cascade classifiers
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')

# Check if cascades loaded
if face_cascade.empty():
    print("❌ ERROR: Could not load face cascade")
    sys.exit(1)

if eye_cascade.empty():
    print("❌ ERROR: Could not load eye cascade")
    sys.exit(1)

print("✅ Haar Cascades loaded successfully")
print()

# Initialize camera with retry
cap = None
for attempt in range(3):
    print(f"Attempt {attempt + 1}/3: Opening camera...")
    
    # Try DirectShow backend on Windows
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    time.sleep(0.5)
    
    if cap.isOpened():
        # Try to read a test frame
        ret, frame = cap.read()
        if ret:
            print("✅ Camera opened successfully!")
            print()
            break
        else:
            print("⚠️ Camera opened but cannot read frames")
            cap.release()
    else:
        print("⚠️ Cannot open camera")
    
    time.sleep(1)
else:
    print()
    print("❌ ERROR: Failed to open camera after 3 attempts")
    print()
    print("Possible issues:")
    print("  - Camera is being used by another application (Teams, Zoom, etc.)")
    print("  - Camera permissions not granted")
    print("  - No camera connected")
    sys.exit(1)

print("=" * 60)
print("CAMERA WINDOW OPENED")
print("=" * 60)
print()
print("Instructions:")
print("  🟢 GREEN BOX = Face detected")
print("  🔵 BLUE BOXES = Eyes detected")
print("  📊 Top-left shows focus status")
print()
print("  👁️ Look at camera = 'FOCUSED'")
print("  🙈 Look away = 'LOOKING AWAY'")
print()
print("  Press 'q' to quit")
print("=" * 60)
print()

looking_away_start = None
away_threshold = 5  # seconds

try:
    while True:
        ret, frame = cap.read()
        
        if not ret:
            print("⚠️ Cannot read frame")
            break
        
        # Convert to grayscale for detection
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Detect faces
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
        
        eyes_detected = False
        
        # Draw rectangles around faces and detect eyes
        for (x, y, w, h) in faces:
            # Draw green rectangle around face
            cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
            
            # Look for eyes in face region
            roi_gray = gray[y:y+h, x:x+w]
            roi_color = frame[y:y+h, x:x+w]
            
            eyes = eye_cascade.detectMultiScale(roi_gray, 1.1, 5)
            
            # Draw blue rectangles around eyes
            for (ex, ey, ew, eh) in eyes:
                cv2.rectangle(roi_color, (ex, ey), (ex+ew, ey+eh), (255, 0, 0), 2)
                eyes_detected = True
        
        # Determine focus status
        if len(faces) > 0 and eyes_detected:
            status = "FOCUSED"
            status_color = (0, 255, 0)  # Green
            looking_away_start = None
        else:
            status = "LOOKING AWAY"
            status_color = (0, 0, 255)  # Red
            
            if looking_away_start is None:
                looking_away_start = time.time()
        
        # Calculate away duration
        away_duration = 0
        if looking_away_start is not None:
            away_duration = time.time() - looking_away_start
        
        # Add status overlay
        overlay_height = 100
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (frame.shape[1], overlay_height), (0, 0, 0), -1)
        frame = cv2.addWeighted(overlay, 0.6, frame, 0.4, 0)
        
        # Add text
        cv2.putText(frame, f"Status: {status}", (10, 30), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, status_color, 2)
        
        cv2.putText(frame, f"Faces: {len(faces)}", (10, 60), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
        
        if eyes_detected:
            cv2.putText(frame, "Eyes: Detected", (10, 85), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 1)
        else:
            cv2.putText(frame, "Eyes: Not detected", (10, 85), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 1)
        
        # Show away duration if looking away
        if away_duration > 0:
            cv2.putText(frame, f"Away: {away_duration:.1f}s / {away_threshold}s", 
                        (frame.shape[1] - 250, 30), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
            
            # Show WOULD PAUSE if threshold reached
            if away_duration >= away_threshold:
                cv2.putText(frame, "*** WOULD PAUSE VIDEO ***", 
                            (frame.shape[1] // 2 - 200, frame.shape[0] - 30), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
        
        # Display the frame
        cv2.imshow('Eye Tracking Test - Press Q to Quit', frame)
        
        # Break on 'q' key
        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("\n👋 Test stopped by user")
            break

except KeyboardInterrupt:
    print("\n👋 Test interrupted by user")
except Exception as e:
    print(f"\n❌ Error: {e}")
finally:
    cap.release()
    cv2.destroyAllWindows()
    print("\n✅ Camera released")
    print("=" * 60)
