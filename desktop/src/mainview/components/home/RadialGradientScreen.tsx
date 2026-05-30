import React from "react";

import { getNetworkPrimaryColor } from "@shared/constants/Colors";
import { Networks } from "@shared/types/networks";

type RadialGradientScreenProps = {
  network: Networks;
  children: React.ReactNode;
  className?: string;
};

/** Web equivalent of mobile `RadialGradientScreen` (network primary → black). */
export const RadialGradientScreen: React.FC<RadialGradientScreenProps> = ({
  network,
  children,
  className,
}) => {
  const primaryColor = getNetworkPrimaryColor(network);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        height: "100%",
        minHeight: 0,
        width: "100%",
        backgroundColor: "#000000",
        backgroundImage: `radial-gradient(110% 77% at 50% -21%, ${primaryColor} 0%, #000000 72%)`,
        color: "#ffffff",
      }}
    >
      {children}
    </div>
  );
};
