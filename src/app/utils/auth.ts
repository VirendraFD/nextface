import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET!;
const secretKey = new TextEncoder().encode(JWT_SECRET); // Convert secret to Uint8Array

// Generate JWT
export const generateToken = async (userId: string, email: string) => {
  return await new SignJWT({ userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1d')
    .sign(secretKey);
};

// Verify JWT
export const verifyToken = async (token: string) => {
  const { payload } = await jwtVerify(token, secretKey);
  return payload; // Returns decoded token data
};