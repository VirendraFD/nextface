// middleware.ts (or middleware.js)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './app/utils/auth';

// Define public routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/signup'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for public routes
  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  // Get the token from cookies or headers
  const token =
    request.cookies.get('token')?.value ||
    request.headers.get('Authorization')?.split(' ')[1];

  if (!token) {
    // Redirect to login if no token is found
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // Verify the token

    // Continue to the requested route
    return NextResponse.next();
  } catch (error) {
    console.log('here is problem', error);
    // Redirect to login if the token is invalid
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

// Define the routes to apply the middleware
export const config = {
  matcher: ['/'],
};
