import { useState } from 'react';
import SetupScreen from './screens/SetupScreen';
import AnnotationScreen from './screens/AnnotationScreen';

export default function App() {
  const [session, setSession] = useState(null);

  if (!session) {
    return <SetupScreen onStart={setSession} />;
  }

  return <AnnotationScreen session={session} onBack={() => setSession(null)} />;
}
