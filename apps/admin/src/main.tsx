import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

const routeBase = import.meta.env.VITE_ADMIN_ROUTE_BASE ?? '/admin';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={routeBase}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
