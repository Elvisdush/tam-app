import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  databaseURL: "https://project-tam-58a24-default-rtdb.firebaseio.com"
};

export const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
