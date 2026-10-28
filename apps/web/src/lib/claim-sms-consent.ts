export const CLAIM_SMS_CONSENT_VERSION = '2026-10-28'

export const CLAIM_SMS_CONSENT = {
  en: 'I am authorized to use the business phone number shown above and agree to receive a one-time ownership-verification code from CityBeat Magazine, operated by Elevate El Paso, at that number when I select Request Verification Code. One message per request; the code expires in 15 minutes. Msg & data rates may apply. Reply STOP to opt out or HELP for help, or email hello@citybeatmag.co. No marketing or recurring texts. Consent is not a condition of purchase; use email verification or contact us for another way to verify.',
  es: 'Tengo autorización para usar el número del negocio indicado arriba y acepto recibir en ese número un código único de verificación de propiedad de CityBeat Magazine, operada por Elevate El Paso, al seleccionar Solicitar Código de Verificación. Un mensaje por solicitud; el código vence en 15 minutos. Pueden aplicar tarifas de mensajes y datos. Responda STOP para cancelar o HELP para ayuda, o escriba a hello@citybeatmag.co. Sin mensajes promocionales ni recurrentes. El consentimiento no es condición de compra; use la verificación por correo o contáctenos para otra forma de verificar.',
} as const

export function acceptsClaimSmsConsent(accepted: unknown, version: unknown): boolean {
  return accepted === true && version === CLAIM_SMS_CONSENT_VERSION
}
