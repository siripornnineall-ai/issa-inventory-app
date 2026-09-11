import { ImageResponse } from "next/og";
import { AppIconMark } from "@/lib/utils/appIcon";

export async function GET() {
  return new ImageResponse(<AppIconMark size={512} />, { width: 512, height: 512 });
}
