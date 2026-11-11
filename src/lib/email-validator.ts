/**
 * Email validation and disposable/fake email blocker for Sakura Auth.
 */

export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  // Popular disposable email services
  "mailinator.com",
  "mailinator2.com",
  "mailin8r.com",
  "suremail.info",
  "tempmail.com",
  "temp-mail.org",
  "tempmailo.com",
  "temp-mail.io",
  "tempail.com",
  "tmpmail.org",
  "tmpmail.net",
  "10minutemail.com",
  "10minutemail.net",
  "10minemail.com",
  "minutemail.com",
  "minuteinbox.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.biz",
  "guerrillamail.org",
  "sharklasers.com",
  "grr.la",
  "guerrillamailblock.com",
  "pokemail.net",
  "spam4.me",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "cool.fr.nf",
  "jetable.fr.nf",
  "courriel.fr.nf",
  "moncourrier.fr.nf",
  "monemail.fr.nf",
  "monmail.fr.nf",
  "dispostable.com",
  "trashmail.com",
  "trashmail.net",
  "trashmail.me",
  "trash-mail.com",
  "trashmail.de",
  "dropmail.me",
  "10mail.org",
  "emlpro.com",
  "emlhub.com",
  "getairmail.com",
  "airmail.news",
  "mohmal.com",
  "mohmal.in",
  "mohmal.im",
  "fakemailgenerator.com",
  "throwawaymail.com",
  "generator.email",
  "emailfake.com",
  "crazymailing.com",
  "crazymail.com",
  "inboxbear.com",
  "burnermail.io",
  "nada.ltd",
  "getnada.com",
  "abyssmail.com",
  "tmailor.com",
  "mytemp.email",
  "disposablemail.com",
  "fakeinbox.com",
  "inboxkitten.com",
  "maildrop.cc",
  "emailondeck.com",
  "tempr.email",
  "discard.email",
  "fakermail.com",
  "harakirimail.com",
  "armyspy.com",
  "cuvox.de",
  "dayrep.com",
  "einrot.com",
  "fleckens.hu",
  "gustr.com",
  "jourrapide.com",
  "rhyta.com",
  "superrito.com",
  "teleworm.us",
  "mailnesia.com",
  "mytempemail.com",
]);

export const COMMON_DOMAIN_TYPOS: Record<string, string> = {
  // Gmail typos
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmeil.com": "gmail.com",
  "gmaik.com": "gmail.com",
  "gmaul.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.ru": "gmail.com",
  "gmai.ru": "gmail.com",

  // Yandex typos
  "yandx.ru": "yandex.ru",
  "yadnex.ru": "yandex.ru",
  "yandec.ru": "yandex.ru",
  "yabdex.ru": "yandex.ru",
  "yndx.ru": "yandex.ru",
  "yandex.r": "yandex.ru",
  "yandex.com.r": "yandex.ru",

  // Mail.ru typos
  "mial.ru": "mail.ru",
  "mal.ru": "mail.ru",
  "maill.ru": "mail.ru",
  "mai.ru": "mail.ru",
  "mail.r": "mail.ru",

  // Rambler typos
  "rmbler.ru": "rambler.ru",
  "rambler.r": "rambler.ru",

  // Microsoft typos
  "outlok.com": "outlook.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",

  // Apple typos
  "iclod.com": "icloud.com",
  "icoud.com": "icloud.com",
};

export type EmailValidationResult = {
  isValid: boolean;
  cleanEmail: string;
  error?: {
    en: string;
    ru: string;
  };
  suggestion?: {
    en: string;
    ru: string;
    suggestedEmail: string;
  };
};

/**
 * Validates whether an email is a real, syntactically correct, non-disposable address.
 */
export function validateEmail(rawEmail: string): EmailValidationResult {
  const cleanEmail = (rawEmail || "").trim().toLowerCase();

  if (!cleanEmail) {
    return {
      isValid: false,
      cleanEmail: "",
      error: {
        en: "Enter your email address.",
        ru: "Введите адрес электронной почты.",
      },
    };
  }

  // Length check: RFC 5321 limits total length to 254 octets
  if (cleanEmail.length < 5 || cleanEmail.length > 254) {
    return {
      isValid: false,
      cleanEmail,
      error: {
        en: "Email address must be between 5 and 254 characters long.",
        ru: "Длина email должна быть от 5 до 254 символов.",
      },
    };
  }

  // Must contain exactly one '@'
  const parts = cleanEmail.split("@");
  if (parts.length !== 2) {
    return {
      isValid: false,
      cleanEmail,
      error: {
        en: "Email must contain exactly one '@' symbol.",
        ru: "Email должен содержать ровно один символ '@'.",
      },
    };
  }

  const [localPart, domainPart] = parts;

  // Local part validation
  if (!localPart || localPart.length > 64) {
    return {
      isValid: false,
      cleanEmail,
      error: {
        en: "Email username (before @) is invalid or too long.",
        ru: "Имя почтового ящика (до @) некорректно или слишком длинное.",
      },
    };
  }

  if (localPart.startsWith(".") || localPart.endsWith(".")) {
    return {
      isValid: false,
      cleanEmail,
      error: {
        en: "Email username cannot start or end with a dot.",
        ru: "Имя почтового ящика не может начинаться или заканчиваться точкой.",
      },
    };
  }

  if (localPart.includes("..")) {
    return {
      isValid: false,
      cleanEmail,
      error: {
        en: "Email username cannot contain consecutive dots.",
        ru: "Имя почтового ящика не может содержать две точки подряд.",
      },
    };
  }

  // Allowed characters in local part
  const localPartRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
  if (!localPartRegex.test(localPart)) {
    return {
      isValid: false,
      cleanEmail,
      error: {
        en: "Email username contains invalid characters.",
        ru: "Имя почтового ящика содержит недопустимые символы.",
      },
    };
  }

  // Domain part validation
  if (!domainPart || domainPart.length > 253) {
    return {
      isValid: false,
      cleanEmail,
      error: {
        en: "Email domain is invalid.",
        ru: "Домен почты некорректен.",
      },
    };
  }

  // Domain must contain at least one dot separating labels
  if (!domainPart.includes(".")) {
    return {
      isValid: false,
      cleanEmail,
      error: {
        en: "Email domain must contain an extension (e.g. .com, .ru).",
        ru: "В домене почты должно быть расширение (например, .ru, .com).",
      },
    };
  }

  const domainLabels = domainPart.split(".");
  const tld = domainLabels[domainLabels.length - 1];

  // TLD must be at least 2 characters and contain only letters
  if (!tld || tld.length < 2 || !/^[a-zA-Z]{2,24}$/.test(tld)) {
    return {
      isValid: false,
      cleanEmail,
      error: {
        en: "Email domain zone (TLD) is invalid.",
        ru: "Некорректная доменная зона почты (например, должна быть .ru, .com).",
      },
    };
  }

  // Each domain label must be valid
  for (const label of domainLabels) {
    if (!label || label.length > 63) {
      return {
        isValid: false,
        cleanEmail,
        error: {
          en: "Email domain contains invalid segment.",
          ru: "Часть домена почты некорректна.",
        },
      };
    }
    if (label.startsWith("-") || label.endsWith("-")) {
      return {
        isValid: false,
        cleanEmail,
        error: {
          en: "Domain segments cannot start or end with a hyphen.",
          ru: "Часть домена почты не может начинаться или заканчиваться дефисом.",
        },
      };
    }
    if (!/^[a-zA-Z0-9-]+$/.test(label)) {
      return {
        isValid: false,
        cleanEmail,
        error: {
          en: "Email domain contains invalid characters.",
          ru: "Домен почты содержит недопустимые символы.",
        },
      };
    }
  }

  // Check for disposable / temporary email domains
  if (
    DISPOSABLE_EMAIL_DOMAINS.has(domainPart) ||
    domainPart.includes("tempmail") ||
    domainPart.includes("throwaway") ||
    domainPart.includes("disposable") ||
    domainPart.includes("fakeinbox")
  ) {
    return {
      isValid: false,
      cleanEmail,
      error: {
        en: "Disposable/temporary emails are not allowed. Please enter your real email.",
        ru: "Регистрация на временные и одноразовые почтовые ящики запрещена. Пожалуйста, укажите вашу настоящую постоянную почту.",
      },
    };
  }

  // Check for common domain typos
  const suggestedDomain = COMMON_DOMAIN_TYPOS[domainPart];
  if (suggestedDomain) {
    const suggestedEmail = `${localPart}@${suggestedDomain}`;
    return {
      isValid: false,
      cleanEmail,
      suggestion: {
        en: `Did you mean ${suggestedEmail}?`,
        ru: `Возможно, вы имели в виду ${suggestedEmail}? Проверьте написание домена.`,
        suggestedEmail,
      },
      error: {
        en: `Possible typo in email domain (${domainPart}). Did you mean ${suggestedDomain}?`,
        ru: `Кажется, в домене почты опечатка (${domainPart}). Возможно, вы имели в виду @${suggestedDomain}?`,
      },
    };
  }

  return {
    isValid: true,
    cleanEmail,
  };
}
