import serial
import time
import cv2
import numpy as np

def read_image_from_arduino(port='/dev/ttyUSB0', baudrate=115200):
    ser = serial.Serial(port, baudrate, timeout=5)
    time.sleep(2)  # Give time for Arduino reset

    ser.write(b"CAPTURE\n")  # Command Arduino to capture and send image

    data = bytearray()
    while True:
        chunk = ser.read(1024)
        if b"EOF" in chunk:
            data += chunk[:chunk.find(b"EOF")]
            break
        data += chunk

    # Convert data to image
    np_arr = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if image is not None:
        cv2.imwrite("static/uploads/frame.jpg", image)
        return True
    return False
