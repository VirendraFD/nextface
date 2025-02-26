import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET!;
const secretKey = new TextEncoder().encode(JWT_SECRET); // Convert secret to Uint8Array

// Generate JWT
export const generateToken = async (
  userId: string,
  email: string,
  business_unique_id: string
) => {
  return await new SignJWT({ userId, email, business_unique_id })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1d')
    .sign(secretKey);
};

// Verify JWT
export const verifyToken = async (token: string) => {
  const { payload } = await jwtVerify(token, secretKey);
  return payload; // Returns decoded token data
};

// Verify JWT
export const getToken = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('token');
  return token; // Returns decoded token data
};
