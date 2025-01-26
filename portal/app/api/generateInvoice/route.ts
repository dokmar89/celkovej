import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { FIREBASE_FUNCTIONS_BASE_URL } from '@/lib/firebaseConfig';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

export async function POST(request: Request) {
  console.log("API route /api/generateInvoice called");
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
    const response = await fetch(`${process.env.FIREBASE_FUNCTIONS_URL}/generateInvoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const responseData = await response.json();
      console.error("Failed to generate invoice:", responseData);
      return NextResponse.json({ message: 'Failed to generate invoice', error: responseData.error }, { status: response.status });
    }
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    headers.set('Content-Disposition', response.headers.get('Content-Disposition') || 'attachment; filename="faktura.pdf"');
    return new NextResponse(buffer, { status: 200, headers });
  } catch (error: any) {
    console.error('Error verifying token or generating invoice:', error);
    return NextResponse.json({ message: 'Failed to verify token or generate invoice', error: error.message, stack: error.stack }, { status: 500 });
  }
}