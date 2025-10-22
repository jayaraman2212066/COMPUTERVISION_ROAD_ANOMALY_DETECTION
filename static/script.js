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
                    borderColor: "#3b82f6",
                    backgroundColor: "rgba(59, 130, 246, 0.2)",
                    pointBackgroundColor: "#60a5fa",
                    pointBorderColor: "#3b82f6",
                    pointHoverBackgroundColor: "#ffffff",
                    pointHoverBorderColor: "#3b82f6",
                    data: [],
                    fill: true,
                    tension: 0.4
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
            const fpsElement = document.getElementById('desiredFPS');
            if (!fpsElement) {
                console.error('FPS input element not found');
                return;
            }
            const fps = parseInt(fpsElement.value, 10);
            if (isNaN(fps) || fps < 1) {
                updateStatus('Please enter a valid FPS (>=1)', 'error');
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

    // Dynamic background switching
    setupDynamicBackground();
    
    // Add click handlers for navigation
    document.querySelectorAll('.sidebar nav ul li a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const href = link.getAttribute('href');
            switchToSection(href.replace('#', ''));
        });
    });
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

    // Null checks for safety
    if (!uploadBtn || !arduinoBtn || !uploadSection || !arduinoSection) {
        console.error('Required elements not found for setVideoMode');
        return;
    }

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
        updateStatus('Please select a video file first.', 'warning');
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

// Dynamic Background Management with Enhanced Effects
function setupDynamicBackground() {
    const backgrounds = ['upload', 'arduino', 'analytics', 'default'];
    let currentBgIndex = 0;
    
    // Auto-cycle through all backgrounds every minute (60 seconds)
    setInterval(() => {
        switchBackground(backgrounds[currentBgIndex]);
        currentBgIndex = (currentBgIndex + 1) % backgrounds.length;
    }, 60000);
    
    // Initialize with first background
    switchBackground(backgrounds[0]);
    
    // Add floating particles effect
    createFloatingParticles();
    
    // Add dynamic glow effects
    addDynamicGlowEffects();
}

// Create floating particles for enhanced visual appeal
function createFloatingParticles() {
    const particleContainer = document.createElement('div');
    particleContainer.className = 'particle-container';
    particleContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: -2;
        overflow: hidden;
    `;
    
    // Create 20 floating particles
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'floating-particle';
        particle.style.cssText = `
            position: absolute;
            width: ${Math.random() * 4 + 2}px;
            height: ${Math.random() * 4 + 2}px;
            background: rgba(59, 130, 246, ${Math.random() * 0.3 + 0.1});
            border-radius: 50%;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation: floatParticle ${Math.random() * 20 + 15}s linear infinite;
            box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
        `;
        particleContainer.appendChild(particle);
    }
    
    document.body.appendChild(particleContainer);
    
    // Add CSS animation for particles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes floatParticle {
            0% {
                transform: translateY(100vh) translateX(0px) rotate(0deg);
                opacity: 0;
            }
            10% {
                opacity: 1;
            }
            90% {
                opacity: 1;
            }
            100% {
                transform: translateY(-100px) translateX(${Math.random() * 200 - 100}px) rotate(360deg);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// Add dynamic glow effects to interactive elements
function addDynamicGlowEffects() {
    // Add hover glow to buttons
    document.querySelectorAll('.primary-button').forEach(button => {
        button.addEventListener('mouseenter', () => {
            button.style.boxShadow = '0 0 30px rgba(59, 130, 246, 0.8), 0 0 60px rgba(59, 130, 246, 0.4)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.boxShadow = '';
        });
    });
    
    // Add pulse effect to active elements
    setInterval(() => {
        document.querySelectorAll('.stat-value').forEach(stat => {
            stat.style.transform = 'scale(1.05)';
            setTimeout(() => {
                stat.style.transform = 'scale(1)';
            }, 200);
        });
    }, 3000);
}

function switchBackground(type) {
    const backgrounds = document.querySelectorAll('.bg-image');
    backgrounds.forEach(bg => bg.classList.remove('active'));
    
    const targetBg = document.getElementById(type + 'Bg') || document.getElementById('defaultBg');
    if (targetBg) {
        targetBg.classList.add('active');
    }
}

function switchToSection(sectionId) {
    // Remove active class from all sections
    document.querySelectorAll('.dashboard-section').forEach(section => {
        section.classList.remove('active-section');
    });
    
    // Remove active class from all nav items
    document.querySelectorAll('.sidebar nav ul li').forEach(li => {
        li.classList.remove('active');
    });
    
    // Add active class to target section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active-section');
        
        // Add active class to corresponding nav item
        const navLink = document.querySelector(`a[href="#${sectionId}"]`);
        if (navLink) {
            navLink.parentElement.classList.add('active');
        }
        
        // Switch background based on section
        switch(sectionId) {
            case 'upload-section':
                switchBackground('upload');
                break;
            case 'arduino-section':
                switchBackground('arduino');
                break;
            case 'analytics-section':
                switchBackground('analytics');
                break;
            default:
                switchBackground('default');
        }
    }
}

// Enhanced visual feedback for user interactions
function addInteractionFeedback() {
    // Add ripple effect to buttons
    document.querySelectorAll('.primary-button').forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                left: ${x}px;
                top: ${y}px;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                transform: scale(0);
                animation: ripple 0.6s linear;
                pointer-events: none;
            `;
            
            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
    
    // Add CSS for ripple animation
    const rippleStyle = document.createElement('style');
    rippleStyle.textContent = `
        @keyframes ripple {
            to {
                transform: scale(2);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(rippleStyle);
}

// Initialize interaction feedback when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(addInteractionFeedback, 1000);
});

// Make functions globally accessible
window.uploadVideo = uploadVideo;
window.captureFromArduino = captureFromArduino;
window.switchToSection = switchToSection; 