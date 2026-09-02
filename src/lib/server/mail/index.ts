import nodemailer from 'nodemailer';

/**
 * Outgoing email over SMTP. Every consumer treats this module as optional:
 * `isMailConfigured()` reports whether SMTP_HOST and SMTP_FROM are set, and
 * callers degrade to in-app-only behavior when it answers false.
 */

export interface MailConfig {
	host: string;
	port: number;
	secure: boolean;
	user?: string;
	pass?: string;
	from: string;
}

export interface OutgoingMail {
	to: string;
	subject: string;
	text: string;
}

let cached: { key: string; transporter: nodemailer.Transporter } | null = null;

/** Reads SMTP_* env. Returns null unless a host and a from address exist. */
export function mailConfigFromEnv(): MailConfig | null {
	const host = process.env.SMTP_HOST?.trim();
	const from = process.env.SMTP_FROM?.trim();
	if (!host || !from) return null;
	const port = Number.parseInt(process.env.SMTP_PORT ?? '', 10);
	return {
		host,
		port: Number.isFinite(port) && port > 0 ? port : 587,
		secure: port === 465,
		user: process.env.SMTP_USER?.trim() || undefined,
		pass: process.env.SMTP_PASS || undefined,
		from
	};
}

/** True only when outgoing email can actually be attempted. */
export function isMailConfigured(): boolean {
	return mailConfigFromEnv() !== null;
}

function transporterFor(config: MailConfig): nodemailer.Transporter {
	const key = JSON.stringify(config);
	if (cached && cached.key === key) return cached.transporter;
	const transporter = nodemailer.createTransport({
		host: config.host,
		port: config.port,
		secure: config.secure,
		auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined
	});
	cached = { key, transporter };
	return transporter;
}

/**
 * Sends one message. Resolves false when mail is unconfigured or the send
 * fails; the failure is logged and never thrown, so callers keep working in
 * their no-email mode.
 */
export async function sendMail(message: OutgoingMail): Promise<boolean> {
	const config = mailConfigFromEnv();
	if (!config) return false;
	try {
		await transporterFor(config).sendMail({
			from: config.from,
			to: message.to,
			subject: message.subject,
			text: message.text
		});
		return true;
	} catch (error) {
		console.error('[mail] send failed:', error);
		return false;
	}
}

/** Test hook: drop the cached transporter between configurations. */
export function resetMailTransporter(): void {
	cached = null;
}
