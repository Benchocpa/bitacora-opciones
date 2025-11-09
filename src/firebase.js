// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBFps3GRnLyumFb9d1gTX-YqCePgNaxa3s",
  authDomain: "bitacora-ef9b5.firebaseapp.com",
  projectId: "bitacora-ef9b5",
  storageBucket: "bitacora-ef9b5.appspot.com", // 👈 CAMBIO AQUÍ
  messagingSenderId: "313158303573",
  appId: "1:313158303573:web:748f5f7827db70bd5d39dc",
  measurementId: "G-HL3KCZPGCN"
};

// Inicializa la app
const app = initializeApp(firebaseConfig);

// Inicializa Firestore
export const db = getFirestore(app);

// Mensaje de prueba en consola
console.log("🔥 Firestore conectado:", db);
console.log("Proyecto:", app.options.projectId);

