import { createRef } from 'react';

// Passed to <NavigationContainer ref={navigationRef}> in App.js.
// Used by the axios 401 interceptor to navigate without a component reference.
export const navigationRef = createRef();
