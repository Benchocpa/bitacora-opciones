import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBFps3GRnlyumFb9d1gTX-YqCePgNaxa3s",
  authDomain: "bitacora-ef9b5.firebaseapp.com",
  projectId: "bitacora-ef9b5",
  storageBucket: "bitacora-ef9b5.firebasestorage.app",
  messagingSenderId: "313158303573",
  appId: "1:313158303573:web:748f5f7827db70bd5d39dc",
  measurementId: "G-HL3KCZPGCN"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
