import React from "react";
import { SvgXml } from "react-native-svg";
import boldIcons from "@gems-group/icons/dist/bold/icons-bold.json";
import outlineIcons from "@gems-group/icons/dist/outline/icons-outline.json";
import linearIcons from "@gems-group/icons/dist/linear/icons-linear.json";
import brokenIcons from "@gems-group/icons/dist/broken/icons-broken.json";

type IconVariant = "bold" | "outline" | "linear" | "broken";

interface IconProps {
  name: string;
  variant?: IconVariant;
  size?: number;
  color?: string;
}

const iconSets: Record<IconVariant, Record<string, string>> = {
  bold: boldIcons,
  outline: outlineIcons,
  linear: linearIcons,
  broken: brokenIcons,
};

const Icon: React.FC<IconProps> = ({
  name,
  variant = "linear",
  size = 24,
  color = "#000000",
}) => {
  const set = iconSets[variant];

  if (!set?.[name]) {
    console.warn(`@gems-group/icons: "${name}" not found in "${variant}"`);
    return null;
  }

  const svg = set[name]
    .replace(/fill="currentColor"/g, `fill="${color}"`)
    .replace(/stroke="currentColor"/g, `stroke="${color}"`);

  return <SvgXml xml={svg} width={size} height={size} />;
};

export default Icon;