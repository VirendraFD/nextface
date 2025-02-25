import { connectDB } from "@/app/lib/mongodb";
import User from "@/app/models/User";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { generateToken } from "@/app/utils/auth";
import { cookies } from 'next/headers';



export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    await connectDB();

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
    }

    const token = generateToken(user._id, user.email);

      // Create a response with the token
    const response = NextResponse.json({
      message: 'Login Successfully!',
      status: true,
      user: {
        _id: user._id,
        email: user.email,
      },
    });

    
    // Set the token in a cookie or header (optional)
    cookies().set('token', token, {
      httpOnly: true,
      //secure: process.env.NODE_ENV === 'production',
      maxAge: 86400, // 1 day in seconds
    });


    return response;

  } catch (error) {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
