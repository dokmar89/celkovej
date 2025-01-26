import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { FIREBASE_FUNCTIONS_BASE_URL } from '@/lib/firebaseConfig';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

export async function POST(request: Request) {
  console.log("API route /api/createSupportTicket called");
  const authorizationHeader = request.headers.get('Authorization');
  if (!authorizationHeader) {
    return NextResponse.json({ message: 'Authorization header is missing' }, { status: 401 });
  }

  const token = authorizationHeader.split(' ')[1];
  console.log("Token:", token);

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    console.log("Decoded token:", decodedToken);
    if (!decodedToken) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }
    const data = await request.json();
    console.log("Data:", data);
    const response = await fetch(`${process.env.FIREBASE_FUNCTIONS_URL}/createSupportTicket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data })
    });
    const responseData = await response.json();
    console.log("Response from createSupportTicket function:", responseData);
    if (!response.ok) {
      console.error("Failed to create support ticket:", responseData);
      return NextResponse.json({ message: 'Failed to create support ticket', error: responseData.error }, { status: response.status });
    }
    return NextResponse.json(responseData, { status: 201 });
  } catch (error: any) {
    console.error('Error verifying token or creating support ticket:', error);
    return NextResponse.json({ message: 'Failed to verify token or create support ticket', error: error.message, stack: error.stack }, { status: 500 });
  }
}