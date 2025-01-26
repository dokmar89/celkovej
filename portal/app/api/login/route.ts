import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(), // Použije automaticky credentials z prostředí
  });
}

export async function POST(request: Request) {
  const { email, password } = await request.json();

  try {
    // 1. Ověření uživatele pomocí Firebase Authentication
    await signInWithEmailAndPassword(auth, email, password);

    // 2. Získání uživatele z databáze (volitelné, pokud potřebuješ další data)
    const userRef = doc(db, 'users', auth.currentUser!.uid);
      const userSnap = await getDoc(userRef);


    if (userSnap.exists()) {
      return NextResponse.json({ message: 'Přihlášení úspěšné', user: userSnap.data()}, { status: 200 });
    } else {
      return NextResponse.json({ message: 'Přihlášení úspěšné, ale uživatel nenalezen v databázi'}, { status: 200 });
      }
  } catch (error: any) {
    return NextResponse.json({ message: 'Neplatné přihlašovací údaje', error: error.message }, { status: 401 });
  }
}