function words(appName: string): string[] {
  return appName.split(/[^A-Za-z0-9]+/).filter(Boolean);
}

export function deriveModuleName(appName: string): string {
  return words(appName)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join("");
}

export function deriveKebabName(appName: string): string {
  return words(appName).join("-").toLowerCase();
}

export function defaultBundleId(appName: string): string {
  return `com.jpangelle.${deriveKebabName(appName)}`;
}

export function isValidBundleId(id: string): boolean {
  return /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(id);
}

export function validateAppName(appName: string): string | undefined {
  if (!appName.trim()) return "App name is required";
  const moduleName = deriveModuleName(appName);
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(moduleName)) {
    return "App name must contain letters and not start with a digit";
  }
  return undefined;
}
