"""
Quick test to verify eye tracking is working
This will open your webcam and show if faces/eyes are detected
Press 'q' to quit
"""

import cv2
import sys

# Load Haar Cascade classifiers
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')

def test_eye_tracking():
    print("=" * 50)
    print("EYE TRACKING TEST")
    print("=" * 50)
    
    # Check if cascades loaded
    if face_cascade.empty():
        print("❌ ERROR: Face cascade not loaded!")
        return False
    if eye_cascade.empty():
        print("❌ ERROR: Eye cascade not loaded!")
        return False
    
    print("✅ Haar Cascades loaded successfully")
    
    # Try to open webcam
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("❌ ERROR: Cannot access webcam!")
        print("   - Check if another app is using the camera")
        print("   - Check Windows camera privacy settings")
        return False
    
    print("✅ Webcam opened successfully")
    print("\n📹 Starting live detection...")
    print("   - GREEN box = Face detected")
    print("   - BLUE box = Eyes detected")
    print("   - Press 'q' to quit\n")
    
    frame_count = 0
    faces_detected = 0
    eyes_detected = 0
    
    while True:
        ret, frame = cap.read()
        
        if not ret:
            print("❌ ERROR: Cannot read frame from webcam")
            break
        
        frame_count += 1
        
        # Convert to grayscale
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Detect faces
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
        
        has_eyes = False
        
        for (x, y, w, h) in faces:
            # Draw rectangle around face
            cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
            faces_detected += 1
            
            # Look for eyes in face region
            roi_gray = gray[y:y+h, x:x+w]
            roi_color = frame[y:y+h, x:x+w]
            eyes = eye_cascade.detectMultiScale(roi_gray, 1.1, 5)
            
            for (ex, ey, ew, eh) in eyes:
                cv2.rectangle(roi_color, (ex, ey), (ex+ew, ey+eh), (255, 0, 0), 2)
                has_eyes = True
            
            if has_eyes:
                eyes_detected += 1
        
        # Show status on frame
        status = "LOOKING AT SCREEN ✅" if has_eyes else "LOOKING AWAY ❌"
        color = (0, 255, 0) if has_eyes else (0, 0, 255)
        cv2.putText(frame, status, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)
        
        # Show frame count
        cv2.putText(frame, f"Frame: {frame_count}", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
        
        # Display
        cv2.imshow('Eye Tracking Test - Press Q to quit', frame)
        
        # Exit on 'q'
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    cap.release()
    cv2.destroyAllWindows()
    
    print("\n" + "=" * 50)
    print("TEST RESULTS")
    print("=" * 50)
    print(f"📊 Total frames processed: {frame_count}")
    print(f"😊 Faces detected: {faces_detected}")
    print(f"👁️  Eyes detected: {eyes_detected}")
    
    if eyes_detected > 0:
        print("\n✅ EYE TRACKING IS WORKING!")
        print("   Your eyes are being detected successfully.")
        return True
    elif faces_detected > 0:
        print("\n⚠️  FACE DETECTED BUT NO EYES")
        print("   Try:")
        print("   - Better lighting")
        print("   - Remove glasses if wearing them")
        print("   - Look directly at camera")
        return False
    else:
        print("\n❌ NO FACE DETECTED")
        print("   Try:")
        print("   - Better lighting")
        print("   - Position yourself in front of camera")
        print("   - Make sure webcam is working")
        return False

if __name__ == "__main__":
    try:
        test_eye_tracking()
    except KeyboardInterrupt:
        print("\n\n⏹️  Test stopped by user")
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        sys.exit(1)
