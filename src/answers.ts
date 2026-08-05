export type AppStyle = "menubar" | "hide-on-close" | "regular";
export type MenuBarUI = "popover" | "menu";

export interface Answers {
  appName: string;
  bundleId: string;
  style: AppStyle;
  menuBarUI: MenuBarUI | null; // null unless style === "menubar"
  launchAtLogin: boolean;
}
