type ParsedUA = {
	browser: string;
	os: string;
	device: string;
};

export function parseUserAgent(ua: string | null): ParsedUA {
	if (!ua) return { browser: "Unknown", os: "Unknown", device: "Unknown" };

	return {
		browser: parseBrowser(ua),
		os: parseOS(ua),
		device: parseDevice(ua),
	};
}

function parseBrowser(ua: string): string {
	let m: RegExpMatchArray | null;
	if ((m = ua.match(/Edg\/(\d+)/))) return `Edge ${m[1]}`;
	if ((m = ua.match(/OPR\/(\d+)/))) return `Opera ${m[1]}`;
	if ((m = ua.match(/Chrome\/(\d+)/))) return `Chrome ${m[1]}`;
	if ((m = ua.match(/Firefox\/(\d+)/))) return `Firefox ${m[1]}`;
	if ((m = ua.match(/Version\/(\d+)/))) return `Safari ${m[1]}`;
	return "Unknown";
}

function parseOS(ua: string): string {
	let m: RegExpMatchArray | null;
	if (/Windows NT 10/.test(ua)) return "Windows 10+";
	if (/Windows NT/.test(ua)) return "Windows";
	if ((m = ua.match(/Mac OS X (\d+[._]\d+)/))) return `macOS ${m[1].replace(/_/g, ".")}`;
	if ((m = ua.match(/Android (\d+)/))) return `Android ${m[1]}`;
	if ((m = ua.match(/iPhone OS (\d+)/))) return `iOS ${m[1]}`;
	if (/iPad/.test(ua)) return "iPadOS";
	if (/Linux/.test(ua)) return "Linux";
	if (/CrOS/.test(ua)) return "ChromeOS";
	return "Unknown";
}

function parseDevice(ua: string): string {
	if (/Mobile|Android.*Mobile|iPhone/.test(ua)) return "Mobile";
	if (/iPad|Android(?!.*Mobile)|Tablet/.test(ua)) return "Tablet";
	return "Desktop";
}
