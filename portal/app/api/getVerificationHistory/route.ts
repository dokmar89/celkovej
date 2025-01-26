import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { FIREBASE_FUNCTIONS_BASE_URL } from '@/lib/firebaseConfig';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

export async function POST(request: Request) {
  console.log("API route /api/getVerificationHistory called");
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
    const response = await fetch(`${process.env.FIREBASE_FUNCTIONS_URL}/getVerificationHistory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    const responseData = await response.json();
    console.log("Response from getVerificationHistory function:", responseData);
    if (!response.ok) {
      console.error("Failed to fetch verification history:", responseData);
      return NextResponse.json({ message: 'Failed to fetch verification history', error: responseData.error }, { status: response.status });
    }
    return NextResponse.json(responseData, { status: 200 });
  } catch (error: any) {
    console.error('Error verifying token or fetching verification history:', error);
    return NextResponse.json({ message: 'Failed to verify token or fetch verification history', error: error.message, stack: error.stack }, { status: 500 });
  }
}