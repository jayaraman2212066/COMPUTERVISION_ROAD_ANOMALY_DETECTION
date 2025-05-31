import os
import cv2
import torch
import numpy as np
from flask import Flask, render_template, Response, request, jsonify, send_file
from flask_socketio import SocketIO
from werkzeug.utils import secure_filename
from ultralytics import YOLO
import threading

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins='*')

UPLOAD_FOLDER = 'static/uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Load YOLO model
model_yolo = YOLO(r"D:\WEB PROGRAMMING PROJECT\new_pro\best.pt")
classes = ['pothole', 'crack', 'speed bump']

# ------------------------ Video Upload-Based Detection ------------------------

def generate_frames(video_path):
    cap = cv2.VideoCapture(video_path)
    frame_count = 0

    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break

        results = model_yolo.predict(frame)[0]
        annotated_frame = frame.copy()

        for result in results.boxes:
            x1, y1, x2, y2 = map(int, result.xyxy[0].tolist())
            conf = float(result.conf[0])
            class_id = int(result.cls[0])
            label = classes[class_id] if class_id < len(classes) else 'unknown'
            label_text = f"{label} ({conf:.2f})"

            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(annotated_frame, label_text, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX,
                        0.6, (0, 255, 0), 2)

            socketio.emit('log_update', {
                'message': f"{label} detected with {conf:.2f} confidence"
            })
            socketio.emit('confidence', {
                'frame': frame_count,
                'confidence': round(conf, 2)
            })

        combined = np.hstack((frame, annotated_frame))
        _, buffer = cv2.imencode('.jpg', combined)
        frame_count += 1

        socketio.emit('video_frame', {'image': buffer.tobytes().hex()})

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

    cap.release()

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/upload', methods=['POST'])
def upload():
    if 'video' not in request.files:
        return 'No file part', 400
    file = request.files['video']
    if file.filename == '':
        return 'No selected file', 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    app.config['CURRENT_VIDEO_PATH'] = filepath

    return jsonify({
        'message': 'Upload successful',
        'original_path': f"/static/uploads/{filename}",
        'detected_path': "/video_feed"
    })


@app.route('/video_feed')
def video_feed():
    video_path = app.config.get('CURRENT_VIDEO_PATH')
    return Response(generate_frames(video_path), mimetype='multipart/x-mixed-replace; boundary=frame')

# ------------------------ Real-Time Webcam Detection ------------------------

live_frame = None
camera_active = False

def live_detection():
    global live_frame, camera_active
    cap = cv2.VideoCapture(0)  # Change to USB cam index if needed
    camera_active = True
    while camera_active:
        success, frame = cap.read()
        if not success:
            break

        results = model_yolo.predict(frame)[0]   # to change 
        annotated_frame = frame.copy()

        for result in results.boxes:
            x1, y1, x2, y2 = map(int, result.xyxy[0].tolist())
            conf = float(result.conf[0])
            class_id = int(result.cls[0])
            label = classes[class_id] if class_id < len(classes) else 'unknown'
            label_text = f"{label} ({conf:.2f})"

            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
            cv2.putText(annotated_frame, label_text, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX,
                        0.6, (0, 0, 255), 2)

            socketio.emit('log_update', {'message': f"[LIVE] {label} @ {conf:.2f}"})
            socketio.emit('confidence', {'frame': 'Live', 'confidence': round(conf, 2)})

        _, buffer = cv2.imencode('.jpg', annotated_frame)
        live_frame = buffer.tobytes()

    cap.release()

@app.route('/start_live')
def start_live():
    global camera_active
    if not camera_active:
        threading.Thread(target=live_detection).start()
    return jsonify({"message": "Live detection started."})

@app.route('/stop_live')
def stop_live():
    global camera_active
    camera_active = False
    return jsonify({"message": "Live detection stopped."})

@app.route('/live_feed')
def live_feed():
    def generate():
        while camera_active:
            if live_frame:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + live_frame + b'\r\n')
    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

# ------------------------ Arduino Endpoint  ------------------------

@app.route('/capture-arduino')
def capture_arduino():
    from arduino_stream.read_serial import read_image_from_arduino
    success = read_image_from_arduino()
    if success:
        return send_file('static/uploads/frame.jpg', mimetype='image/jpeg')
    else:
        return "Failed to capture from Arduino", 500

# ------------------------ Main ------------------------

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
