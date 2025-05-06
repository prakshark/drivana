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
let currentFactIndex = 0;
const facts = document.querySelectorAll('.fact');
const FACT_DISPLAY_TIME = 3000; // 3 seconds

// Get DOM elements
const loadingContainer = document.querySelector('.loading-container');
const videoContainer = document.querySelector('.video-container');

function rotateFacts() {
    // Hide current fact
    facts[currentFactIndex].classList.remove('active');
    
    // Move to next fact
    currentFactIndex = (currentFactIndex + 1) % facts.length;
    
    // Show new fact
    facts[currentFactIndex].classList.add('active');
}

// Start rotating facts
const factInterval = setInterval(rotateFacts, FACT_DISPLAY_TIME);

async function setup() {
    try {
        console.log('Starting setup...');
        statusElement = document.getElementById('status');
        statusElement.textContent = 'Loading AI Models...';
        
        // Initialize DOM elements
        video = document.getElementById('video');
        canvas = document.getElementById('canvas');
        ctx = canvas.getContext('2d');
        alarm = document.getElementById('alarm');
        drowsyAlert = document.getElementById('drowsyAlert');
        phoneAlert = document.getElementById('phoneAlert');
        eatingAlert = document.getElementById('eatingAlert');

        // Add click handlers for alert buttons
        document.querySelectorAll('.awake-button').forEach(button => {
            button.addEventListener('click', resetAlerts);
        });

        // Initialize face landmarks detection
        console.log('Loading face landmarks model...');
        statusElement.textContent = 'Loading Face Detection Model...';
        model = await faceLandmarksDetection.createDetector(
            faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
            {
                runtime: 'tfjs',
                refineLandmarks: true
            }
        ).catch(error => {
            console.error('Error loading face landmarks model:', error);
            throw new Error('Failed to load face detection model. Please refresh the page.');
        });
        console.log('Face landmarks model loaded');

        // Initialize handpose
        console.log('Loading handpose model...');
        statusElement.textContent = 'Loading Hand Detection Model...';
        handposeModel = await handpose.load().catch(error => {
            console.error('Error loading handpose model:', error);
            throw new Error('Failed to load hand detection model. Please refresh the page.');
        });
        console.log('Handpose model loaded');

        // Initialize video stream
        console.log('Requesting camera access...');
        statusElement.textContent = 'Requesting Camera Access...';
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            } 
        }).catch(error => {
            console.error('Error accessing camera:', error);
            throw new Error('Camera access denied. Please allow camera access to use this application.');
        });
        video.srcObject = stream;

        // Wait for video to be ready
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Video initialization timed out. Please refresh the page.'));
            }, 10000); // 10 second timeout

            video.onloadedmetadata = () => {
                clearTimeout(timeout);
                console.log('Video metadata loaded');
                resolve();
            };
        });

        // Stop rotating facts
        clearInterval(factInterval);
        
        // Hide loading container and show video
        loadingContainer.classList.add('hidden');
        videoContainer.classList.remove('hidden');
        
        modelReady();
        console.log('Setup completed successfully');

        // Start the detection loop
        requestAnimationFrame(detect);
    } catch (error) {
        console.error('Error during setup:', error);
        statusElement.textContent = `Error: ${error.message}`;
        loadingContainer.querySelector('.loading-text').textContent = error.message;
        clearInterval(factInterval);
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

    // Get key points for phone detection
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const palmCenter = landmarks[0];

    // Calculate distances between fingertips and palm center
    const thumbDistance = Math.hypot(thumbTip[0] - palmCenter[0], thumbTip[1] - palmCenter[1]);
    const indexDistance = Math.hypot(indexTip[0] - palmCenter[0], indexTip[1] - palmCenter[1]);
    const middleDistance = Math.hypot(middleTip[0] - palmCenter[0], middleTip[1] - palmCenter[1]);
    const ringDistance = Math.hypot(ringTip[0] - palmCenter[0], ringTip[1] - palmCenter[1]);
    const pinkyDistance = Math.hypot(pinkyTip[0] - palmCenter[0], pinkyTip[1] - palmCenter[1]);

    // Calculate angles between fingers
    const thumbPinkyAngle = Math.atan2(pinkyTip[1] - thumbTip[1], pinkyTip[0] - thumbTip[0]);
    const thumbIndexAngle = Math.atan2(indexTip[1] - thumbTip[1], indexTip[0] - thumbTip[0]);

    // Phone detection logic:
    // 1. Thumb should be extended (farther from palm)
    // 2. Other fingers should be extended and roughly parallel
    // 3. Fingers should form a roughly rectangular shape
    const isPhoneGesture = 
        thumbDistance > 100 && // Thumb extended
        indexDistance > 120 && // Index finger extended
        middleDistance > 120 && // Middle finger extended
        ringDistance > 120 && // Ring finger extended
        pinkyDistance > 120 && // Pinky finger extended
        Math.abs(indexDistance - middleDistance) < 40 && // Fingers roughly parallel
        Math.abs(middleDistance - ringDistance) < 40 &&
        Math.abs(ringDistance - pinkyDistance) < 40 &&
        Math.abs(thumbPinkyAngle - thumbIndexAngle) < 0.8; // Fingers roughly aligned

    // Eating detection logic:
    // All fingers should be curled towards the palm
    // Calculate average distance of all fingers from palm center
    const avgFingerDistance = (thumbDistance + indexDistance + middleDistance + ringDistance + pinkyDistance) / 5;
    const maxFingerDistance = Math.max(thumbDistance, indexDistance, middleDistance, ringDistance, pinkyDistance);
    
    // Eating is detected when:
    // 1. All fingers are close to palm (average distance < 70)
    // 2. No finger is significantly extended (max distance < 90)
    const isEatingGesture = 
        avgFingerDistance < 70 &&
        maxFingerDistance < 90;

    console.log('Gesture detection:', {
        thumbDistance: thumbDistance.toFixed(1),
        indexDistance: indexDistance.toFixed(1),
        middleDistance: middleDistance.toFixed(1),
        ringDistance: ringDistance.toFixed(1),
        pinkyDistance: pinkyDistance.toFixed(1),
        avgFingerDistance: avgFingerDistance.toFixed(1),
        maxFingerDistance: maxFingerDistance.toFixed(1),
        thumbPinkyAngle: thumbPinkyAngle.toFixed(2),
        thumbIndexAngle: thumbIndexAngle.toFixed(2),
        indexMiddleDiff: Math.abs(indexDistance - middleDistance).toFixed(1),
        middleRingDiff: Math.abs(middleDistance - ringDistance).toFixed(1),
        ringPinkyDiff: Math.abs(ringDistance - pinkyDistance).toFixed(1)
    });

    if (isPhoneGesture) {
        console.log('Phone gesture detected');
        return 'phone';
    } else if (isEatingGesture) {
        console.log('Eating gesture detected');
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
    drowsyAlert.classList.add('active');
    videoContainer.classList.add('alert-active');
    alarm.play();
    statusElement.textContent = 'Drowsiness Detected!';
}

function triggerPhoneAlert() {
    console.log('Triggering phone alert');
    isUsingPhone = true;
    phoneAlert.classList.remove('hidden');
    phoneAlert.classList.add('active');
    videoContainer.classList.add('alert-active');
    alarm.play();
    statusElement.textContent = 'Phone Use Detected!';
}

function triggerEatingAlert() {
    console.log('Triggering eating alert');
    isEating = true;
    eatingAlert.classList.remove('hidden');
    eatingAlert.classList.add('active');
    videoContainer.classList.add('alert-active');
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
    
    drowsyAlert.classList.remove('active');
    phoneAlert.classList.remove('active');
    eatingAlert.classList.remove('active');
    
    videoContainer.classList.remove('alert-active');
    
    alarm.pause();
    alarm.currentTime = 0;
    statusElement.textContent = 'Monitoring for drowsiness, phone use, and eating...';
}

// Start the application
console.log('Starting application...');
setup(); 