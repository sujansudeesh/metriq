import React from 'react';
import { MetriqLogo, MetriqLogoProps } from './MetriqLogo';

export const Logo: React.FC<MetriqLogoProps> = (props) => {
  return <MetriqLogo {...props} />;
};

export { MetriqLogo };
