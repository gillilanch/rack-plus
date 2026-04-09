import { createBrowserRouter, Navigate } from 'react-router';
import { EditExistingRackPage } from './pages/EditExistingRackPage';
import { LandingPage } from './pages/LandingPage';
import { RackWorkspacePage } from './pages/RackWorkspacePage';

export const router = createBrowserRouter([
  { path: '/', Component: LandingPage },
  { path: '/rack', Component: RackWorkspacePage },
  { path: '/build', element: <Navigate to="/rack?new=1" replace /> },
  { path: '/edit', Component: EditExistingRackPage },
]);
