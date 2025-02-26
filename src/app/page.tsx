import React from 'react';
import FaceDetection from './components/FaceDetection';
import { getToken, verifyToken } from './utils/auth';

export default async function Page() {
  const decode = await getToken();
  const token = decode?.value;
  if (!token) {
    return <div>Unauthenticated</div>;
  }
  const decoded = (await verifyToken(token)) as { business_unique_id: string }; // Type Assertion

  return (
    <div>
      <FaceDetection business_unique_id={decoded.business_unique_id} />
    </div>
  );
}
