/**
 * Firebase project for player accounts (see "Accounts" in the README).
 * These values are public by design: every Firebase website ships them. What protects the data
 * are the Firestore rules in firebase/firestore.rules (each player can only touch their own row).
 * Set FIREBASE_CONFIG to null to turn accounts off; the site then works with device profiles only.
 */
export const FIREBASE_CONFIG: Record<string, string> | null = {
  apiKey: 'AIzaSyAI4ESwN4TammpkAAUNTCdckdPiyvXntBA',
  authDomain: 'game-table-e40ad.firebaseapp.com',
  projectId: 'game-table-e40ad',
  storageBucket: 'game-table-e40ad.firebasestorage.app',
  messagingSenderId: '443161548866',
  appId: '1:443161548866:web:4cd6d42cc0d1453ed275db',
};
