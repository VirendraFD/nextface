'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import * as faceapi from 'face-api.js';


interface Employee {
  employeeId: string;
  name: string;
  designation: string;
  department: string;
  email: string;
  phone: string;
  address: string;
  attendance_status: boolean;
  attendance_message: string;
}

interface FaceDetectionProps {
  business_unique_id: string;
}

export default function FaceDetection({
  business_unique_id,
}: FaceDetectionProps) {
  const webcamRef = useRef<Webcam | null>(null);
  const [uploadResultMessage, setUploadResultMessage] = useState('Please look at the camera');
  const [isAuth, setAuth] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [prevFace, setPrevFace] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const loadModels = async () => {
      await faceapi.tf.setBackend('webgl');
      await faceapi.tf.ready();
      

      try {
        // Load all required models
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/face-api/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/face-api/models'), // Load Face Landmark model
        faceapi.nets.faceExpressionNet.loadFromUri('/face-api/models'), // Load Face Expression model (optional)
        faceapi.nets.ssdMobilenetv1.loadFromUri('/face-api/models') // Load SSD MobileNet model (optional for better accuracy)
      ]);
        console.log('Face API models loaded successfully');
      } catch (error) {
        console.error('Failed to load models:', error);
        setUploadResultMessage('Error loading face detection models.');
      }
    };

    loadModels();
  }, []);

  const captureAndSendImage = useCallback(async () => {
    if (!webcamRef.current) return;

    const video = webcamRef.current.video;
    if (!video || video.readyState !== 4) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) return;

      const faceDetected = await detectFaceLocally(blob);
      
      if (!faceDetected) {
        setUploadResultMessage('No face detected. Please adjust your position.');
        setAuth(false);
        return;
      }

      const faceLive = await detectLiveness(blob);
      console.log('faceLive: ',faceLive);
      if(!faceLive){
        setUploadResultMessage('Liveness check failed. Blink to verify.');
        setAuth(false);
        return;
      }else{
        setUploadResultMessage('Liveness check success.');
      }

      const visitorImageName = uuidv4();

      try {
        setUploadResultMessage('Uploading image for verification...');

        await fetch(`https://iti80r2th2.execute-api.us-east-1.amazonaws.com/dev/fixhr-visitor-images/${visitorImageName}.jpg`, {
          method: 'PUT',
          headers: { 'Content-Type': 'image/jpeg' },
          body: blob,
        });

        const response = await authenticate(visitorImageName);
        console.log('AWS response:', response);

        if (response?.Message === 'Success') {
          try {
            const { data: employeeData } = await axios.get(
              `https://web.fixhr.app/api/face-detection/employee/${response.FaceId}`
            );

            if (employeeData.status) {
              if (employeeData.data.attendance_status) {
                setAuth(true);
                setEmployee(employeeData.data);
                setUploadResultMessage(
                  `Welcome ${employeeData.data.name}, ${employeeData.data.attendance_message}`
                );
                speakMessage(
                  `Welcome, ${employeeData.data.name}. ${employeeData.data.attendance_message}`
                );
              } else {
                setUploadResultMessage(
                  `Hi ${employeeData.data.name}, ${employeeData.data.attendance_message}`
                );
                speakMessage(
                  `Hi, ${employeeData.data.name}. ${employeeData.data.attendance_message}`
                );
              }
              setTimeout(() => setAuth(false), 10000);
            } else {
              setUploadResultMessage('Employee not found.');
              setAuth(false);
            }
          } catch (error) {
            console.error('Error calling Laravel API:', error);
            setUploadResultMessage('Error fetching employee details.');
          }
        } else {
          setUploadResultMessage('Authentication failed. Please try again.');
          setAuth(false);
        }
      } catch (error) {
        console.error('Error uploading or authenticating:', error);
        setUploadResultMessage('Error processing image. Please try again.');
      }
    }, 'image/jpeg');
  }, []);


  // Function to convert text to speech
  const speakMessage = (message: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = 'en-US';
      utterance.rate = 1; // Adjust speed (1 is normal speed)
      utterance.pitch = 1; // Adjust pitch (1 is normal pitch)
      speechSynthesis.speak(utterance);
    } else {
      console.warn('Web Speech API is not supported in this browser.');
    }
  };

  const detectFaceLocally = async (imageBlob: Blob) => {
    const image = await blobToImage(imageBlob);
    const detections = await faceapi.detectAllFaces(image, new faceapi.TinyFaceDetectorOptions({
      inputSize: 128,
      scoreThreshold: 0.5,
    }));

    return detections.length > 0;
  };

  let lastBlinkTime = 0; // Store last blink timestamp
  const BLINK_DELAY = 2000; // Minimum delay for detecting a blink (2 sec)

  const detectLiveness = async (imageBlob: Blob) => {
    const image = await blobToImage(imageBlob);
    
    // Detect face with landmarks
    const detections = await faceapi.detectSingleFace(image, new faceapi.TinyFaceDetectorOptions({
      inputSize: 96,
      scoreThreshold: 0.5
    })).withFaceLandmarks();

    if (!detections) {
      return false; // No face detected
    }

    // Get eye positions
    const leftEye = detections.landmarks.getLeftEye();
    const rightEye = detections.landmarks.getRightEye();

    // Check if eyes are open
    const isLeftEyeOpen = checkEyeOpen(leftEye);
    const isRightEyeOpen = checkEyeOpen(rightEye);
    
    if (!isLeftEyeOpen && !isRightEyeOpen) {
      // Blink detected when both eyes are closed
      lastBlinkTime = Date.now();
      return false; // Wait for eye re-opening
    }

    if (isLeftEyeOpen && isRightEyeOpen) {
      if (lastBlinkTime > 0 && Date.now() - lastBlinkTime >= BLINK_DELAY) {
         return true; // Liveness verified after a proper blink
         //return checkHeadMovement; 
      }
    }

    return false; // Not enough proof of liveness yet
  };

  
  // Function to check eye openness based on landmark distances
  const checkEyeOpen = (eye: any) => {
    const verticalDistance = Math.abs(eye[1].y - eye[5].y);
    const horizontalDistance = Math.abs(eye[0].x - eye[3].x);
    return verticalDistance / horizontalDistance > 0.25; // Threshold for eye openness
  };

  const checkHeadMovement = (detections: any) => {
    if (!prevFace) {
      setPrevFace(detections.detection.box);
      // return false;
      return checkHeadMovement(detections);
    }

    const movement = Math.abs(detections.detection.box.x - prevFace.x) + 
                     Math.abs(detections.detection.box.y - prevFace.y);

    setPrevFace(detections.detection.box);

    return movement > 10; // Ensure the user moved
  };



  async function authenticate(visitorImageName: string) {
    try {
      const response = await fetch(
        `https://iti80r2th2.execute-api.us-east-1.amazonaws.com/dev/employee?objectKey=${visitorImageName}.jpg`,
        { method: 'GET', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' } }
      );
      return await response.json();
    } catch (error) {
      console.error('Error:', error);
      return null;
    }
  }

  const blobToImage = (blob: Blob): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
  };

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const startCapture = async () => {
      await captureAndSendImage();
      timeout = setTimeout(startCapture, 5000); // Recapture every 4 seconds
    };

    startCapture();

    return () => clearTimeout(timeout);
  }, [captureAndSendImage]);

  return (
    <div className="flex items-start justify-center min-h-screen p-8 bg-gray-100">
      <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-4xl grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex flex-col items-center sm:items-start sm:col-span-2">
          <div className="w-450 h-150 rounded-xl overflow-hidden">
            <Webcam ref={webcamRef} screenshotFormat="image/jpeg" className="webcam" />
          </div>
        </div>

        <div className="sm:col-span-1 flex flex-col justify-center">
          <h3
            className={`text-lg font-semibold mb-2 ${
              isAuth ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {uploadResultMessage}
          </h3>

          {isAuth && employee && (
            <>
              <h2 className="text-2xl font-bold text-gray-800">
                <span>{employee?.employeeId} -</span> {employee?.name}
              </h2>
              <p className="text-sm text-gray-500 mb-4">{employee?.designation}</p>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Department</p>
                  <p className="text-base text-gray-900">{employee?.department}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Email</p>
                  <p className="text-base text-gray-900">{employee?.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Phone</p>
                  <p className="text-base text-gray-900">{employee?.phone}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Location</p>
                  <p className="text-base text-gray-900">{employee?.address}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}