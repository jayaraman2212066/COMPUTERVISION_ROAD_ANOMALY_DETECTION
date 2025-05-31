from ultralytics import YOLO
import os

def test_yolov8_model(model_path, test_images_path, save_dir, device=0):
    """
    Runs inference on test images using a trained YOLOv8 model (on GPU if available).
    """
    # Load your trained model
    model = YOLO(model_path)

    # Run prediction
    
    results = model.predict(
        source=test_images_path,   # Folder with test images
        imgsz=640,                 # Inference image size
        save=True,                 # Save prediction images with bounding boxes
        save_txt=True,             # Save YOLO-format text results
        project=save_dir,          # Where to save results
        name='inference_results',  # Sub-folder name
        device=device              # <<< 0 = GPU:0, 'cpu' = CPU only
    )

    print(f"✅ Inference complete — results saved to {os.path.join(save_dir, 'inference_results')}")

# ====== CONFIGURATION ======
model_path       = r"D:\WEB PROGRAMMING PROJECT\new_pro\yourproject\runs\runs\detect\yolov8n_speedbump_optimized42\weights\last.pt"
test_images_path = r"D:\WEB PROGRAMMING PROJECT\new_pro\test_dataset\test"
save_dir         = "runs/detect"
device           = 0  # <<<<<<<< GPU:0 (set 'cpu' for CPU-only)

# ====== RUN TEST ======
test_yolov8_model(model_path, test_images_path, save_dir, device)
