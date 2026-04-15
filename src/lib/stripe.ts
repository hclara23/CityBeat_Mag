import Stripe from 'stripe'

const stripeKey = process.env.STRIPE_SECRET_KEY

export const stripe = new Stripe(stripeKey || '', {
  apiVersion: '2023-10-16',
})

export function validateStripeKey() {
  if (!stripeKey) {
    throw new Error('STRIPE_SECRET_KEY is not defined in environment variables')
  }
}
