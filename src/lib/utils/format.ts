export function parseFormatPattern(format: string): { decimalPlaces: number; useGrouping: boolean } {
	const parts = format.split(".");
	const fracPart = parts[1] || "";
	const intPart = parts[0] || "";
	const decimalPlaces = [...fracPart].filter((c) => c === "0" || c === "#").length;
	const useGrouping = intPart.includes(",");
	return { decimalPlaces, useGrouping };
}

export function formatStdPrice(value: number | null, format: string): string {
	if (value === null || value === undefined) return "—";
	const { decimalPlaces, useGrouping } = parseFormatPattern(format);
	try {
		return new Intl.NumberFormat("en-US", {
			minimumFractionDigits: decimalPlaces,
			maximumFractionDigits: decimalPlaces,
			useGrouping,
		}).format(value);
	} catch {
		return value.toFixed(decimalPlaces);
	}
}
