# Drivana - Driver Drowsiness Detection System

Drivana is a web-based application that uses ML5.js and computer vision to detect drowsiness or sleepiness in real-time. It monitors head movements and triggers an alert when signs of drowsiness are detected.

## Features

- Real-time face detection using ML5.js Facemesh
- Drowsiness detection based on head tilt
- Mobile Usage Detection
- Eating Detection
- Visual and audio alerts when drowsiness, Eating, or Mobile Usage is detected
- Modern and responsive UI
- Works in any modern web browser

## How to Use

1. Open `index.html` in a modern web browser (Chrome recommended)
2. Allow camera access when prompted
3. Position yourself in front of the camera
4. The system will automatically start monitoring for signs of drowsiness
5. When drowsiness is detected, a red alert will appear and an alarm sound will play

## Technical Details

- Uses ML5.js Facemesh for facial landmark detection
- Monitors head tilt angle to detect drowsiness
- Implements a threshold system to prevent false positives
- Uses the browser's Web Audio API for sound alerts

## Requirements

- Modern web browser with WebRTC support
- Camera access
- Internet connection (for loading ML5.js)

## Note

This application is for demonstration purposes and should not be solely relied upon for critical safety applications. Always ensure proper rest and take breaks when feeling drowsy. 
