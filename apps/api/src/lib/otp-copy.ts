/* The OTP message copy, moved with the sender.

   Bilingual because a login code that arrives in the wrong language is a support
   ticket at best. The locale comes from the caller (the login screen knows which
   one the user is on); anything but "ar" falls back to "fr". */

export const OTP_MAIL = {
  fr: {
    subject: (code: string) => `Tnajem — ton code : ${code}`,
    body: (code: string) =>
      `Ton code de connexion Tnajem est :

    ${code}

` +
      `Il est valable 5 minutes.

` +
      `Si tu n'as pas demandé ce code, ignore cet email — personne ne peut se connecter sans lui.`,
    sms: (code: string) => `Tnajem : ton code de connexion est ${code} (valable 5 min).`,
  },
  ar: {
    subject: (code: string) => `تنجّم — الكود متاعك : ${code}`,
    body: (code: string) =>
      `كود الدخول متاعك في تنجّم :

    ${code}

` +
      `صالح 5 دقايق.

` +
      `إذا ما طلبتش هذا الكود، ما تعبّرش لهذا الإيميل — حتّى حد ما ينجم يدخل بلاه.`,
    sms: (code: string) => `تنجّم : كود الدخول متاعك هو ${code} (صالح 5 دقايق).`,
  },
} as const;
