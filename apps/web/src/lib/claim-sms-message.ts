export function claimSmsMessage(code: string, locale: 'en' | 'es'): string {
  return locale === 'es'
    ? `CityBeat Magazine: Su codigo solicitado para verificar la ficha es ${code}. Vence en 15 minutos. No comparta el codigo. Responda STOP para cancelar, HELP para ayuda. Pueden aplicar tarifas de mensajes y datos.`
    : `CityBeat Magazine: Your requested listing verification code is ${code}. It expires in 15 minutes. Do not share this code. Reply STOP to opt out, HELP for help. Msg & data rates may apply.`
}
