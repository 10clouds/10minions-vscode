import React from 'react';
import { BRAND_COLOR, blendWithForeground } from './utils/blendColors';

export function Header({
  RobotIcon1,
  RobotIcon2,
}: {
  RobotIcon1: React.ElementType;
  RobotIcon2: React.ElementType;
}) {
  return (
    <>
      <h1 className="text-4xl font-bold text-center mb-2 text-primary">
        <div className="flex items-center justify-center">
          <RobotIcon1
            style={{ color: blendWithForeground(BRAND_COLOR, 0.75) }}
            className="w-8 h-8 inline-flex align-middle mr-2"
          />
          <span style={{ color: blendWithForeground(BRAND_COLOR, 0.75) }}>
            10
          </span>
          Minions
          <RobotIcon2
            style={{ color: blendWithForeground(BRAND_COLOR, 0.75) }}
            className="w-8 h-8 inline-flex align-middle ml-2"
          />
        </div>
      </h1>
      <h3 className="text-xl font-semibold text-center mb-6">
        Your Army of{' '}
        <span style={{ color: blendWithForeground(BRAND_COLOR, 0.75) }}>
          AI-Powered
        </span>
        <br /> <span style={{ opacity: 0.7 }}>Coding</span> Buddies
      </h3>
    </>
  );
}
