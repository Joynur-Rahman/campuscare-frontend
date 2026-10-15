import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

import { ClerkProvider } from '@clerk/react';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const currentOrigin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://campuscare-frontend-eight.vercel.app';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={clerkPubKey}
      signInFallbackRedirectUrl={currentOrigin}
      signUpFallbackRedirectUrl={currentOrigin}
      signInForceRedirectUrl={currentOrigin}
      signUpForceRedirectUrl={currentOrigin}
      afterSignInUrl={currentOrigin}
      afterSignUpUrl={currentOrigin}
    >
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
