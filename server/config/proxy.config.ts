/**
 * Express "trust proxy" setting.
 *
 * Trusting a proxy makes Express take the client address (req.ip, used by the sign-in and CAPTCHA rate
 * limits), the protocol and the host from X-Forwarded-* headers. The portal is opened directly at
 * http://<server>:3000 with no reverse proxy in front, so trusting those headers would let any client
 * send its own X-Forwarded-For on each attempt and never hit the per-address limit.
 *
 *   TRUST_PROXY unset / "false" / "0"   do not trust forwarded headers (default; correct without a proxy)
 *   TRUST_PROXY=1 (or 2, ...)           the number of proxies in front (e.g. 1 for nginx on the same server)
 *   TRUST_PROXY=true                    trust every hop (only when the network guarantees it)
 *   TRUST_PROXY=loopback,10.0.0.5       trust these addresses / subnets (Express syntax)
 */
export function trustProxySetting(raw: string | undefined = process.env.TRUST_PROXY): boolean | number | string {
  const value = String(raw ?? '').trim();
  if (!value || /^(false|0|off|no)$/i.test(value)) return false;
  if (/^(true|on|yes)$/i.test(value)) return true;
  if (/^\d+$/.test(value)) return Math.min(Number(value), 10);
  return value;
}
