"""
Simple Eye Tracker Test - Visual feedback
Shows camera feed with face/eye detection boxes
Press 'q' to quit
"""

import cv2
import time

face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')

print("Opening camera...")
cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)

if not cap.isOpened():
    print("ERROR: Cannot open webcam!")
    print("Make sure:")
    print("  1. No other apps are using the camera")
    print("  2. Camera permissions are enabled in Windows settings")
    exit(1)

print("Camera opened! Press 'q' to quit")

# Let camera warm up
print("Warming up camera...")
for i in range(10):
    ret, frame = cap.read()
    time.sleep(0.1)
print("Camera ready!")

looking_away_start = None
away_threshold = 5

while True:
    ret, frame = cap.read()
    
    if not ret:
        print("ERROR: Cannot read frame")
        break
    
    # Convert to grayscale and enhance
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    
    # Detect faces - stricter parameters
    faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(50, 50))
    
    eyes_found = False
    
    # Draw faces and find eyes
    for (x, y, w, h) in faces:
        cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
        
        # Only look for eyes in upper 60% of face
        roi_gray = gray[y:y+int(h*0.6), x:x+w]
        
        # Stricter eye detection
        eyes = eye_cascade.detectMultiScale(
            roi_gray, 
            scaleFactor=1.1,
            minNeighbors=6,    # Even stricter
            minSize=(25, 25),  # Larger minimum
            maxSize=(80, 80)   # Maximum size
        )
        
        # Filter eyes: must be in middle of face and proper aspect ratio
        valid_eyes = []
        face_width = w
        
        for (ex, ey, ew, eh) in eyes:
            # Eye in middle 80% of face (not at edges)
            if 0.1 * face_width < ex < 0.9 * face_width:
                # Aspect ratio check
                aspect_ratio = ew / float(eh)
                if 0.7 < aspect_ratio < 1.5:
                    valid_eyes.append((ex, ey, ew, eh))
                    # Draw valid eyes in blue
                    cv2.rectangle(frame, (x+ex, y+ey), (x+ex+ew, y+ey+eh), (255, 0, 0), 2)
        
        # Check if at least 2 eyes at similar height
        if len(valid_eyes) >= 2:
            eyes_sorted = sorted(valid_eyes, key=lambda e: e[1])
            if abs(eyes_sorted[0][1] - eyes_sorted[1][1]) < 20:
                eyes_found = True
    
    # Update timer
    if not eyes_found:
        if looking_away_start is None:
            looking_away_start = time.time()
    else:
        looking_away_start = None
    
    # Show status
    if looking_away_start:
        away_time = time.time() - looking_away_start
        if away_time >= away_threshold:
            status = f"WOULD PAUSE VIDEO! ({away_time:.1f}s)"
            color = (0, 0, 255)
        else:
            status = f"Looking away: {away_time:.1f}s / {away_threshold}s"
            color = (0, 165, 255)
    else:
        status = "FOCUSED"
        color = (0, 255, 0)
    
    cv2.putText(frame, status, (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)
    cv2.putText(frame, f"Faces: {len(faces)} | Eyes: {eyes_found}", (10, 80), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
    
    cv2.imshow('Eye Tracker - Press Q to quit', frame)
    
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
print("Test complete!")
