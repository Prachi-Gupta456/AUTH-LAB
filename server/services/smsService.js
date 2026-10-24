// Each provider is just: ({ to, body }) => Promise
const providers = {
  // Dev only: prints the SMS to the terminal. No account, no cost.
  console: async ({ to, body }) => {
    console.log(`\n[SMS:console] To ${to}\n${body}\n`);
  },

  twilio: async ({ to, body }) => {
    // Dynamic import: the twilio package loads only when this provider is used
    const { default: twilio } = await import('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({ to, from: process.env.TWILIO_FROM_NUMBER, body });
  },
};

const sendSms = async ({ to, body }) => {
  const name = process.env.SMS_PROVIDER || 'console';
  const send = providers[name];
  if (!send) throw new Error(`Unknown SMS_PROVIDER: ${name}`);

  // Safety net: the console provider would print real OTPs in production logs
  if (name === 'console' && process.env.NODE_ENV === 'production') {
    throw new Error('SMS_PROVIDER=console is not allowed in production');
  }

  await send({ to, body });
};

export const sendOtpSms = ({ to, otp }) => {
  const minutes = Number(process.env.OTP_TTL_MINUTES || 10);
  return sendSms({
    to,
    body: `${otp} is your Auth Lab verification code. It expires in ${minutes} minutes. Do not share it with anyone.`,
  });
};



// True only if an SMS can really be sent in the current environment
export const isSmsEnabled = () => {
  const name = process.env.SMS_PROVIDER || 'console';
  if (name === 'console') return process.env.NODE_ENV !== 'production'; // console is dev-only
  if (name === 'twilio') {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_FROM_NUMBER
    );
  }
  return false; // unknown provider
};