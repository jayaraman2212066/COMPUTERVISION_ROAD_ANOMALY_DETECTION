# Road Anomaly Detection System

A real-time road anomaly detection system using YOLOv8 and Flask.

## Features

- Real-time object detection using YOLOv8
- Web-based dashboard for monitoring
- Support for video upload and processing
- Arduino integration for live feed
- WebSocket-based real-time updates
- Confidence score visualization

## Project Structure

```
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── static/               # Static files
│   ├── css/             # CSS styles
│   ├── js/              # JavaScript files
│   └── uploads/         # Upload directory
├── templates/            # HTML templates
└── yolov8n_speedbump_optimized42/  # YOLO model directory
    └── weights/         # Model weights
```

## Deployment on Render

1. Fork this repository to your GitHub account
2. Create a new Web Service on Render
3. Connect your GitHub repository
4. Configure the service:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn --worker-class eventlet -w 1 app:app`
   - Environment Variables:
     - `PYTHON_VERSION`: 3.9.0
     - `PORT`: 10000

## Local Development

1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   venv\Scripts\activate     # Windows
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the application:
   ```bash
   python app.py
   ```

4. Access the application at `http://localhost:9000`

## Dependencies

- Flask 2.3.3
- Flask-SocketIO 5.3.6
- OpenCV 4.8.0.76
- PyTorch 2.0.1
- Ultralytics 8.0.196
- And more (see requirements.txt)

## Model

The system uses a YOLOv8 model optimized for speed bump detection. The model weights are stored in the `yolov8n_speedbump_optimized42/weights` directory.

## License

MIT License 