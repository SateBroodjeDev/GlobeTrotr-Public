import type { Agent } from "node:https";

type PublicAddress = { address: string; family: 4 | 6 };
type PublicResolver = (hostname: string, options: { all: true; verbatim: true }) => Promise<PublicAddress[]>;

export function isPublicAddress(address: unknown): boolean;
export function publicHttpsHostname(endpoint: string): string;
export function publicSmtpConnection(host: string, resolve?: PublicResolver): Promise<{ host: string; tls: { servername: string } }>;
export function publicHttpsAgent(endpoint: string, resolve?: PublicResolver): Promise<Agent>;
