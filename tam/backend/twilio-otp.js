/**
 * Twilio OTP Service for Backend
 * JavaScript version for Docker compatibility
 */

const getTwilioConfig = () => {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    fromNumber: process.env.TWILIO_PHONE_NUMBER || '',
    serviceSid: process.env.TWILIO_VERIFY_SERVICE_SID || ''
  };
};

const validatePhoneNumber = (phone) => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
};

const validateOTPCode = (code) => {
  const codeRegex = /^\d{4,8}$/;
  return codeRegex.test(code);
};

const sendSignInOtpViaTwilioServer = async (toE164, code) => {
  if (!validatePhoneNumber(toE164)) {
    return {
      ok: false,
      error: 'invalid_phone_number',
      detail: 'Phone number format is invalid'
    };
  }
  
  if (!validateOTPCode(code)) {
    return {
      ok: false,
      error: 'invalid_otp_code',
      detail: 'OTP code format is invalid'
    };
  }
  
  const config = getTwilioConfig();
  
  if (!config.accountSid || !config.authToken || !config.fromNumber || !config.serviceSid) {
    return {
      ok: false,
      error: 'twilio_config_missing',
      detail: 'Twilio configuration is incomplete'
    };
  }
  
  try {
    // Mock Twilio API call for Docker environment
    console.log(`📱 Sending OTP ${code} to ${toE164}`);
    
    return {
      ok: true,
      sid: 'MOCK_SID_' + Date.now(),
      to: toE164,
      status: 'sent'
    };
  } catch (error) {
    console.error('❌ Twilio OTP send failed:', error);
    return {
      ok: false,
      error: 'send_failed',
      detail: error.message,
      status: error.status
    };
  }
};

module.exports = {
  getTwilioConfig,
  validatePhoneNumber,
  validateOTPCode,
  sendSignInOtpViaTwilioServer
};
