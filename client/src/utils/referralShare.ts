import { PUBLIC_APP_ORIGIN } from "../config";

export type ShareReferralArgs = {
  referralCode: string;
  creditsToReferrer: number;
  creditsToReferred: number;
  requiredAuditsForReward?: number;
  paidRewardMultiplier?: number;
};

export function buildReferralInviteLink(referralCode: string): string {
  return `${PUBLIC_APP_ORIGIN}/auth?mode=signup&ref=${encodeURIComponent(referralCode)}`;
}

export function buildReferralInviteMessage(args: ShareReferralArgs): { link: string; message: string } {
  const link = buildReferralInviteLink(args.referralCode);
  const requiredAudits = Math.max(1, Number(args.requiredAuditsForReward || 5));
  const paidMultiplier = Math.max(1, Number(args.paidRewardMultiplier || 3));
  const message = `I use AiVIS.biz to validate AI search answers, citation and brand mentions, technical trust signals, brand or domain credibility and global authority accurately. Sign up with my invite link and unlock +${args.creditsToReferred} credits for you and +${args.creditsToReferrer} for me once eligibility is met (${requiredAudits}+ audits), with ${paidMultiplier}x rewards on paid upgrades.`;
  return { link, message };
}

function buildSingleLinkCopyText(message: string, link: string): string {
  const normalizedMessage = message.replace(/https?:\/\/\S+/gi, '').replace(/\s+/g, ' ').trim();
  return `${normalizedMessage} ${link}`.trim();
}

export async function shareReferralInvite(args: ShareReferralArgs): Promise<"shared" | "copied" | "failed"> {
  const { link, message } = buildReferralInviteMessage(args);

  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({
        title: "Join AiVIS.biz",
        text: message,
        url: link,
      });
      return "shared";
    }
  } catch {
    // fall through to clipboard fallback
  }

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(buildSingleLinkCopyText(message, link));
      return "copied";
    }
  } catch {
    // fall through to failed
  }

  return "failed";
}
