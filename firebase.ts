import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, onSnapshot, addDoc, serverTimestamp, getDocFromServer, updateDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

console.log("Firebase: Initializing app with config", firebaseConfig.projectId);
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

// Validation for connection
async function testConnection() {
  console.log("Firebase: Testing connection to Firestore...");
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase: Connection test complete");
  } catch (error) {
    console.error("Firebase: Connection test failed", error);
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();

export { signInWithPopup, signOut, onAuthStateChanged, collection, doc, setDoc, getDoc, getDocs, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc };
