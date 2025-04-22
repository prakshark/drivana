let model;
let video;
let canvas;
let ctx;
let alarm;
let alertElement;
let statusElement;
let awakeButton;
let isDrowsy = false;
let eyeClosedStartTime = null;
const EYE_CLOSED_THRESHOLD = 3; // seconds
const EYE_ASPECT_RATIO_THRESHOLD = 0.25; // Threshold for eye closure

async function setup() {
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    alarm = document.getElementById('alarm');
    alertElement = document.getElementById('alert');
    statusElement = document.getElementById('status');
    awakeButton = document.getElementById('awakeButton');

    // Add click handler for awake button
    awakeButton.addEventListener('click', resetAlert);

    // Initialize video stream
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;

    // Initialize face landmarks detection
    model = await faceLandmarksDetection.createDetector(
        faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
        {
            runtime: 'tfjs',
            refineLandmarks: true
        }
    );
    modelReady();

    // Start the detection loop
    requestAnimationFrame(detect);
}

function modelReady() {
    statusElement.textContent = 'Model loaded! Monitoring for drowsiness...';
}

function calculateEyeAspectRatio(eyePoints) {
    // Calculate vertical distances
    const vertical1 = Math.hypot(
        eyePoints[1].x - eyePoints[5].x,
        eyePoints[1].y - eyePoints[5].y
    );
    const vertical2 = Math.hypot(
        eyePoints[2].x - eyePoints[4].x,
        eyePoints[2].y - eyePoints[4].y
    );
    
    // Calculate horizontal distance
    const horizontal = Math.hypot(
        eyePoints[0].x - eyePoints[3].x,
        eyePoints[0].y - eyePoints[3].y
    );
    
    // Calculate eye aspect ratio
    return (vertical1 + vertical2) / (2 * horizontal);
}

async function detect() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const predictions = await model.estimateFaces(video);
        
        if (predictions.length > 0) {
            const keypoints = predictions[0].keypoints;
            
            // Get eye landmarks (indices for MediaPipe FaceMesh)
            const leftEye = [
                keypoints[33],  // left eye left corner
                keypoints[160], // left eye top
                keypoints[158], // left eye bottom
                keypoints[133], // left eye right corner
                keypoints[153], // left eye top
                keypoints[144]  // left eye bottom
            ];
            
            const rightEye = [
                keypoints[362], // right eye left corner
                keypoints[385], // right eye top
                keypoints[387], // right eye bottom
                keypoints[263], // right eye right corner
                keypoints[380], // right eye top
                keypoints[373]  // right eye bottom
            ];
            
            // Calculate eye aspect ratios
            const leftEAR = calculateEyeAspectRatio(leftEye);
            const rightEAR = calculateEyeAspectRatio(rightEye);
            const avgEAR = (leftEAR + rightEAR) / 2;
            
            // Check if eyes are closed
            if (avgEAR < EYE_ASPECT_RATIO_THRESHOLD) {
                if (!eyeClosedStartTime) {
                    eyeClosedStartTime = Date.now();
                } else {
                    const eyeClosedDuration = (Date.now() - eyeClosedStartTime) / 1000;
                    if (eyeClosedDuration >= EYE_CLOSED_THRESHOLD && !isDrowsy) {
                        triggerAlert();
                    }
                }
            } else {
                eyeClosedStartTime = null;
            }
        }
    }
    
    requestAnimationFrame(detect);
}

function triggerAlert() {
    isDrowsy = true;
    alertElement.classList.remove('hidden');
    alarm.play();
    statusElement.textContent = 'Drowsiness Detected!';
}

function resetAlert() {
    isDrowsy = false;
    alertElement.classList.add('hidden');
    alarm.pause();
    alarm.currentTime = 0;
    statusElement.textContent = 'Monitoring for drowsiness...';
}

// Start the application
setup(); 