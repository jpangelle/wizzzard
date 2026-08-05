export type AppStyle = "menubar" | "hide-on-close" | "regular";
export type MenuBarUI = "popover" | "menu";

export interface Answers {
  appName: string;
  location: string; // absolute parent directory the app is created in
  bundleId: string;
  style: AppStyle;
  menuBarUI: MenuBarUI | null; // null unless style === "menubar"
  launchAtLogin: boolean;
  description: string | null; // optional app description; enables the AI phases
}
