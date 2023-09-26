import React from 'react';
import { Logo } from './Logo';

const SidebarFooter = () => (
  <div
    // TODO: Update className to achieve better centering, margin, padding, and width
    className="text-center py-4 fixed bottom-0 w-full"
    key="credits"
    style={{
      backgroundColor: 'var(--vscode-sideBar-background)',
      zIndex: 1000,
    }}
  >
    <a
      className="inline-block w-20 logo"
      href="https://10clouds.com"
      target="_blank"
      rel="noopener noreferrer"
    >
      by <br />
      <Logo className="inline-block w-20" alt="10Clouds Logo" />
    </a>
  </div>
);

export default SidebarFooter;
