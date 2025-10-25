import cv2
import numpy as np
import time

# Load pre-trained Haar Cascade classifiers
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')

if face_cascade.empty() or eye_cascade.empty():
    raise IOError("Error loading Haar cascades. Check your OpenCV installation.")

# Calibration states
pre_calibration_mode = True
eye_detection_confirmed = False
calibration_complete = False
current_calibration_point = 0

# Tracking variables
looking_at_screen = False
focus_start_time = None
total_focus_time = 0
last_focus_check = time.time()

# Calibration data: map pupil positions to screen coordinates
calibration_pupil_positions = []  # List of (pupil_x, pupil_y)
calibration_screen_positions = []  # List of (screen_x, screen_y)
sample_start_time = None
calibration_duration = 1.5  # seconds per point

# Smoothing buffer
prev_pupil = None

# Mapping matrix learned from calibration: 2x3 affine (maps [pupil_x, pupil_y, 1] -> [screen_x, screen_y])
mapping_matrix = None

# Screen boundary margin (percentage)
SCREEN_MARGIN = 0.05  # 5% margin from edges

# Debug mode
debug_mode = False

# --- FUNCTIONS ---

def detect_pupil(eye_frame):
    """Detect pupil using darkest point method"""
    if eye_frame.size == 0:
        return None
    
    gray = cv2.cvtColor(eye_frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (7, 7), 0)
    
    # Try threshold method first
    _, threshold = cv2.threshold(gray, 30, 255, cv2.THRESH_BINARY_INV)
    contours, _ = cv2.findContours(threshold, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    
    if contours:
        valid_contours = [c for c in contours if cv2.contourArea(c) > 20]
        if valid_contours:
            largest = max(valid_contours, key=cv2.contourArea)
            moments = cv2.moments(largest)
            if moments['m00'] != 0:
                cx = int(moments['m10'] / moments['m00'])
                cy = int(moments['m01'] / moments['m00'])
                return (cx, cy)
    
    # Fallback: darkest point
    min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(gray)
    return min_loc


def get_pupil_positions(frame, gray):
    """Get current pupil positions from both eyes"""
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)
    if len(faces) == 0:
        return None

    face = max(faces, key=lambda f: f[2] * f[3])
    x, y, w, h = face

    roi_gray = gray[y:y + int(h/2), x:x + w]
    roi_color = frame[y:y + int(h/2), x:x + w]
    if roi_gray.size == 0:
        return None

    eyes = eye_cascade.detectMultiScale(roi_gray, 1.1, 5, minSize=(30, 30))
    pupil_data = []

    for (ex, ey, ew, eh) in eyes:
        eye_frame = roi_color[ey:ey + eh, ex:ex + ew]
        pupil = detect_pupil(eye_frame)
        if pupil:
            norm_x = pupil[0] / ew
            norm_y = pupil[1] / eh
            pupil_data.append((norm_x, norm_y))

    if len(pupil_data) >= 1:
        avg_x = sum(p[0] for p in pupil_data) / len(pupil_data)
        avg_y = sum(p[1] for p in pupil_data) / len(pupil_data)
        return (avg_x, avg_y)
    return None


def check_eye_detection(frame, gray):
    """Check if face and eyes are detected"""
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)
    if len(faces) == 0:
        return 0, 0, None, None

    face = max(faces, key=lambda f: f[2] * f[3])
    x, y, w, h = face
    roi_gray = gray[y:y + int(h/2), x:x + w]
    if roi_gray.size == 0:
        return 0, 0, None, None

    eyes = eye_cascade.detectMultiScale(roi_gray, 1.1, 5, minSize=(30, 30))
    return len(faces), len(eyes), (x, y, w, h), eyes


def compute_linear_mapping(calib_pupil_pos, calib_screen_pos):
    """Compute an affine mapping from pupil normalized coords to screen pixel coords.

    Solves S = P * M where P is [n x 3] of [px, py, 1] and S is [n x 2] of screen coords.
    Returns M (2x3) or None if it cannot be computed.
    """
    if len(calib_pupil_pos) < 3:
        return None

    P = np.array([[p[0], p[1], 1.0] for p in calib_pupil_pos])  # n x 3
    S = np.array([[s[0], s[1]] for s in calib_screen_pos])     # n x 2

    try:
        # Solve least squares: find X (3x2) so that P @ X = S
        X, *_ = np.linalg.lstsq(P, S, rcond=None)
        # X is 3x2; return transposed to 2x3 for easy dot with [px,py,1]
        return X.T
    except Exception as e:
        print(f"Failed to compute linear mapping: {e}")
        return None


def estimate_gaze_position(pupil, calib_pupil_pos, calib_screen_pos, frame_width, frame_height, mapping=None):
    """Estimate screen gaze position.

    If an affine mapping (mapping) is provided it will be used. Otherwise fall back to inverse-distance weighting.
    """
    if pupil is None:
        return None

    # Use mapping if available
    if mapping is not None:
        vec = np.array([pupil[0], pupil[1], 1.0])
        est = mapping.dot(vec)
        return (float(est[0]), float(est[1]))

    if len(calib_pupil_pos) < 3:
        return None

    # Fallback: inverse distance weighting
    weights = []
    for calib_pupil in calib_pupil_pos:
        distance = np.sqrt((pupil[0] - calib_pupil[0])**2 + (pupil[1] - calib_pupil[1])**2)
        if distance < 0.001:  # Very close to a calibration point
            return calib_screen_pos[calib_pupil_pos.index(calib_pupil)]
        weights.append(1.0 / (distance + 0.001))

    total_weight = sum(weights)
    if total_weight == 0:
        return None

    weights = [w / total_weight for w in weights]
    est_x = sum(w * pos[0] for w, pos in zip(weights, calib_screen_pos))
    est_y = sum(w * pos[1] for w, pos in zip(weights, calib_screen_pos))
    return (est_x, est_y)


def is_looking_at_screen(gaze_pos, frame_width, frame_height, margin=SCREEN_MARGIN):
    """Check if estimated gaze is within screen bounds with margin"""
    if gaze_pos is None:
        return False
    
    x, y = gaze_pos
    margin_x = frame_width * margin
    margin_y = frame_height * margin
    
    return (-margin_x <= x <= frame_width + margin_x and 
            -margin_y <= y <= frame_height + margin_y)


def smooth_pupil(current, previous, alpha=0.7):
    """Apply exponential smoothing to pupil position"""
    if previous is None:
        return current
    return (alpha * previous[0] + (1 - alpha) * current[0],
            alpha * previous[1] + (1 - alpha) * current[1])


# --- MAIN PROGRAM ---
cap = cv2.VideoCapture(0)
ret, test_frame = cap.read()
if not ret:
    print("Error: Unable to access camera.")
    exit()

frame_height, frame_width = test_frame.shape[:2]

# Calibration points: 9 points in a 3x3 grid
calibration_targets = [
    (frame_width // 2, frame_height // 2),  # Center
    (int(frame_width * 0.15), int(frame_height * 0.15)),  # Top-left
    (int(frame_width * 0.5), int(frame_height * 0.15)),  # Top-center
    (int(frame_width * 0.85), int(frame_height * 0.15)),  # Top-right
    (int(frame_width * 0.15), int(frame_height * 0.5)),  # Mid-left
    (int(frame_width * 0.85), int(frame_height * 0.5)),  # Mid-right
    (int(frame_width * 0.15), int(frame_height * 0.85)),  # Bottom-left
    (int(frame_width * 0.5), int(frame_height * 0.85)),  # Bottom-center
    (int(frame_width * 0.85), int(frame_height * 0.85)),  # Bottom-right
]

temp_samples = []  # Temporary storage for current calibration point

cv2.namedWindow('Screen Focus Tracker', cv2.WND_PROP_FULLSCREEN)
cv2.setWindowProperty('Screen Focus Tracker', cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)

print("Screen Focus Tracker initialized")
print("You will calibrate by looking at 5 points on the screen")
print("Press SPACE when looking at each point")
print("Press 'd' to toggle debug mode")
print("Press '+' to increase margin, '-' to decrease margin")
print("Press 'q' to quit")

calibration_message_time = 0

while True:
    ret, frame = cap.read()
    if not ret:
        print("Camera disconnected or frame not captured.")
        break

    frame = cv2.flip(frame, 1)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # --- PRE-CALIBRATION MODE ---
    if pre_calibration_mode:
        num_faces, num_eyes, face_rect, eyes = check_eye_detection(frame, gray)

        if face_rect is not None:
            x, y, w, h = face_rect
            cv2.rectangle(frame, (x, y), (x + w, y + int(h/2)), (255, 0, 0), 2)
            for (ex, ey, ew, eh) in eyes:
                cv2.rectangle(frame, (x + ex, y + ey), (x + ex + ew, y + ey + eh), (0, 255, 0), 2)
                
                if debug_mode:
                    eye_frame = frame[y + ey:y + ey + eh, x + ex:x + ex + ew]
                    pupil = detect_pupil(eye_frame)
                    if pupil:
                        cv2.circle(frame, (x + ex + pupil[0], y + ey + pupil[1]), 3, (255, 0, 255), -1)

        cv2.putText(frame, "EYE DETECTION CHECK", (frame_width // 2 - 200, 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 3)

        face_color = (0, 255, 0) if num_faces > 0 else (0, 0, 255)
        face_text = "YES" if num_faces > 0 else "NO"
        cv2.putText(frame, f"Face Detected: {face_text}", (50, 120),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, face_color, 2)
        cv2.circle(frame, (30, 110), 10, face_color, -1)

        if num_eyes >= 2:
            eye_detection_confirmed = True
            cv2.putText(frame, f"Eyes Detected: {num_eyes} (GOOD)", (50, 160),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
            cv2.circle(frame, (30, 150), 10, (0, 255, 0), -1)
            cv2.putText(frame, "Press SPACE to begin calibration", (frame_width // 2 - 250, frame_height - 70),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)
        elif num_eyes == 1:
            eye_detection_confirmed = True
            cv2.putText(frame, f"Eyes Detected: {num_eyes} (PARTIAL)", (50, 160),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
            cv2.circle(frame, (30, 150), 10, (0, 255, 255), -1)
            cv2.putText(frame, "Press SPACE to begin calibration", (frame_width // 2 - 250, frame_height - 70),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 255), 2)
        else:
            eye_detection_confirmed = False
            cv2.putText(frame, "Eyes Detected: 0 (NONE)", (50, 160),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
            cv2.circle(frame, (30, 150), 10, (0, 0, 255), -1)

        cv2.putText(frame, "Press 'q' to quit | 'd' for debug", (frame_width // 2 - 180, frame_height - 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)

    # --- CALIBRATION MODE ---
    elif not calibration_complete:
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (frame_width, frame_height), (0, 0, 0), -1)
        frame = cv2.addWeighted(frame, 0.3, overlay, 0.7, 0)

        if current_calibration_point < len(calibration_targets):
            target = calibration_targets[current_calibration_point]
            
            # Draw target
            cv2.circle(frame, target, 30, (0, 0, 255), -1)
            cv2.circle(frame, target, 35, (255, 255, 255), 3)
            
            # Point labels
            labels = ["CENTER", "TOP-LEFT", "TOP MIDDLE", "TOP-RIGHT", "LEFT-MIDDLE", "RIGHT-MIDDLE","BOTTOM-LEFT", "BOTTOM MIDDLE", "BOTTOM-RIGHT"]
            
            if sample_start_time is None:
                cv2.putText(frame, f"Look at {labels[current_calibration_point]} circle", 
                            (frame_width // 2 - 250, 50),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
                cv2.putText(frame, f"Point {current_calibration_point + 1} of {len(calibration_targets)}", 
                            (frame_width // 2 - 150, 90),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 2)
                cv2.putText(frame, "Press SPACE when ready", (frame_width // 2 - 200, 130),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            else:
                elapsed = time.time() - sample_start_time
                if elapsed < calibration_duration:
                    pupil = get_pupil_positions(frame, gray)
                    if pupil:
                        temp_samples.append(pupil)
                    
                    progress = int((elapsed / calibration_duration) * 100)
                    cv2.putText(frame, f"Collecting... {progress}%", (frame_width // 2 - 150, 150),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                    cv2.putText(frame, f"Samples: {len(temp_samples)}", (frame_width // 2 - 100, 190),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                    cv2.putText(frame, "Keep looking at the circle!", (frame_width // 2 - 180, 230),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
                else:
                    if len(temp_samples) > 5:
                        # Average the samples for this point
                        avg_x = sum(p[0] for p in temp_samples) / len(temp_samples)
                        avg_y = sum(p[1] for p in temp_samples) / len(temp_samples)
                        
                        calibration_pupil_positions.append((avg_x, avg_y))
                        calibration_screen_positions.append(target)
                        
                        print(f"Point {current_calibration_point + 1}: pupil=({avg_x:.3f}, {avg_y:.3f}), screen={target}")
                        
                        current_calibration_point += 1
                        sample_start_time = None
                        temp_samples = []
                    else:
                        cv2.putText(frame, f"Failed - only {len(temp_samples)} samples", 
                                    (frame_width // 2 - 250, frame_height // 2),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
                        cv2.putText(frame, "Press SPACE to retry", (frame_width // 2 - 180, frame_height // 2 + 50),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2)
                        sample_start_time = None
                        temp_samples = []
        else:
            # All calibration points collected
            calibration_complete = True
            calibration_message_time = time.time()
            # Compute linear mapping after calibration for better gaze estimation
            mapping_matrix = compute_linear_mapping(calibration_pupil_positions, calibration_screen_positions)
            if mapping_matrix is not None:
                print("Calibration complete — linear mapping computed")
            else:
                print(f"Calibration complete with {len(calibration_pupil_positions)} points (no linear mapping)")

    # --- TRACKING MODE ---
    else:
        pupil = get_pupil_positions(frame, gray)
        if pupil:
            pupil = smooth_pupil(pupil, prev_pupil, alpha=0.7)
            prev_pupil = pupil

        gaze_pos = estimate_gaze_position(pupil, calibration_pupil_positions,
                                          calibration_screen_positions, frame_width, frame_height, mapping=mapping_matrix)
        current_looking = is_looking_at_screen(gaze_pos, frame_width, frame_height)

        if current_looking:
            if not looking_at_screen:
                focus_start_time = time.time()
                looking_at_screen = True
            elif time.time() - last_focus_check >= 1.0:
                total_focus_time += 1
                last_focus_check = time.time()
        else:
            looking_at_screen = False
            focus_start_time = None

        if current_looking:
            status_text = "FOCUSED"
            status_color = (0, 255, 0)
        else:
            status_text = "NOT FOCUSED"
            status_color = (0, 0, 255)

        cv2.putText(frame, status_text, (60, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, status_color, 2)
        cv2.circle(frame, (30, 30), 15, status_color, -1)
        cv2.putText(frame, f"Total Focus: {total_focus_time}s", (50, 80),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        if looking_at_screen and focus_start_time:
            current_session = int(time.time() - focus_start_time)
            cv2.putText(frame, f"Session: {current_session}s", (50, 110),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        # Debug info
        if debug_mode and gaze_pos:
            cv2.circle(frame, (int(gaze_pos[0]), int(gaze_pos[1])), 10, (255, 0, 255), 2)
            cv2.putText(frame, f"Gaze: ({int(gaze_pos[0])}, {int(gaze_pos[1])})", (50, 150),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 255), 1)
            if pupil:
                cv2.putText(frame, f"Pupil: ({pupil[0]:.3f}, {pupil[1]:.3f})", (50, 170),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            cv2.putText(frame, f"Margin: {int(SCREEN_MARGIN * 100)}%", (50, 190),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)

        cv2.putText(frame, "Press 'r' to recalibrate | 'd' for debug | 'q' to quit", 
                    (frame_width - 500, frame_height - 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)

    # --- CALIBRATION COMPLETE MESSAGE ---
    if calibration_complete and (time.time() - calibration_message_time < 2):
        cv2.putText(frame, "Calibration Complete!", (frame_width // 2 - 200, frame_height // 2),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 3)
        cv2.putText(frame, "Tracking your gaze now", (frame_width // 2 - 180, frame_height // 2 + 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

    cv2.imshow('Screen Focus Tracker', frame)
    key = cv2.waitKey(10) & 0xFF

    # If the OpenCV window was closed by the user, exit cleanly
    try:
        visible = cv2.getWindowProperty('Screen Focus Tracker', cv2.WND_PROP_VISIBLE)
    except Exception:
        visible = -1
    if visible < 1:
        print('Window closed or not visible - exiting')
        break

    # Helpful debug printing so you can see what keycodes are received when the window has focus
    if key != 255:
        try:
            print(f"Key pressed: {key} ({chr(key)})")
        except Exception:
            print(f"Key pressed: {key}")

    # Accept lowercase or uppercase 'q' and ESC (27) to quit
    if key == ord('q') or key == ord('Q') or key == 27:
        break
    elif key == ord(' '):
        if pre_calibration_mode and eye_detection_confirmed:
            pre_calibration_mode = False
            calibration_complete = False
            current_calibration_point = 0
            calibration_pupil_positions = []
            calibration_screen_positions = []
            sample_start_time = None
            temp_samples = []
        elif not calibration_complete and sample_start_time is None and not pre_calibration_mode:
            sample_start_time = time.time()
            temp_samples = []
    elif key == ord('r') or key == ord('R'):
        pre_calibration_mode = True
        eye_detection_confirmed = False
        calibration_complete = False
        current_calibration_point = 0
        calibration_pupil_positions = []
        calibration_screen_positions = []
        sample_start_time = None
        temp_samples = []
        prev_pupil = None
        looking_at_screen = False
        focus_start_time = None
    elif key == ord('d') or key == ord('D'):
        debug_mode = not debug_mode
        print(f"Debug mode: {'ON' if debug_mode else 'OFF'}")
    elif key == ord('+') or key == ord('='):
        SCREEN_MARGIN = min(0.30, SCREEN_MARGIN + 0.02)
        print(f"Margin increased to {int(SCREEN_MARGIN * 100)}%")
    elif key == ord('-') or key == ord('_'):
        SCREEN_MARGIN = max(0.0, SCREEN_MARGIN - 0.02)
        print(f"Margin decreased to {int(SCREEN_MARGIN * 100)}%")

print(f"\nSession Summary:")
print(f"Total focus time: {total_focus_time} seconds")

cap.release()
cv2.destroyAllWindows()