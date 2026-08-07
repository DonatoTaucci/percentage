/* notifications.ts — notifiche locali.
   Servono a rendere visibile ogni timbratura automatica: l'utente deve
   sempre sapere che cosa ha fatto l'app al posto suo. */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const CANALE = 'timbrature';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function preparaCanale(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CANALE, {
    name: 'Timbrature',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    vibrationPattern: [0, 120],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function chiediPermesso(): Promise<boolean> {
  const attuale = await Notifications.getPermissionsAsync();
  if (attuale.granted) return true;
  if (!attuale.canAskAgain) return false;
  const richiesta = await Notifications.requestPermissionsAsync();
  return richiesta.granted;
}

export async function permessoConcesso(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

/** Notifica immediata: trigger null significa "adesso". */
export async function notifica(title: string, body: string): Promise<void> {
  try {
    await preparaCanale();
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: false },
      trigger: null,
    });
  } catch {
    // Una notifica non consegnata non deve mai far fallire una timbratura.
  }
}
