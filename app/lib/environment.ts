// Public client ID identifies the app independently of where its server runs.
export const DEVELOPMENT_APP_ID = "9e6dabfa2ea6894ed70bd75ae6cf22b2";

export function isDevelopmentApp(clientId: string | undefined) {
  return clientId === DEVELOPMENT_APP_ID;
}
