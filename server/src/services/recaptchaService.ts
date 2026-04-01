type RecaptchaVerifyResult = {
  ok: boolean;
  message?: string;
};

function getRecaptchaSecret(): string {
  return String(
    process.env.RECAPT_SAFE_KEY || process.env.RECAPTCHA_SECRET_KEY || ""
  ).trim();
}

export function isRecaptchaEnforced(): boolean {
  return Boolean(getRecaptchaSecret());
}

export async function verifyRecaptchaToken(
  token: string,
  remoteIp?: string
): Promise<RecaptchaVerifyResult> {
  const secret = getRecaptchaSecret();
  if (!secret) {
    return { ok: true };
  }

  if (!token || !String(token).trim()) {
    return { ok: false, message: "Missing captcha token" };
  }

  try {
    const params = new URLSearchParams({
      secret,
      response: String(token).trim(),
    });

    if (remoteIp) {
      params.set("remoteip", remoteIp);
    }

    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success !== true) {
      const errorCodes = Array.isArray(payload?.["error-codes"])
        ? payload["error-codes"].join(",")
        : "invalid-captcha";
      return { ok: false, message: errorCodes };
    }

    return { ok: true };
  } catch (error: any) {
    return { ok: false, message: error?.message || "captcha-verification-failed" };
  }
}
