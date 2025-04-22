let model;
let handposeModel;
let video;
let canvas;
let ctx;
let alarm;
let drowsyAlert;
let phoneAlert;
let eatingAlert;
let statusElement;
let isDrowsy = false;
let isUsingPhone = false;
let isEating = false;
let eyeClosedStartTime = null;
const EYE_CLOSED_THRESHOLD = 3; // seconds
const EYE_ASPECT_RATIO_THRESHOLD = 0.25; // Threshold for eye closure
const HAND_NEAR_FACE_THRESHOLD = 150; // pixels

async function setup() {
    try {
        console.log('Starting setup...');
        
        // Initialize DOM elements
        video = document.getElementById('video');
        canvas = document.getElementById('canvas');
        ctx = canvas.getContext('2d');
        alarm = document.getElementById('alarm');
        drowsyAlert = document.getElementById('drowsyAlert');
        phoneAlert = document.getElementById('phoneAlert');
        eatingAlert = document.getElementById('eatingAlert');
        statusElement = document.getElementById('status');

        console.log('DOM elements initialized');

        // Add click handlers for alert buttons
        document.querySelectorAll('.awake-button').forEach(button => {
            button.addEventListener('click', resetAlerts);
        });
        console.log('Button event listeners added');

        // Initialize video stream
        console.log('Requesting camera access...');
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        console.log('Camera access granted');

        // Wait for video to be ready
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                console.log('Video metadata loaded');
                resolve();
            };
        });

        // Initialize face landmarks detection
        console.log('Loading face landmarks model...');
        model = await faceLandmarksDetection.createDetector(
            faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
            {
                runtime: 'tfjs',
                refineLandmarks: true
            }
        );
        console.log('Face landmarks model loaded');

        // Initialize handpose
        console.log('Loading handpose model...');
        handposeModel = await handpose.load();
        console.log('Handpose model loaded');

        modelReady();
        console.log('Setup completed successfully');

        // Start the detection loop
        requestAnimationFrame(detect);
    } catch (error) {
        console.error('Error during setup:', error);
        statusElement.textContent = `Error: ${error.message}`;
    }
}

function modelReady() {
    console.log('All models are ready');
    statusElement.textContent = 'Model loaded! Monitoring for drowsiness, phone use, and eating...';
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

function isHandNearFace(hand, face) {
    if (!hand || !face || !hand.landmarks || !face.keypoints) return false;
    
    // Calculate hand center using landmarks
    const handLandmarks = hand.landmarks;
    const handCenter = {
        x: handLandmarks.reduce((sum, point) => sum + point[0], 0) / handLandmarks.length,
        y: handLandmarks.reduce((sum, point) => sum + point[1], 0) / handLandmarks.length
    };

    // Calculate face center using keypoints
    const faceKeypoints = face.keypoints;
    const faceCenter = {
        x: faceKeypoints.reduce((sum, point) => sum + point.x, 0) / faceKeypoints.length,
        y: faceKeypoints.reduce((sum, point) => sum + point.y, 0) / faceKeypoints.length
    };

    const distance = Math.hypot(
        handCenter.x - faceCenter.x,
        handCenter.y - faceCenter.y
    );

    console.log(`Hand-Face distance: ${distance.toFixed(1)} pixels`);
    return distance < HAND_NEAR_FACE_THRESHOLD;
}

function detectHandGesture(hand) {
    if (!hand || !hand.landmarks) return null;

    const landmarks = hand.landmarks;

    // Check for phone-like gesture (thumb and pinky extended)
    const thumbTip = landmarks[4];
    const pinkyTipPhone = landmarks[20];
    const thumbPinkyDistance = Math.hypot(
        thumbTip[0] - pinkyTipPhone[0],
        thumbTip[1] - pinkyTipPhone[1]
    );

    // Check for eating gesture (fingers curled)
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTipEating = landmarks[20];
    const palmCenter = landmarks[0];

    const fingersCurled = [indexTip, middleTip, ringTip, pinkyTipEating].every(tip => {
        return Math.hypot(tip[0] - palmCenter[0], tip[1] - palmCenter[1]) < 100;
    });

    console.log(`Thumb-Pinky distance: ${thumbPinkyDistance.toFixed(1)}`);
    console.log(`Fingers curled: ${fingersCurled}`);

    if (thumbPinkyDistance > 150) {
        return 'phone';
    } else if (fingersCurled) {
        return 'eating';
    }
    return null;
}

async function detect() {
    try {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            // Detect faces
            const predictions = await model.estimateFaces(video);
            console.log(`Detected ${predictions.length} faces`);
            
            // Detect hands
            const hands = await handposeModel.estimateHands(video);
            console.log(`Detected ${hands.length} hands`);
            
            if (predictions.length > 0) {
                const face = predictions[0];
                const keypoints = face.keypoints;
                console.log('Face keypoints:', keypoints);
                
                // Get eye landmarks
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
                console.log(`Eye Aspect Ratio: ${avgEAR.toFixed(2)}`);
                
                // Check for drowsiness
                if (avgEAR < EYE_ASPECT_RATIO_THRESHOLD) {
                    if (!eyeClosedStartTime) {
                        eyeClosedStartTime = Date.now();
                        console.log('Eyes closed, starting timer');
                    } else {
                        const eyeClosedDuration = (Date.now() - eyeClosedStartTime) / 1000;
                        console.log(`Eyes closed for ${eyeClosedDuration.toFixed(1)} seconds`);
                        if (eyeClosedDuration >= EYE_CLOSED_THRESHOLD && !isDrowsy) {
                            triggerDrowsyAlert();
                        }
                    }
                } else {
                    if (eyeClosedStartTime) {
                        console.log('Eyes opened');
                    }
                    eyeClosedStartTime = null;
                }

                // Check for phone use and eating
                if (hands.length > 0) {
                    const hand = hands[0];
                    console.log('Hand landmarks:', hand.landmarks);
                    if (isHandNearFace(hand, face)) {
                        console.log('Hand detected near face');
                        const gesture = detectHandGesture(hand);
                        if (gesture === 'phone' && !isUsingPhone) {
                            console.log('Phone use detected');
                            triggerPhoneAlert();
                        } else if (gesture === 'eating' && !isEating) {
                            console.log('Eating detected');
                            triggerEatingAlert();
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error in detection loop:', error);
        console.error('Error details:', error.stack);
    }
    
    requestAnimationFrame(detect);
}

function triggerDrowsyAlert() {
    console.log('Triggering drowsy alert');
    isDrowsy = true;
    drowsyAlert.classList.remove('hidden');
    alarm.play();
    statusElement.textContent = 'Drowsiness Detected!';
}

function triggerPhoneAlert() {
    console.log('Triggering phone alert');
    isUsingPhone = true;
    phoneAlert.classList.remove('hidden');
    alarm.play();
    statusElement.textContent = 'Phone Use Detected!';
}

function triggerEatingAlert() {
    console.log('Triggering eating alert');
    isEating = true;
    eatingAlert.classList.remove('hidden');
    alarm.play();
    statusElement.textContent = 'Eating Detected!';
}

function resetAlerts() {
    console.log('Resetting all alerts');
    isDrowsy = false;
    isUsingPhone = false;
    isEating = false;
    
    drowsyAlert.classList.add('hidden');
    phoneAlert.classList.add('hidden');
    eatingAlert.classList.add('hidden');
    
    alarm.pause();
    alarm.currentTime = 0;
    statusElement.textContent = 'Monitoring for drowsiness, phone use, and eating...';
}

// Start the application
console.log('Starting application...');
setup(); 