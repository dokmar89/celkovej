import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function POST(request: Request) {
  console.log("API route /api/verify called");
  const { id } = await request.json();
  console.log("Verification ID:", id);

  try {
    const docRef = doc(db, "qrVerifications", id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      console.log("Verification found:", docSnap.data());
      return NextResponse.json({ message: 'Verification found', status: docSnap.data().status }, { status: 200 });
    } else {
      console.log("Verification not found");
      return NextResponse.json({ message: 'Verification not found' }, { status: 404 });
    }
  } catch (error: any) {
    console.error('Error fetching verification:', error);
    return NextResponse.json({ message: 'Error fetching verification', error: error.message }, { status: 500 });
  }
}