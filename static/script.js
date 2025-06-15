// Initialize socket connection with reconnection handling
let socket;
let confidenceChart;

// Initialize everything when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize socket with more robust configuration
    socket = io({
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        transports: ['polling', 'websocket'],
        path: '/socket.io/',
        forceNew: true,
        autoConnect: true,
        upgrade: true,
        rememberUpgrade: true,
        rejectUnauthorized: false
    });

    // Initialize chart
    const ctx = document.getElementById("confidenceChart")?.getContext("2d");
    if (ctx) {
        confidenceChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: [],
                datasets: [{
                    label: "Confidence (%)",
                    borderColor: "blue",
                    backgroundColor: "rgba(0, 123, 255, 0.2)",
                    data: [],
                    fill: true,
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    // Initialize with upload mode
    setVideoMode('upload');

    // Add event listeners
    document.getElementById('uploadBtn').addEventListener('click', uploadVideo);
    document.getElementById('arduinoBtn').addEventListener('click', captureFromArduino);
    const setFPSBtn = document.getElementById('setFPSBtn');
    if (setFPSBtn) {
        setFPSBtn.addEventListener('click', () => {
            const fps = parseInt(document.getElementById('desiredFPS').value, 10);
            if (isNaN(fps) || fps < 1) {
                alert('Please enter a valid FPS (>=1)');
                return;
            }
            fetch('/set_fps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fps })
            })
            .then(res => res.json())
            .then(data => {
                const detectionLog = document.getElementById("detectionLog");
                if (detectionLog) {
                    const p = document.createElement("p");
                    p.innerText = `Desired FPS set to: ${fps}`;
                    detectionLog.appendChild(p);
                    detectionLog.scrollTop = detectionLog.scrollHeight;
                }
            })
            .catch(err => {
                console.error('Failed to set FPS:', err);
                alert('Failed to set FPS. Please try again.');
            });
        });
    }

    // Start FPS monitoring
    updateFPS();

    // Set up socket event handlers
    setupSocketHandlers();

    // Background Slideshow
    const backgroundImages = document.querySelectorAll('.background-slideshow img');
    let currentImageIndex = 0;
    const slideInterval = 5000; // Change image every 5 seconds

    // Set initial active image
    backgroundImages[0].classList.add('active');

    // Function to change background image
    function changeBackground() {
        backgroundImages[currentImageIndex].classList.remove('active');
        currentImageIndex = (currentImageIndex + 1) % backgroundImages.length;
        backgroundImages[currentImageIndex].classList.add('active');
    }

    // Start slideshow
    setInterval(changeBackground, slideInterval);
});

// Socket event handlers setup
function setupSocketHandlers() {
    socket.on('connect', () => {
        console.log('Connected to server');
        updateStatus('Connected to server', 'success');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        updateStatus('Disconnected from server', 'error');
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        updateStatus('Connection error. Retrying...', 'error');
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log('Reconnection attempt:', attemptNumber);
        updateStatus(`Reconnecting... Attempt ${attemptNumber}`, 'warning');
    });

    socket.on('reconnect', (attemptNumber) => {
        console.log('Reconnected after', attemptNumber, 'attempts');
        updateStatus('Reconnected to server', 'success');
    });

    socket.on('reconnect_error', (error) => {
        console.error('Reconnection error:', error);
        updateStatus('Reconnection failed', 'error');
    });

    socket.on('reconnect_failed', () => {
        console.error('Failed to reconnect');
        updateStatus('Failed to reconnect to server', 'error');
    });

    socket.on("log_update", data => {
        const detectionLog = document.getElementById("detectionLog");
        if (detectionLog) {
            const p = document.createElement("p");
            p.innerText = data.message;
            detectionLog.appendChild(p);
            detectionLog.scrollTop = detectionLog.scrollHeight;
        }
    });

    socket.on("confidence", data => {
        if (confidenceChart) {
            confidenceChart.data.labels.push(data.frame);
            confidenceChart.data.datasets[0].data.push(data.confidence);
            confidenceChart.update();
        }
    });
}

// Helper function to update status messages
function updateStatus(message, type = 'info') {
    const statusElement = document.getElementById('uploadStatus');
    if (statusElement) {
        statusElement.innerText = message;
        statusElement.className = `status-message ${type}`;
    }
}

// FPS Monitoring
let frameCount = 0;
let lastTime = performance.now();
let currentFPS = 0;

function updateFPS() {
    frameCount++;
    const currentTime = performance.now();
    const elapsedTime = currentTime - lastTime;

    if (elapsedTime >= 1000) {
        currentFPS = Math.round((frameCount * 1000) / elapsedTime);
        document.getElementById('currentFPS').innerText = currentFPS;
        frameCount = 0;
        lastTime = currentTime;
    }
    requestAnimationFrame(updateFPS);
}

// Video Mode States
let currentMode = 'none'; // 'none', 'upload', 'realtime'

function setVideoMode(mode) {
    const uploadBtn = document.getElementById('uploadBtn');
    const arduinoBtn = document.getElementById('arduinoBtn');
    const uploadSection = document.getElementById('upload-section');
    const arduinoSection = document.getElementById('arduino-section');

    // Reset all buttons
    uploadBtn.classList.remove('active');
    arduinoBtn.classList.remove('active');

    // Update current mode
    currentMode = mode;

    switch(mode) {
        case 'upload':
            uploadBtn.classList.add('active');
            uploadSection.style.display = 'block';
            arduinoSection.style.display = 'none';
            break;
        case 'realtime':
            arduinoBtn.classList.add('active');
            uploadSection.style.display = 'none';
            arduinoSection.style.display = 'block';
            break;
        default:
            uploadSection.style.display = 'block';
            arduinoSection.style.display = 'none';
    }
}

// Video upload function
function uploadVideo() {
    const input = document.getElementById("videoInput");
    const uploadStatus = document.getElementById("uploadStatus");
    const originalVideo = document.getElementById("originalVideo");
    const processedImage = document.getElementById("processedImage");

    if (!input || !uploadStatus) {
        console.error("Required elements not found");
        return;
    }

    const file = input.files[0];
    if (!file) {
        alert("Please select a video file first.");
        return;
    }

    setVideoMode('upload');
    const formData = new FormData();
    formData.append("video", file);
    uploadStatus.innerText = "Uploading and processing...";

    fetch("/upload", {
        method: "POST",
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.original_path && data.detected_path) {
            if (originalVideo) {
                originalVideo.src = data.original_path + '?t=' + new Date().getTime();
                originalVideo.onloadeddata = () => {
                    originalVideo.play();
                };
            }

            if (processedImage) {
                processedImage.src = data.detected_path + '?t=' + new Date().getTime();
            }

            uploadStatus.innerText = "Detection in progress...";
        } else {
            uploadStatus.innerText = "Upload failed.";
        }
    })
    .catch(err => {
        console.error("Upload error:", err);
        uploadStatus.innerText = "Error: " + err.message;
    });
}

// Arduino capture function
function captureFromArduino() {
    setVideoMode('realtime');
    const arduinoStatus = document.getElementById('arduino-status');
    arduinoStatus.innerText = "Connecting to Arduino...";

    fetch("/start_arduino", {
        method: "POST"
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            arduinoStatus.innerText = "Connected to Arduino. Processing video...";
            const liveOriginal = document.getElementById('liveOriginal');
            const liveDetection = document.getElementById('liveDetection');
            
            if (liveOriginal) {
                liveOriginal.src = '/video_feed?t=' + new Date().getTime();
            }
            if (liveDetection) {
                liveDetection.src = '/detection_feed?t=' + new Date().getTime();
            }
        } else {
            arduinoStatus.innerText = "Failed to connect to Arduino.";
        }
    })
    .catch(err => {
        console.error("Arduino connection error:", err);
        arduinoStatus.innerText = "Error: " + err.message;
    });
}

// Make functions globally accessible
window.uploadVideo = uploadVideo;
window.captureFromArduino = captureFromArduino; 