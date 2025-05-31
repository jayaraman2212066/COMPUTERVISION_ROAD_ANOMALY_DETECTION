import os
import cv2
import torch
import time
import numpy as np
from flask import Flask, render_template, Response, request, jsonify, send_file
from flask_socketio import SocketIO
from werkzeug.utils import secure_filename
from ultralytics import YOLO
import threading
from queue import Queue

app = Flask(__name__)
socketio = SocketIO(
    app,
    cors_allowed_origins='*',
    async_mode='threading',  # Use threading for Render
    ping_timeout=60,
    ping_interval=25,
    max_http_buffer_size=1e8
)

UPLOAD_FOLDER = 'static/uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Load YOLOv8 model with optimizations
try:
    model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'best.pt')
    model_yolo = YOLO(model_path)
    model_yolo.fuse()  # Fuse Conv2d + BatchNorm2d layers
    torch.set_num_threads(4)  # Limit CPU threads for better performance
except Exception as e:
    print(f"Error loading model: {e}")
    model_yolo = None

classes = ['pothole', 'crack', 'speed bump']

# Frame processing queue
frame_queue = Queue(maxsize=30)
processed_queue = Queue(maxsize=30)

desired_fps = 30  # Default FPS

def emit_socket_event(event, data):
    try:
        socketio.emit(event, data, namespace='/')
    except Exception as e:
        print(f"Socket emit error: {e}")

def process_frames():
    while True:
        if not frame_queue.empty():
            frame = frame_queue.get()
            if frame is None:
                break

            # Resize frame for faster processing
            resized_frame = cv2.resize(frame, (416, 416))
            frame_rgb = cv2.cvtColor(resized_frame, cv2.COLOR_BGR2RGB)

            # Optimized YOLOv8 inference
            results = model_yolo.predict(
                source=frame_rgb,
                imgsz=416,
                conf=0.3,
                device='cpu',
                verbose=False,
                half=True
            )

            processed_queue.put((resized_frame, results[0]))
        time.sleep(0.001)  # Use time.sleep instead of eventlet.sleep

def generate_frames(video_path):
    cap = cv2.VideoCapture(video_path)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    # Start frame processing thread
    process_thread = threading.Thread(target=process_frames)
    process_thread.daemon = True
    process_thread.start()

    frame_count, log_interval = 0, 5
    prev_time = time.time()
    fps_list = []

    # Frame skipping logic
    video_fps = cap.get(cv2.CAP_PROP_FPS)
    frame_interval = max(1, int(video_fps / desired_fps)) if video_fps > 0 else 1
    frame_idx = 0

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            # Skip frames to match desired FPS
            if frame_idx % frame_interval != 0:
                frame_idx += 1
                continue
            frame_idx += 1

            # Add frame to processing queue
            if not frame_queue.full():
                frame_queue.put(frame)

            # Get processed frame if available
            if not processed_queue.empty():
                resized_frame, results = processed_queue.get()
                annotated_frame = resized_frame.copy()
                detections = results.boxes

                if detections is not None:
                    for det in detections:
                        x1, y1, x2, y2 = map(int, det.xyxy[0].tolist())
                        conf = float(det.conf[0])
                        class_id = int(det.cls[0])
                        label = classes[class_id] if class_id < len(classes) else 'unknown'
                        label_text = f"{label} ({conf:.2f})"

                        cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                        cv2.putText(annotated_frame, label_text, (x1, y1 - 8),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

                        if frame_count % log_interval == 0:
                            emit_socket_event('log_update', {'message': f"{label} detected ({conf:.2f})"})
                            emit_socket_event('confidence', {'frame': frame_count, 'confidence': round(conf, 2)})

                # Calculate and display FPS
                curr_time = time.time()
                fps = 1.0 / (curr_time - prev_time)
                prev_time = curr_time
                fps_list.append(fps)
                if len(fps_list) > 30:
                    fps_list.pop(0)
                avg_fps = sum(fps_list) / len(fps_list)

                # Emit actual FPS to frontend
                emit_socket_event('log_update', {'message': f"Actual FPS: {avg_fps:.1f}"})

                cv2.putText(annotated_frame, f"FPS: {avg_fps:.1f}", (10, 25),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

                # Combine frames
                combined = np.hstack((resized_frame, annotated_frame))

                # Optimized JPEG encoding
                encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 85]
                _, buffer = cv2.imencode('.jpg', combined, encode_param)

                frame_count += 1

                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

            # Control FPS
            time.sleep(1.0 / desired_fps)

    except Exception as e:
        print(f"Error in generate_frames: {e}")
    finally:
        # Cleanup
        frame_queue.put(None)
        process_thread.join()
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

@app.route('/capture-arduino')
def capture_arduino():
    from arduino_stream.read_serial import read_image_from_arduino
    success = read_image_from_arduino()
    if success:
        return send_file('static/uploads/frame.jpg', mimetype='image/jpeg')
    else:
        return "Failed to capture from Arduino", 500

@app.route('/set_fps', methods=['POST'])
def set_fps():
    global desired_fps
    data = request.get_json()
    fps = data.get('fps')
    if isinstance(fps, int) and fps > 0:
        desired_fps = fps
        return jsonify({'success': True, 'fps': desired_fps})
    return jsonify({'success': False, 'error': 'Invalid FPS'}), 400

if __name__ == '__main__':
    # Ensure required directories exist
    os.makedirs('static/uploads', exist_ok=True)
    os.makedirs('templates', exist_ok=True)
    
    port = int(os.environ.get('PORT', 9000))  # Changed from 8080 to 9000
    host = '127.0.0.1'  # Changed from 0.0.0.0 to localhost
    socketio.run(app, host=host, port=port, debug=False)
