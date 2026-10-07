import React from 'react';
import { createRoot } from 'react-dom/client';
import { WorkshopApp } from '../../ui/App';
import { createRenderer } from './renderer';
import '../../ui/style.css';
import '../../ui/compact.css';
createRoot(document.getElementById('root')!).render(<WorkshopApp theme="paper" renderer={createRenderer} />);
