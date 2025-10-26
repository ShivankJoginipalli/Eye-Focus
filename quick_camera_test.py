import cv2
import sys

print("Testing camera...")
cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)

if not cap.isOpened():
    print("❌ ERROR: Cannot open camera!")
    sys.exit(1)

print("✅ Camera opened successfully")

ret, frame = cap.read()
if ret:
    print(f"✅ Frame captured! Size: {frame.shape}")
else:
    print("❌ ERROR: Cannot read frame!")

cap.release()
print("Camera test complete")
