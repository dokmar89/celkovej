import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { auth } from '@/lib/firebase';
import * as admin from 'firebase-admin';

export async function POST(request: Request) {
  const authorizationHeader = request.headers.get('Authorization');
  if (!authorizationHeader) {
    return NextResponse.json({ message: 'Authorization header is missing' }, { status: 401 });
  }

  const token = authorizationHeader.split(' ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    if (!decodedToken) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }
      const { uid } = await request.json();
      const response = await fetch(`${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL}/getUserData`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({ data: { uid } })
      });
      const data = await response.json();
       if(!response.ok) {
        return NextResponse.json({ message: 'Failed to fetch user data from function', error: data.error }, { status: 500 });
      }
      return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error('Error verifying token:', error);
    return NextResponse.json({ message: 'Failed to verify token', error: error.message }, { status: 401 });
  }
}